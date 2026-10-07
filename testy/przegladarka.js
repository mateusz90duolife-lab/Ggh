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
    if (await page.evaluate(() => Session.q.kind === 'sketch')) {
      // Szkic: poprawny — rozwiązanie wstawione do edytora i sprawdzone przyciskiem;
      // błędny — rezygnacja przyciskiem „Pokaż rozwiązanie".
      if (correct) {
        await page.evaluate(() => { Session.sk.segs = centerSegs(Session.sk, Session.q.lines); render(); });
        await page.locator('.sketch-box button.btn').filter({ hasText: /^Sprawdź/ }).first().click();
      } else {
        await page.locator('.sketch-box button.btn').filter({ hasText: 'Pokaż rozwiązanie' }).first().click();
      }
      await page.waitForTimeout(25);
      await page.locator('button.btn').filter({ hasText: /Dalej|Zakończ sesję/ }).first().click();
      await page.waitForTimeout(35);
      if (++n > 40) { errors.push('sesja się nie kończy'); break; }
      continue;
    }
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
    if (await page.evaluate(() => Session.q.kind === 'sketch')) {
      // szkic w treningu: rezygnacja pokazuje rozwiązanie i informację zwrotną
      await page.locator('.sketch-box button.btn').filter({ hasText: 'Pokaż rozwiązanie' }).first().click();
      await page.waitForTimeout(80);
    } else {
      const n = await page.locator('.opt').count();
      if (!n) { errors.push('brak opcji w zadaniu ' + (i + 1)); break; }
      await page.locator('.opt').nth(i % n).click();
      await page.waitForTimeout(80);
    }
    if (!(await page.locator('.fb').count())) errors.push('brak informacji zwrotnej w zadaniu ' + (i + 1));
    await page.locator('button.btn').filter({ hasText: /Dalej|Zakończ sesję/ }).first().click();
    await page.waitForTimeout(90);
  }
  console.log('  typów zadań w jednej sesji: ' + kinds.size + ' z 11');
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
  if (lessons < 15) errors.push('spodziewano się 15 lekcji, jest ' + lessons);

  await page.click('#nav button:has-text("Postępy")');
  await page.waitForTimeout(250);
  const skills = await page.locator('.skill').count();
  if (skills !== 11) errors.push('lista postępów pokazuje ' + skills + ' umiejętności zamiast 11');

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
  if (rows !== 13) errors.push('spis kursu ma ' + rows + ' pozycji zamiast 13');
  if (!(await page.locator('.mod').nth(1).evaluate(e => e.classList.contains('locked')))) errors.push('moduł 2 otwarty na starcie');
  if (!(await page.locator('.mod').nth(12).evaluate(e => e.classList.contains('locked')))) errors.push('egzamin otwarty na starcie');
  console.log('  spis: 12 modułów + egzamin, bramkowanie na starcie poprawne');

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

  for (let i = 1; i < 12; i++) {
    const id = await page.evaluate(k => COURSE[k].id, i);
    await page.evaluate(x => { Session.summary = null; UI.module = x; render(); }, id);
    await page.waitForTimeout(120);
    await page.locator('button.btn').filter({ hasText: /^Sprawdzian/ }).first().click();
    await page.waitForTimeout(150);
    await answerSession(page, true);
    if (!/Moduł zaliczony/.test(await page.textContent('h2'))) { errors.push('moduł ' + (i + 1) + ' niezaliczony'); break; }
  }
  const passed = await page.evaluate(() => passedCount());
  console.log('  zaliczonych modułów: ' + passed + ' z 12 (w tym szkicowanie, zaliczone szkicami)');
  if (passed !== 12) errors.push('nie wszystkie moduły dało się zaliczyć');

  await page.evaluate(() => { Session.summary = null; UI.module = null; render(); });
  await page.waitForTimeout(150);
  if (await page.locator('.mod').nth(12).evaluate(e => e.classList.contains('locked'))) errors.push('egzamin nie otworzył się');
  await page.locator('.mod').nth(12).click();
  await page.waitForTimeout(200);
  const nExam = await answerSession(page, true);
  console.log('  egzamin: ' + nExam + ' zadań');
  await page.locator('button.btn').filter({ hasText: /Zobacz certyfikat|Spis modułów/ }).first().click();
  await page.waitForTimeout(250);
  if (!(await page.locator('.cert').count())) errors.push('brak certyfikatu po zdanym egzaminie');

  await page.reload();
  await page.waitForTimeout(350);
  if ((await page.evaluate(() => passedCount())) !== 12 || !(await page.locator('.cert').count()))
    errors.push('postęp kursu nie przetrwał przeładowania');
  console.log('  certyfikat wystawiony i zachowany po przeładowaniu');
  await page.close();
}

async function testDostepnosc(browser) {
  console.log('\n— Dostępność —');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  watch(page, '[a11y]');
  await page.goto(APP);
  await page.waitForTimeout(250);
  await page.click('#nav button:has-text("Trening")');
  await page.waitForTimeout(150);
  await page.locator('button.btn').filter({ hasText: 'Zacznij sesję' }).first().click();
  await page.waitForTimeout(300);

  // Opcje odpowiedzi muszą być osiągalne klawiaturą i mieć etykiety
  const opts = await page.locator('.opt').count();
  const focusable = await page.evaluate(() =>
    [...document.querySelectorAll('.opt')].filter(e => e.tagName === 'BUTTON').length);
  const labelled = await page.evaluate(() =>
    [...document.querySelectorAll('.opt')].filter(e => (e.getAttribute('aria-label') || '').length > 5).length);
  if (focusable !== opts) errors.push('opcje odpowiedzi nie są przyciskami (' + focusable + '/' + opts + ')');
  if (labelled !== opts) errors.push('opcje bez etykiety dla czytnika (' + labelled + '/' + opts + ')');
  console.log('  opcji: ' + opts + ', przycisków: ' + focusable + ', z etykietą: ' + labelled);

  // Tab musi dotrzeć do odpowiedzi
  let reached = false;
  for (let i = 0; i < 30 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.opt')));
  }
  if (!reached) errors.push('Tab nie dociera do opcji odpowiedzi');
  console.log('  Tab dociera do odpowiedzi: ' + (reached ? 'tak' : 'NIE'));

  // Każde płótno jest albo opisane, albo świadomie pominięte
  const bareCanvas = await page.evaluate(() => [...document.querySelectorAll('canvas')]
    .filter(c => !c.getAttribute('aria-label') && c.getAttribute('aria-hidden') !== 'true').length);
  if (bareCanvas) errors.push(bareCanvas + ' płócien bez etykiety i bez aria-hidden');
  console.log('  płócien nieobsłużonych: ' + bareCanvas);

  // Odpowiedź z klawiatury: cyfra wybiera, Enter przechodzi dalej
  await page.keyboard.press('1');
  await page.waitForTimeout(200);
  const answered = await page.evaluate(() => Session.answered);
  if (!answered) errors.push('klawisz 1 nie wybiera odpowiedzi');
  const live = await page.locator('.fb[aria-live]').count();
  if (!live) errors.push('informacja zwrotna bez aria-live');
  console.log('  klawisz 1 wybiera odpowiedź: ' + (answered ? 'tak' : 'NIE') + ', aria-live: ' + (live ? 'tak' : 'NIE'));

  const before = await page.evaluate(() => Session.i);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => Session.i);
  if (after <= before) errors.push('Enter nie przechodzi do kolejnego zadania');
  console.log('  Enter przechodzi dalej: ' + (after > before ? 'tak' : 'NIE'));

  // Edytor planu i pozycje kursu też muszą być przyciskami
  await page.click('#nav button:has-text("Buduj")');
  await page.waitForTimeout(250);
  const cellsAreButtons = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.plan-cell')];
    return all.length > 0 && all.every(e => e.tagName === 'BUTTON' && e.getAttribute('aria-label'));
  });
  if (!cellsAreButtons) errors.push('pola edytora planu nie są opisanymi przyciskami');

  await page.click('#nav button:has-text("Kurs")');
  await page.waitForTimeout(250);
  const modsAreButtons = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.mod')];
    return all.length > 0 && all.every(e => e.tagName === 'BUTTON');
  });
  if (!modsAreButtons) errors.push('pozycje kursu nie są przyciskami');

  await page.click('#nav button:has-text("Teoria")');
  await page.waitForTimeout(250);
  const lessonsOk = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.lesson-h')];
    return all.length > 0 && all.every(e => e.tagName === 'BUTTON' && e.hasAttribute('aria-expanded'));
  });
  if (!lessonsOk) errors.push('nagłówki lekcji bez aria-expanded');
  console.log('  edytor planu, kurs i lekcje jako przyciski: ' +
    (cellsAreButtons && modsAreButtons && lessonsOk ? 'tak' : 'NIE'));
  await page.close();
}

async function testSzkic(browser) {
  console.log('\n— Szkicowanie —');
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  watch(page, '[szkic]');
  await page.goto(APP);
  await page.waitForTimeout(250);
  await page.click('#nav button:has-text("Szkicuj")');
  await page.waitForTimeout(200);
  // Rysowanie rozwiązania prawdziwymi kliknięciami: punkt A, punkt B, ponownie B (koniec odcinka)
  const pts = await page.evaluate(() => {
    const st = SketchFree.st, segs = [...centerSegs(st, SketchFree.q.lines)];
    const X = u => st.pad + u * st.s * ISO_C, Y = v => st.pad + v * st.s / 2;
    return segs.map(k => { const p = segPts(k); return [X(p[0]), Y(p[1]), X(p[2]), Y(p[3])]; });
  });
  const cv = page.locator('canvas.sketch-canvas');
  for (const [x1, y1, x2, y2] of pts) {
    await cv.click({ position: { x: x1, y: y1 } });
    await cv.click({ position: { x: x2, y: y2 } });
    await cv.click({ position: { x: x2, y: y2 } });
  }
  const drawn = await page.evaluate(() => SketchFree.st.segs.size);
  if (drawn !== pts.length) errors.push('szkic myszą: narysowano ' + drawn + ' z ' + pts.length + ' odcinków');
  await page.locator('.sketch-box button.btn').filter({ hasText: /^Sprawdź/ }).first().click();
  await page.waitForTimeout(150);
  if (!/Szkic poprawny/.test(await page.textContent('.sketch-box'))) errors.push('poprawny szkic narysowany myszą nie został uznany');
  console.log('  szkic narysowany myszą (' + drawn + ' odcinków) uznany za poprawny');

  // Klawiatura: Enter, strzałka w górę, Enter rysuje jeden pionowy odcinek
  await page.locator('button.btn').filter({ hasText: 'Następny szkic' }).click();
  await page.waitForTimeout(150);
  await page.locator('canvas.sketch-canvas').focus();
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const kb = await page.evaluate(() => SketchFree.st.segs.size);
  if (kb !== 1) errors.push('szkic klawiaturą: oczekiwano 1 odcinka, jest ' + kb);
  const live = await page.textContent('.sketch-status');
  if (!/Narysowano 1 odcinek/.test(live)) errors.push('brak komunikatu dla czytnika po narysowaniu: ' + live);
  console.log('  rysowanie z klawiatury działa, komunikat: „' + live.trim().slice(0, 40) + '…”');

  // Dwie błędne próby kończą zadanie i pokazują rozwiązanie
  await page.locator('.sketch-box button.btn').filter({ hasText: /^Sprawdź/ }).first().click();
  await page.waitForTimeout(80);
  await page.locator('.sketch-box button.btn').filter({ hasText: /^Sprawdź/ }).first().click();
  await page.waitForTimeout(120);
  if (!/Szkic niepoprawny/.test(await page.textContent('.sketch-box'))) errors.push('dwie błędne próby nie kończą zadania');
  console.log('  po dwóch błędnych próbach pokazano rozwiązanie');
  await page.close();
}

async function testPomiar(browser) {
  console.log('\n— Test wstępny i końcowy —');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  watch(page, '[pomiar]');
  await page.goto(APP);
  await page.waitForTimeout(250);

  // Test wstępny uruchomiony ze spisu kursu musi pokazać zadanie
  await page.locator('button.btn').filter({ hasText: 'Test wstępny' }).first().click();
  await page.waitForTimeout(250);
  if ((await page.textContent('#nav button.on')).trim() !== 'Trening') errors.push('test ze spisu kursu nie przełącza ekranu');
  if (!(await page.locator('.psvt').count())) errors.push('test wstępny nie jest w formacie PSVT');
  const answerAll = async (good) => {
    for (let i = 0; i < 20; i++) {
      if (!(await page.evaluate(() => Session.active))) break;
      const c = await page.evaluate(() => Session.q.correct);
      const n = await page.locator('.opt').count();
      await page.locator('.opt').nth(good(i) ? c : (c + 1) % n).click();
      await page.waitForTimeout(25);
      await page.locator('button.btn').filter({ hasText: /Dalej|Zakończ sesję/ }).first().click();
      await page.waitForTimeout(40);
    }
  };
  await answerAll(i => i < 3);                     // 3 z 8
  if (!/Test wstępny zakończony/.test(await page.textContent('h2'))) errors.push('brak podsumowania testu wstępnego');
  console.log('  test wstępny: format PSVT, uruchomiony ze spisu kursu');

  await page.click('#nav button:has-text("Trening")');
  await page.waitForTimeout(200);
  await page.locator('button.btn').filter({ hasText: 'Test końcowy' }).first().click();
  await page.waitForTimeout(250);
  await answerAll(i => i < 7);                     // 7 z 8
  const txt = await page.textContent('.card');
  if (!/Test końcowy zakończony/.test(txt)) errors.push('brak podsumowania testu końcowego');
  if (!/38% → test końcowy 88%/.test(txt)) errors.push('podsumowanie nie porównuje testów tym samym narzędziem: ' + txt.slice(0, 160));
  console.log('  test końcowy: porównanie 38% → 88% tym samym narzędziem');

  await page.click('#nav button:has-text("Teoria")');
  await page.waitForTimeout(200);
  const symbols = await page.evaluate(() => [...document.querySelectorAll('canvas[aria-label]')]
    .filter(c => /symbol metody rzutowania/.test(c.getAttribute('aria-label'))).length);
  if (symbols < 2) errors.push('w teorii brak symboli metody rzutowania (' + symbols + ')');
  console.log('  symbole metody w dziale Teoria: ' + symbols);
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  await testTrening(browser);
  await testKurs(browser);
  await testDostepnosc(browser);
  await testSzkic(browser);
  await testPomiar(browser);
  await browser.close();
  if (errors.length) { console.log('\nBŁĘDY:\n' + errors.join('\n') + '\n'); process.exit(1); }
  console.log('\nTesty w przeglądarce przeszły.\n');
})();
