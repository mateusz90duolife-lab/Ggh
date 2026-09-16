/* Testy trenera w przeglądarce: przebieg treningu i pełny przebieg kursu.
   Uruchomienie:  ./testy/uruchom.sh --all
   Wymaga pakietu playwright oraz Chromium. */

const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || 'trener.html');
const errors = [];

function watch(page, tag) {
  page.on('console', m => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); });
  page.on('pageerror', e => errors.push(tag + ' wyjątek: ' + e.message));
}

/** Odpowiada na wszystkie zadania otwartej sesji. */
async function answerSession(page, correct) {
  let n = 0;
  for (;;) {
    if (!(await page.evaluate(() => Session.active))) break;
    const info = await page.evaluate(() => ({ c: Session.q.correct, len: Session.q.options.length }));
    await page.locator('.opt').nth(correct ? info.c : (info.c + 1) % info.len).click();
    await page.waitForTimeout(25);
    await page.locator('button.btn').filter({ hasText: /Dalej|Zakończ sesję/ }).first().click();
    await page.waitForTimeout(35);
    if (++n > 40) { errors.push('sesja się nie kończy'); break; }
  }
  return n;
}

async function testTrening(browser) {
  console.log('\n— Tryb Trening —');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  watch(page, '[trening]');
  await page.goto(APP);
  await page.waitForTimeout(250);

  await page.click('#nav button:has-text("Trening")');
  await page.waitForTimeout(200);
  await page.locator('button.btn').filter({ hasText: 'Zacznij sesję' }).first().click();
  await page.waitForTimeout(250);

  const kinds = new Set();
  for (let i = 0; i < 10; i++) {
    const tag = await page.textContent('.q-tag').catch(() => null);
    if (tag) kinds.add(tag);
    const n = await page.locator('.opt').count();
    if (!n) { errors.push('brak opcji w zadaniu ' + (i + 1)); break; }
    await page.locator('.opt').nth(i % n).click();
    await page.waitForTimeout(80);
    if (!(await page.locator('.fb').count())) errors.push('brak informacji zwrotnej w zadaniu ' + (i + 1));
    await page.locator('button.btn').filter({ hasText: /Dalej|Zakończ sesję/ }).first().click();
    await page.waitForTimeout(90);
  }
  console.log('  typów zadań w jednej sesji: ' + kinds.size + ' z 8');
  if (kinds.size < 6) errors.push('przeplatanie dało tylko ' + kinds.size + ' typów zadań');

  await page.click('#nav button:has-text("Buduj")');
  await page.waitForTimeout(250);
  const cells = await page.locator('.plan-cell').count();
  if (!cells) errors.push('tryb Buduj: brak siatki planu');
  for (let i = 0; i < Math.min(3, cells); i++) { await page.locator('.plan-cell').nth(i).click(); await page.waitForTimeout(50); }
  await page.locator('button.btn').filter({ hasText: 'Sprawdź' }).first().click();
  await page.waitForTimeout(200);
  if (!(await page.locator('.fb').count())) errors.push('tryb Buduj: brak wyniku sprawdzenia');
  console.log('  tryb Buduj: siatka ' + cells + ' pól, sprawdzenie działa');

  await page.click('#nav button:has-text("Teoria")');
  await page.waitForTimeout(200);
  const lessons = await page.locator('.lesson-h').count();
  for (let i = 0; i < lessons; i++) { await page.locator('.lesson-h').nth(i).click(); await page.waitForTimeout(50); }
  await page.waitForTimeout(250);
  console.log('  lekcji w dziale Teoria: ' + lessons);
  if (lessons < 12) errors.push('spodziewano się 12 lekcji, jest ' + lessons);

  await page.click('#nav button:has-text("Postępy")');
  await page.waitForTimeout(250);
  const skills = await page.locator('.skill').count();
  if (skills !== 8) errors.push('lista postępów pokazuje ' + skills + ' umiejętności zamiast 8');

  await page.reload();
  await page.waitForTimeout(350);
  await page.click('#nav button:has-text("Postępy")');
  await page.waitForTimeout(200);
  const seen = parseInt(await page.locator('.stat-n').nth(1).textContent(), 10);
  console.log('  zapisanych zadań po przeładowaniu: ' + seen);
  if (seen < 10) errors.push('postęp treningu nie przetrwał przeładowania');

  await page.setViewportSize({ width: 390, height: 780 });
  await page.click('#nav button:has-text("Trening")');
  await page.waitForTimeout(200);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const cw = await page.evaluate(() => document.documentElement.clientWidth);
  if (sw > cw + 2) errors.push('poziomy scroll przy szerokości 390 px');
  console.log('  widok 390 px: bez poziomego przewijania');
  await page.close();
}

async function testKurs(browser) {
  console.log('\n— Kurs —');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  watch(page, '[kurs]');
  await page.goto(APP);
  await page.waitForTimeout(250);

  if ((await page.textContent('#nav button.on')).trim() !== 'Kurs') errors.push('domyślną zakładką nie jest Kurs');
  const rows = await page.locator('.mod').count();
  if (rows !== 11) errors.push('spis kursu ma ' + rows + ' pozycji zamiast 11');
  if (!(await page.locator('.mod').nth(1).evaluate(e => e.classList.contains('locked')))) errors.push('moduł 2 otwarty na starcie');
  if (!(await page.locator('.mod').nth(10).evaluate(e => e.classList.contains('locked')))) errors.push('egzamin otwarty na starcie');
  console.log('  spis: 10 modułów + egzamin, bramkowanie na starcie poprawne');

  await page.locator('.mod').nth(0).click();
  await page.waitForTimeout(250);
  if (!(await page.locator('.lesson.open').count())) errors.push('teoria modułu nie jest rozwinięta');
  if (!(await page.locator('.lesson.open canvas').count())) errors.push('lekcja modułu bez rysunków');

  await page.locator('button.btn').filter({ hasText: /^Ćwiczenia/ }).first().click();
  await page.waitForTimeout(200);
  const nDrill = await answerSession(page, true);
  console.log('  ćwiczenia modułu 1: ' + nDrill + ' zadań');

  // Sprawdzian oblany celowo — kolejny moduł ma pozostać zamknięty
  await page.locator('button.btn').filter({ hasText: /^Sprawdzian/ }).first().click();
  await page.waitForTimeout(200);
  await answerSession(page, false);
  if (!/niezaliczony/.test(await page.textContent('h2'))) errors.push('oblany sprawdzian nierozpoznany');
  if (await page.evaluate(() => moduleUnlocked(1))) errors.push('moduł 2 otworzył się mimo oblanego sprawdzianu');
  console.log('  oblany sprawdzian nie otwiera kolejnego modułu');

  await page.locator('button.btn').filter({ hasText: /Powtórz ćwiczenia|Powtórz sprawdzian/ }).first().click();
  await page.waitForTimeout(200);
  await answerSession(page, true);
  if (/Ćwiczenia zakończone/.test(await page.textContent('h2'))) {
    await page.locator('button.btn').filter({ hasText: /^Sprawdzian/ }).first().click();
    await page.waitForTimeout(200);
    await answerSession(page, true);
  }
  if (!/Moduł zaliczony/.test(await page.textContent('h2'))) errors.push('zdany sprawdzian nie zaliczył modułu');
  if (!(await page.evaluate(() => moduleUnlocked(1)))) errors.push('moduł 2 nie odblokował się');

  for (let i = 1; i < 10; i++) {
    const id = await page.evaluate(k => COURSE[k].id, i);
    await page.evaluate(x => { Session.summary = null; UI.module = x; render(); }, id);
    await page.waitForTimeout(120);
    await page.locator('button.btn').filter({ hasText: /^Sprawdzian/ }).first().click();
    await page.waitForTimeout(150);
    await answerSession(page, true);
    if (!/Moduł zaliczony/.test(await page.textContent('h2'))) { errors.push('moduł ' + (i + 1) + ' niezaliczony'); break; }
  }
  const passed = await page.evaluate(() => passedCount());
  console.log('  zaliczonych modułów: ' + passed + ' z 10');
  if (passed !== 10) errors.push('nie wszystkie moduły dało się zaliczyć');

  await page.evaluate(() => { Session.summary = null; UI.module = null; render(); });
  await page.waitForTimeout(150);
  if (await page.locator('.mod').nth(10).evaluate(e => e.classList.contains('locked'))) errors.push('egzamin nie otworzył się');
  await page.locator('.mod').nth(10).click();
  await page.waitForTimeout(200);
  const nExam = await answerSession(page, true);
  console.log('  egzamin: ' + nExam + ' zadań');
  await page.locator('button.btn').filter({ hasText: /Zobacz certyfikat|Spis modułów/ }).first().click();
  await page.waitForTimeout(250);
  if (!(await page.locator('.cert').count())) errors.push('brak certyfikatu po zdanym egzaminie');

  await page.reload();
  await page.waitForTimeout(350);
  if ((await page.evaluate(() => passedCount())) !== 10 || !(await page.locator('.cert').count()))
    errors.push('postęp kursu nie przetrwał przeładowania');
  console.log('  certyfikat wystawiony i zachowany po przeładowaniu');
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  await testTrening(browser);
  await testKurs(browser);
  await browser.close();
  if (errors.length) { console.log('\nBŁĘDY:\n' + errors.join('\n') + '\n'); process.exit(1); }
  console.log('\nTesty w przeglądarce przeszły.\n');
})();
