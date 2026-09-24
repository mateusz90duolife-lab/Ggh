/* Testy kursu pomp ciepła w przeglądarce: pełny przebieg kursu,
   trening, kalkulatory, ściąga, widok mobilny.
   Uruchomienie:  ./testy/uruchom.sh --all
   Wymaga pakietu playwright oraz Chromium. */

const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || 'pompy.html');
const errors = [];

function watch(page, tag) {
  page.on('console', m => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); });
  page.on('pageerror', e => errors.push(tag + ' wyjątek: ' + e.message));
}

/** Odpowiada na wszystkie zadania otwartej sesji: poprawnie albo celowo błędnie. */
async function answerSession(page, correct) {
  let n = 0;
  for (;;) {
    if (!(await page.evaluate(() => Session.active))) break;
    const c = await page.evaluate(() => Session.q.correct);
    await page.locator('.opt').nth(correct ? c : (c + 1) % 4).click();
    if (!(await page.locator('.fb').count())) errors.push('brak objaśnienia po odpowiedzi');
    await page.locator('button.btn').filter({ hasText: /^(Dalej|Zakończ)$/ }).first().click();
    if (++n > 40) { errors.push('sesja się nie kończy'); break; }
  }
  return n;
}

async function testKurs(browser) {
  console.log('\n— Kurs —');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  watch(page, '[kurs]');
  await page.goto(APP);

  if ((await page.textContent('#nav button.on')).trim() !== 'Kurs') errors.push('domyślną zakładką nie jest Kurs');
  const rows = await page.locator('.mod').count();
  if (rows !== 13) errors.push('spis kursu ma ' + rows + ' pozycji zamiast 13');
  if (!(await page.locator('.mod').nth(1).evaluate(e => e.classList.contains('locked')))) errors.push('moduł 2 otwarty na starcie');
  if (!(await page.locator('.mod').nth(12).evaluate(e => e.classList.contains('locked')))) errors.push('egzamin otwarty na starcie');
  console.log('  spis: 12 modułów + egzamin, bramkowanie na starcie poprawne');

  await page.locator('.mod').nth(0).click();
  if ((await page.locator('.lesson.open').count()) < 3) errors.push('teoria modułu 1 nie jest rozwinięta');
  if (!(await page.locator('.lesson.open svg').count())) errors.push('lekcja modułu 1 bez schematu');

  await page.locator('button.btn').filter({ hasText: /^Ćwiczenia/ }).first().click();
  // klawiatura: 1 = pierwsza odpowiedź, Enter = dalej
  await page.keyboard.press('1');
  if (!(await page.locator('.fb').count())) errors.push('klawisz 1 nie zaznacza odpowiedzi');
  await page.keyboard.press('Enter');
  if ((await page.evaluate(() => Session.i)) !== 1) errors.push('Enter nie przechodzi do kolejnego zadania');
  const nDrill = 1 + await answerSession(page, true);
  console.log('  ćwiczenia modułu 1: ' + nDrill + ' zadań, obsługa klawiatury działa');

  await page.locator('button.btn').filter({ hasText: /^Sprawdzian/ }).first().click();
  await answerSession(page, false);
  if (!/niezaliczony/.test(await page.textContent('h2'))) errors.push('oblany sprawdzian nierozpoznany');
  if (await page.evaluate(() => moduleUnlocked(1))) errors.push('moduł 2 otworzył się mimo oblanego sprawdzianu');
  console.log('  oblany sprawdzian nie otwiera kolejnego modułu');

  await page.locator('button.btn').filter({ hasText: 'Powtórz ćwiczenia' }).first().click();
  await answerSession(page, true);
  await page.locator('button.btn').filter({ hasText: /^Sprawdzian/ }).first().click();
  await answerSession(page, true);
  if (!/Moduł zaliczony/.test(await page.textContent('h2'))) errors.push('zdany sprawdzian nie zaliczył modułu');
  if (!(await page.evaluate(() => moduleUnlocked(1)))) errors.push('moduł 2 nie odblokował się');

  let calcSeen = 0;
  for (let i = 1; i < 12; i++) {
    const id = await page.evaluate(k => COURSE[k].id, i);
    await page.evaluate(x => { Session.summary = null; UI.module = x; render(); }, id);
    if ((await page.locator('.lesson').count()) < 3) errors.push('moduł ' + (i + 1) + ': brak lekcji');
    await page.locator('button.btn').filter({ hasText: /^Sprawdzian/ }).first().click();
    calcSeen += await page.evaluate(() => Session.queue.filter(s => s.gen).length);
    await answerSession(page, true);
    if (!/Moduł zaliczony/.test(await page.textContent('h2'))) { errors.push('moduł ' + (i + 1) + ' niezaliczony'); break; }
  }
  const passed = await page.evaluate(() => passedCount());
  console.log('  zaliczonych modułów: ' + passed + ' z 12, zadań obliczeniowych w sprawdzianach: ' + calcSeen);
  if (passed !== 12) errors.push('nie wszystkie moduły dało się zaliczyć');

  await page.evaluate(() => { Session.summary = null; UI.module = null; render(); });
  if (await page.locator('.mod').nth(12).evaluate(e => e.classList.contains('locked'))) errors.push('egzamin nie otworzył się');
  await page.locator('.mod').nth(12).click();
  const nExam = await answerSession(page, true);
  console.log('  egzamin: ' + nExam + ' zadań');
  if (nExam !== 24) errors.push('egzamin ma ' + nExam + ' zadań zamiast 24');
  await page.locator('button.btn').filter({ hasText: /Zobacz certyfikat/ }).first().click();
  if (!(await page.locator('.cert').count())) errors.push('brak zaświadczenia po zdanym egzaminie');
  await page.fill('.cert + .row input', 'Jan Testowy');
  await page.locator('.cert + .row input').press('Tab');
  if (!/Jan Testowy/.test(await page.textContent('.cert .who'))) errors.push('imię nie trafiło na zaświadczenie');

  await page.reload();
  if ((await page.evaluate(() => passedCount())) !== 12 || !(await page.locator('.cert').count()) || !/Jan Testowy/.test(await page.textContent('.cert .who')))
    errors.push('postęp kursu nie przetrwał przeładowania');
  console.log('  zaświadczenie wystawione i zachowane po przeładowaniu');
  await page.close();
}

async function testNarzedzia(browser) {
  console.log('\n— Trening, kalkulatory, ściąga, postępy —');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  watch(page, '[narzędzia]');
  await page.goto(APP);

  await page.click('#nav button:has-text("Trening")');
  await page.locator('button.btn').filter({ hasText: 'Zacznij sesję' }).click();
  const n = await answerSession(page, true);
  if (n !== 10) errors.push('trening ma ' + n + ' zadań zamiast 10');
  if (!/Sesja zakończona/.test(await page.textContent('h2'))) errors.push('brak podsumowania treningu');
  console.log('  trening: ' + n + ' zadań z podsumowaniem');

  await page.click('#nav button:has-text("Kalkulatory")');
  const cards = await page.locator('.calc-grid .card').count();
  if (cards !== 12) errors.push('kalkulatorów jest ' + cards + ' zamiast 12');
  const outs = await page.locator('.out').allTextContents();
  outs.forEach((t, i) => { if (!t.trim() || /Nie da się|Uzupełnij|NaN|undefined/.test(t)) errors.push('kalkulator ' + (i + 1) + ' nie liczy dla wartości domyślnych: ' + t); });
  const before = await page.textContent('.calc-grid .card:first-child .out');
  await page.selectOption('#c-co2-ref', 'R410A');
  await page.fill('#c-co2-kg', '30');   // 30 kg × 2088 = 62,64 t CO₂e → co 6 miesięcy
  const after = await page.textContent('.calc-grid .card:first-child .out');
  if (before === after || !/62,64 t CO₂e/.test(after) || !/co 6 miesięcy/.test(after)) errors.push('kalkulator CO₂e nie przelicza po zmianie danych: ' + after);
  await page.fill('#c-press-p2', '37,5');
  if (!/szukaj nieszczelności/.test(await page.textContent('#c-press-p2 >> xpath=ancestor::div[contains(@class,"card")]'))) errors.push('kalkulator próby ciśnieniowej nie wykrywa spadku');
  if (!(await page.locator('.out svg').count())) errors.push('kalkulator punktu biwalentnego bez wykresu');
  console.log('  kalkulatory: ' + cards + ', liczą i reagują na zmiany');

  await page.click('#nav button:has-text("Ściąga")');
  const ptRows = await page.locator('.card').first().locator('tr').count();
  if (ptRows !== 20) errors.push('tabela ciśnień ma ' + ptRows + ' wierszy zamiast 20');

  await page.click('#nav button:has-text("Postępy")');
  const seen = parseInt(await page.locator('.stat-n').nth(1).textContent(), 10);
  if (seen < 10) errors.push('postępy nie liczą zadań z treningu');
  console.log('  ściąga i postępy wyświetlone, zapisanych zadań: ' + seen);

  await page.setViewportSize({ width: 390, height: 800 });
  for (const tab of ['Kurs', 'Trening', 'Kalkulatory', 'Ściąga', 'Postępy']) {
    await page.click('#nav button:has-text("' + tab + '")');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 2) errors.push('poziomy scroll przy 390 px w zakładce ' + tab);
  }
  await page.evaluate(() => { UI.tab = 'kurs'; UI.module = 'm5'; render(); });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 2) errors.push('poziomy scroll przy 390 px w module z tabelami');
  console.log('  widok 390 px: bez poziomego przewijania we wszystkich zakładkach');
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  await testKurs(browser);
  await testNarzedzia(browser);
  await browser.close();
  if (errors.length) { console.log('\nBŁĘDY:\n' + errors.join('\n') + '\n'); process.exit(1); }
  console.log('\nTesty kursu pomp ciepła w przeglądarce przeszły.\n');
})();
