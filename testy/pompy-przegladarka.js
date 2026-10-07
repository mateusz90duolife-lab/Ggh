/* Testy kursu pomp ciepła w przeglądarce: pełny przebieg kursu,
   trening, kalkulatory, ściąga, widok mobilny.
   Uruchomienie:  ./testy/uruchom.sh --all
   Wymaga pakietu playwright oraz Chromium. */

const { chromium } = require('playwright');
const path = require('path');
const APP = 'file://' + path.resolve(process.argv[2] || 'pompy.html');
const errors = [];

function watch(page, tag) {
  // Czcionki z Google Fonts nie ładują się bez sieci; aplikacja przechodzi wtedy na czcionki systemowe.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errors.push(tag + ' nie wczytano: ' + r.url()); });
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

/** Rozwiązuje otwarty egzamin: poprawnie albo celowo błędnie, potem kończy go przez potwierdzenie na stronie. */
async function answerExam(page, correct, upto) {
  const n = await page.evaluate(() => State.examRun.qs.length);
  for (let k = 0; k < Math.min(n, upto == null ? n : upto); k++) {
    const c = await page.evaluate(i => State.examRun.qs[i].correct, k);
    await page.locator('.opt').nth(correct ? c : (c + 1) % 4).click();
    if (await page.locator('.fb').count()) errors.push('egzamin pokazuje objaśnienie przed zakończeniem');
    if (k + 1 < n) await page.locator('button.btn').filter({ hasText: 'Następne →' }).click();
  }
  await page.locator('button.btn').filter({ hasText: /^Zakończ egzamin$/ }).first().click();
  await page.locator('button.btn').filter({ hasText: 'Zakończ i sprawdź' }).click();
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
  if ((await page.textContent('#nav button.on')).trim() !== 'Egzamin') errors.push('egzamin końcowy nie otwiera zakładki Egzamin');
  const nExam = await answerExam(page, true);
  console.log('  egzamin końcowy: ' + nExam + ' zadań w trybie egzaminacyjnym');
  if (nExam !== 24) errors.push('egzamin ma ' + nExam + ' zadań zamiast 24');
  if (!/Egzamin zdany/.test(await page.textContent('h2'))) errors.push('zdany egzamin końcowy nierozpoznany');
  await page.locator('button.btn').filter({ hasText: 'Zobacz zaświadczenie' }).click();
  if (!(await page.locator('.cert').count())) errors.push('brak zaświadczenia po zdanym egzaminie');
  if (await page.locator('.cert + .row button').filter({ hasText: 'Drukuj' }).count() !== 1) errors.push('poza ramką brak przycisku drukowania');
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

  await page.click('#nav button:has-text("Nauka")');
  await page.locator('button.btn').filter({ hasText: 'Zacznij trening' }).click();
  const n = await answerSession(page, false);
  if (n !== 10) errors.push('trening ma ' + n + ' zadań zamiast 10');
  if (!/Trening zakończony/.test(await page.textContent('h2'))) errors.push('brak podsumowania treningu');
  const mist = await page.evaluate(() => mistakeCount());
  const uniq = await page.evaluate(() => new Set(Session.queue.map(specKey)).size);
  if (mist !== uniq) errors.push('do powtórki trafiło ' + mist + ' zadań, a różnych błędnych było ' + uniq);
  console.log('  trening: ' + n + ' zadań, do powtórki trafiło ' + mist);

  await page.locator('button.btn').filter({ hasText: 'Wróć do nauki' }).click();
  await page.locator('button.btn').filter({ hasText: /^Powtórz \d+ zadań$/ }).click();
  await answerSession(page, true);
  await page.locator('button.btn').filter({ hasText: 'Wróć do nauki' }).click();
  await page.locator('button.btn').filter({ hasText: /^Powtórz \d+ zadań$/ }).click();
  await answerSession(page, true);
  const left = await page.evaluate(() => mistakeCount());
  if (left !== 0) errors.push('po dwóch poprawnych powtórkach zostało ' + left + ' zadań');
  console.log('  powtórka błędów: po dwóch poprawnych seriach lista pusta');

  await page.locator('button.btn').filter({ hasText: 'Wróć do nauki' }).click();
  await page.locator('button.btn').filter({ hasText: 'Przeglądaj bazę' }).click();
  const all = await page.locator('.bq').count();
  if (all !== 135) errors.push('baza pytań pokazuje ' + all + ' pytań zamiast 135');
  if (await page.locator('.bq .ans:not([hidden])').count()) errors.push('odpowiedzi w bazie widoczne przed odsłonięciem');
  await page.locator('.bq button').first().click();
  if ((await page.locator('.bq .ans:not([hidden])').count()) !== 1) errors.push('przycisk nie odsłania odpowiedzi');
  await page.fill('#baza-q', 'prozni');
  const found = await page.locator('.bq').count();
  if (!(found > 0 && found < all)) errors.push('wyszukiwanie w bazie (bez polskich znaków) nie działa: ' + found);
  console.log('  baza pytań: ' + all + ' pytań, wyszukiwanie „prozni” → ' + found);

  // Egzamin próbny: przerwany w połowie, wznowiony po odświeżeniu, dokończony
  await page.click('#nav button:has-text("Egzamin")');
  await page.locator('.menu-grid .card').nth(1).locator('button.btn').click();
  const qn = await page.locator('.qmap button').count();
  if (qn !== 15) errors.push('egzamin szybki ma ' + qn + ' pól na mapie pytań');
  for (let k = 0; k < 3; k++) { await page.locator('.opt').nth(0).click(); await page.locator('button.btn').filter({ hasText: 'Następne →' }).click(); }
  await page.locator('button.btn').filter({ hasText: 'Oznacz do sprawdzenia' }).click();
  await page.click('#nav button:has-text("Ściąga")');
  if (!(await page.locator('#hud-exam').count())) errors.push('brak licznika egzaminu przy zmianie zakładki');
  await page.reload();
  const kept = await page.evaluate(() => State.examRun && [State.examRun.answers.filter(a => a >= 0).length, State.examRun.flags.filter(Boolean).length]);
  if (!kept || kept[0] !== 3 || kept[1] !== 1) errors.push('egzamin nie przetrwał odświeżenia: ' + JSON.stringify(kept));
  await page.locator('#hud-exam').click();
  if ((await page.locator('.qmap button.ans').count()) !== 3 || (await page.locator('.qmap button.flag').count()) !== 1) errors.push('mapa pytań nie pokazuje stanu po wznowieniu');
  const t1 = await page.textContent('#exam-timer');
  await page.waitForTimeout(1300);
  if (t1 === await page.textContent('#exam-timer')) errors.push('zegar egzaminu stoi');
  await page.locator('button.btn').filter({ hasText: /^Zakończ egzamin$/ }).first().click();
  if (!/Bez odpowiedzi: 12 z 15/.test(await page.textContent('.note.warn'))) errors.push('potwierdzenie nie podaje liczby pytań bez odpowiedzi');
  await page.locator('button.btn').filter({ hasText: 'Wróć do pytań' }).click();
  if (!(await page.evaluate(() => !!State.examRun))) errors.push('„Wróć do pytań” zakończyło egzamin');
  await page.locator('button.btn').filter({ hasText: /^Zakończ egzamin$/ }).first().click();
  await page.locator('button.btn').filter({ hasText: 'Zakończ i sprawdź' }).click();
  if (!/Egzamin niezdany/.test(await page.textContent('h2'))) errors.push('niezdany egzamin próbny nierozpoznany');
  const revN = await page.locator('.rev').count();
  if (revN < 12) errors.push('przegląd pokazuje ' + revN + ' błędnych odpowiedzi, oczekiwano co najmniej 12');
  await page.locator('button.btn').filter({ hasText: 'Pokaż wszystkie' }).click();
  if ((await page.locator('.rev').count()) !== 15) errors.push('przegląd wszystkich odpowiedzi nie ma 15 pozycji');
  console.log('  egzamin próbny: wznowienie po odświeżeniu, zegar, potwierdzenie, przegląd ' + revN + ' błędów');

  // Koniec czasu kończy egzamin sam
  await page.locator('button.btn').filter({ hasText: 'Nowy egzamin' }).click();
  await page.locator('.menu-grid .card').nth(1).locator('button.btn').click();
  await page.evaluate(() => { State.examRun.start -= State.examRun.limit + 1000; save(); });
  await page.waitForTimeout(1300);
  if (!/czas minął/.test(await page.textContent('h2'))) errors.push('upływ czasu nie zakończył egzaminu');
  await page.locator('button.btn').filter({ hasText: 'Nowy egzamin' }).click();
  if ((await page.locator('table').last().locator('tr').count()) !== 3) errors.push('historia egzaminów nie ma 2 wpisów');
  console.log('  koniec czasu kończy egzamin automatycznie, historia zapisana');

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
  await page.locator('button.btn').filter({ hasText: 'Wyzeruj postęp' }).click();
  await page.locator('button.btn').filter({ hasText: 'Anuluj' }).click();
  if (!(await page.evaluate(() => totals().seen))) errors.push('Anuluj wyzerowało postęp');
  await page.locator('button.btn').filter({ hasText: 'Wyzeruj postęp' }).click();
  await page.locator('button.btn').filter({ hasText: 'Tak, usuń wszystko' }).click();
  if (await page.evaluate(() => totals().seen)) errors.push('zerowanie postępu nie działa');
  console.log('  zerowanie postępu z potwierdzeniem na stronie działa');

  await page.setViewportSize({ width: 390, height: 800 });
  for (const tab of ['Kurs', 'Nauka', 'Egzamin', 'Kalkulatory', 'Ściąga', 'Postępy']) {
    await page.click('#nav button:has-text("' + tab + '")');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 2) errors.push('poziomy scroll przy 390 px w zakładce ' + tab);
  }
  for (const view of ["UI.tab = 'kurs'; UI.module = 'm5'", "UI.tab = 'egzamin'; startExam('mock', 'full')", "UI.tab = 'nauka'; UI.nauka = 'baza'"]) {
    await page.evaluate(v => { eval(v); render(); }, view);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 2) errors.push('poziomy scroll przy 390 px: ' + view);
  }
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
