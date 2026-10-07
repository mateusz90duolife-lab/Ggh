// Testy E2E w prawdziwej przeglądarce (Chromium) przeciw lokalnemu backendowi na PostgreSQL z prawdziwym RLS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ARTIFACTS, loginAs, setup } from './harness.mjs';

let env;
before(async () => {
  env = await setup({ db: 'ros_e2e' });
});
after(async () => {
  await env?.close();
});
const email = (k) => env.data.emails[env.data.ids[k]];
const pid = (name) => env.data.pid[name];

/** Test z automatycznym zrzutem ekranu przy błędzie. */
function scenario(name, fn) {
  test(name, async (t) => {
    const pages = [];
    const ctxs = [];
    const mk = async (opts) => {
      const c = await env.context(opts);
      ctxs.push(c);
      c.on('page', (p) => {
        pages.push(p);
        p.on('pageerror', (e) => console.error(`  [błąd strony] ${e.message}`));
      });
      return c;
    };
    try {
      await fn({ mk, t });
    } catch (e) {
      for (const [i, p] of pages.entries())
        await p
          .screenshot({ path: `${ARTIFACTS}/FAIL-${name.slice(0, 30).replace(/\W+/g, '_')}-${i}.png` })
          .catch(() => {});
      throw e;
    } finally {
      for (const c of ctxs) await c.close();
    }
  });
}

const toast = (page, text) =>
  page.locator('.toast', { hasText: text }).first().waitFor({ state: 'visible', timeout: 8000 });
const sqlNum = async (q) => Number(await env.be.sql(q));

async function pickProduct(page, typed, optionName) {
  await page.getByRole('combobox').fill(typed);
  await page.getByRole('option', { name: optionName }).first().click();
}
async function reportShortage(page, typed, optionName, qty, { urgent = false } = {}) {
  await page.goto(`${env.appUrl}/#/braki/nowy`);
  await page.getByRole('combobox').waitFor();
  await pickProduct(page, typed, optionName);
  await page.getByLabel('Ilość', { exact: true }).fill(String(qty));
  if (urgent) await page.getByLabel('PILNE').check();
  await page.getByRole('button', { name: 'DODAJ' }).click();
}

scenario('logowanie: błędne hasło, poprawne, przekierowanie wg roli i blokada tras', async ({ mk }) => {
  const ctx = await mk();
  const page = await ctx.newPage();
  await page.goto(`${env.appUrl}/#/login`);
  await page.getByLabel('Adres e-mail').fill('ewa@example.com');
  await page.getByLabel('Hasło').fill('zle-haslo');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByText('Nieprawidłowy e-mail lub hasło.').waitFor();
  await page.getByLabel('Adres e-mail').fill('to-nie-email');
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByText('Podaj poprawny adres e-mail.').waitFor();

  await page.getByLabel('Adres e-mail').fill('ewa@example.com');
  await page.getByLabel('Hasło').fill(env.data.password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.getByText('Cześć, Ewa!').waitFor();
  assert.match(page.url(), /#\/dzisiaj$/);

  // pracownik nie wejdzie do paneli managera i właściciela
  for (const route of ['dashboard', 'zakupy', 'pracownicy', 'ustawienia', 'audyt', 'inwentaryzacja']) {
    await page.evaluate((r) => (location.hash = `#/${r}`), route);
    await page.waitForFunction(() => location.hash === '#/dzisiaj');
    await toast(page, 'Nie masz dostępu do tej sekcji.');
  }
  // po odświeżeniu sesja jest zachowana
  await page.reload();
  await page.getByText('Cześć, Ewa!').waitFor();
  // wylogowanie
  await page.getByRole('link', { name: 'Więcej' }).click();
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await page.getByRole('button', { name: 'Zaloguj się' }).waitFor();
  await page.evaluate(() => (location.hash = '#/magazyn'));
  await page.getByRole('button', { name: 'Zaloguj się' }).waitFor();
});

scenario('manager i właściciel lądują na dashboardzie, manager nie wejdzie do paneli właściciela', async ({ mk }) => {
  const m = await loginAs(env, await mk(), email('manager'));
  await m.getByText('Cześć, Anna!').waitFor();
  assert.match(m.url(), /#\/dashboard$/);
  for (const route of ['pracownicy', 'ustawienia', 'audyt', 'szablony']) {
    await m.evaluate((r) => (location.hash = `#/${r}`), route);
    await m.waitForFunction(() => location.hash === '#/dashboard');
  }
  const o = await loginAs(env, await mk(), email('owner'));
  await o.getByText('Cześć, Jan!').waitFor();
  await o.getByText('Zakupy dzisiaj').waitFor();
  await o.evaluate(() => (location.hash = '#/pracownicy'));
  await o.getByText('Dodaj pracownika').waitFor();
});

scenario('walidacja zgłoszenia braku: brak produktu, zła ilość, brak wysyłki do serwera', async ({ mk }) => {
  const page = await loginAs(env, await mk(), email('ewa'));
  await page.goto(`${env.appUrl}/#/braki/nowy`);
  await page.getByRole('combobox').waitFor();
  const before = env.be.state.requests.filter((r) => r.includes('report_shortage')).length;
  await page.getByRole('button', { name: 'DODAJ' }).click();
  await page.getByText('Wybierz produkt z listy.').waitFor();
  await pickProduct(page, 'mlek', /Mleko 3,2%/);
  for (const [bad, msg] of [
    ['0', 'Ilość musi być większa od 0.'],
    ['-999999', 'Ilość musi być większa od 0.'],
    ['abc', 'Ilość musi być liczbą.'],
    ['100001', 'Ilość nie może przekraczać 100 000.'],
    ['', 'Podaj ilość.'],
  ]) {
    await page.getByLabel('Ilość', { exact: true }).fill(bad);
    await page.getByRole('button', { name: 'DODAJ' }).click();
    await page.getByText(msg).first().waitFor();
  }
  assert.equal(
    env.be.state.requests.filter((r) => r.includes('report_shortage')).length,
    before,
    'żadne nieprawidłowe zgłoszenie nie dotarło do serwera',
  );
  // tekst niebędący produktem z listy nie jest akceptowany
  await page.getByRole('button', { name: 'Zmień' }).click();
  await page.getByRole('combobox').fill('nie ma takiego produktu');
  await page.getByText('Brak pasujących produktów').waitFor();
  await page.getByLabel('Ilość', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'DODAJ' }).click();
  await page.getByText('Wybierz produkt z listy.').waitFor();
});

scenario('scenariusz prawdziwej restauracji: zadanie, dwa zgłoszenia, zakup, magazyn, ceny', async ({ mk }) => {
  const ewa = await loginAs(env, await mk(), email('ewa'));
  const piotr = await loginAs(env, await mk(), email('piotr'));
  const mgr = await loginAs(env, await mk(), email('manager'));

  // 10:00 pracownik kończy zadanie, manager widzi to bez odświeżania
  await mgr.goto(`${env.appUrl}/#/zadania`);
  await mgr.getByText('Posprzątać chłodnię').waitFor();
  await ewa.goto(`${env.appUrl}/#/zadania`);
  await ewa.getByRole('checkbox', { name: /Posprzątać chłodnię/ }).click();
  await ewa.getByText('Zrobione: Ewa Pracownik').waitFor();
  await mgr.getByText('Zrobione: Ewa Pracownik').waitFor({ timeout: 15000 }); // odświeżanie cykliczne, bez reloadu
  assert.equal(await sqlNum(`select count(*) from tasks where status='done' and done_by='${env.data.ids.ewa}'`), 1);

  // 12:30 brakuje mleka — 10 L (PILNE); 15:00 drugi pracownik — 5 L
  await reportShortage(ewa, 'mlek', /Mleko 3,2%/, 10, { urgent: true });
  await toast(ewa, 'Dodano: Mleko 3,2% — 10 L');
  await reportShortage(piotr, 'MLEKO', /Mleko 3,2%/, 5);
  await toast(piotr, 'Dodano: Mleko 3,2% — 5 L');

  // lista zakupów łączy zgłoszenia: MLEKO — 15 L
  await mgr.goto(`${env.appUrl}/#/zakupy`);
  const row = mgr.locator('.item', { hasText: 'Mleko 3,2%' }).first();
  await row.getByText('15 L').waitFor();
  await row.getByText('2 zgłoszenia').waitFor();
  await row.getByText('PILNE').waitFor();

  // 18:00 manager robi zakup: 20 L po 5,40 netto, VAT 5%
  await row.getByRole('checkbox').check();
  await mgr.getByRole('button', { name: /Zapisz zakup z zaznaczonych \(1\)/ }).click();
  await mgr.getByRole('heading', { name: 'Pozycje' }).waitFor();
  const qty = mgr.locator('.line-item').first().getByLabel('Ilość');
  assert.equal(await qty.inputValue(), '15');
  await qty.fill('20');
  await mgr.locator('.line-item').first().getByLabel('Cena netto za jedn.').fill('5,40');
  await mgr.locator('.line-item').first().getByLabel('VAT').selectOption('5');
  await mgr.getByText('113,40 zł').first().waitFor();
  await mgr.getByRole('button', { name: 'Zatwierdź zakup' }).click();
  await mgr.locator('.modal').getByRole('button', { name: 'Zatwierdź zakup' }).click();
  await mgr.getByText('Zatwierdzony', { exact: true }).waitFor();
  await mgr.getByText('113,40 zł').first().waitFor();

  // magazyn: +20 L (12 → 32), braki zamknięte, cena w historii
  assert.equal(
    await sqlNum(`select sum(quantity_delta) from inventory_movements where product_id='${pid('Mleko 3,2%')}'`),
    32,
  );
  assert.equal(await sqlNum(`select count(*) from shortages where status='open'`), 0);
  assert.equal(await sqlNum(`select count(*) from shortages where status='resolved'`), 2);
  assert.equal(await sqlNum(`select last_price from price_trend where product_id='${pid('Mleko 3,2%')}'`), 5.4);
  await mgr.goto(`${env.appUrl}/#/zakupy`);
  await mgr.getByText('Lista zakupów jest pusta').waitFor();
});

scenario('magazyn: pracownik widzi stany bez historii i cen, manager widzi historię ruchów', async ({ mk }) => {
  const ewa = await loginAs(env, await mk(), email('ewa'));
  await ewa.goto(`${env.appUrl}/#/magazyn`);
  const mleko = ewa.locator('a.item', { hasText: 'Mleko 3,2%' });
  await mleko.getByText('Stan OK').waitFor();
  await ewa.locator('a.item', { hasText: 'Ser żółty' }).getByText('BRAK').waitFor();
  await ewa.locator('a.item', { hasText: 'Śmietana' }).getByText('Niski stan').waitFor();
  assert.equal(await ewa.getByRole('button', { name: '+ Produkt' }).count(), 0);
  await ewa.getByText('Niski stan i braki').click();
  assert.equal(await ewa.locator('a.item', { hasText: 'Mąka' }).count(), 0);
  await ewa.locator('a.item', { hasText: 'Śmietana' }).click();
  await ewa.locator('h2', { hasText: 'Śmietana' }).waitFor();
  assert.equal(await ewa.getByText('Historia ruchów').count(), 0, 'pracownik nie widzi historii');
  assert.equal(await ewa.getByText('Ostatnia cena netto').count(), 0, 'pracownik nie widzi cen');
  assert.equal(await ewa.locator('.row-actions').getByRole('button', { name: 'Zużycie' }).count(), 0);

  const mgr = await loginAs(env, await mk(), email('manager'));
  await mgr.goto(`${env.appUrl}/#/magazyn/${pid('Mleko 3,2%')}`);
  await mgr.getByText('Historia ruchów').waitFor();
  await mgr.getByText('+20 L').waitFor();
  await mgr.getByText('Zakup', { exact: true }).first().waitFor();
  await mgr.getByText('Ostatnia cena netto').waitFor();
  await mgr
    .getByText(/5,40 zł/)
    .first()
    .waitFor();
});

scenario('ruchy magazynowe: walidacja, odpad, zużycie i alert niskiego stanu (jeden powiadomienie)', async ({ mk }) => {
  const mgr = await loginAs(env, await mk(), email('manager'));
  await mgr.goto(`${env.appUrl}/#/magazyn/${pid('Mleko 3,2%')}`);
  await mgr.locator('.row-actions').getByRole('button', { name: 'Odpad' }).click();
  const modal = mgr.locator('.modal');
  for (const bad of ['abc', '0', '-5', '']) {
    await modal.getByLabel(/Ilość/).fill(bad);
    await modal.getByRole('button', { name: 'Zapisz' }).click();
    await modal.locator('.field-error').first().waitFor({ state: 'visible' });
  }
  const movesBefore = await sqlNum(`select count(*) from inventory_movements where product_id='${pid('Mleko 3,2%')}'`);
  await modal.getByLabel(/Ilość/).fill('2');
  await modal.getByText('Stan po zapisaniu: 30 L').waitFor();
  await modal.getByRole('button', { name: 'Zapisz' }).click();
  await toast(mgr, 'Zapisano: odpad -2 L');
  assert.equal(
    await sqlNum(`select count(*) from inventory_movements where product_id='${pid('Mleko 3,2%')}'`),
    movesBefore + 1,
  );

  // zużycie 25 L → stan 5 L < minimum 10 → alert
  await mgr.locator('.row-actions').getByRole('button', { name: 'Zużycie' }).click();
  await mgr.locator('.modal').getByLabel(/Ilość/).fill('25');
  await mgr.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
  await toast(mgr, 'Zapisano: zużycie -25 L');
  await mgr.getByText('Niski stan').first().waitFor();
  assert.equal(await sqlNum(`select count(*) from notifications where type='low_stock' and title like '%Mleko%'`), 1);
  // kolejne zużycie nie duplikuje powiadomienia
  await mgr.locator('.row-actions').getByRole('button', { name: 'Zużycie' }).click();
  await mgr.locator('.modal').getByLabel(/Ilość/).fill('1');
  await mgr.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
  await toast(mgr, 'Zapisano: zużycie -1 L');
  assert.equal(await sqlNum(`select count(*) from notifications where type='low_stock' and title like '%Mleko%'`), 1);
  // ostrzeżenie przy zejściu poniżej zera
  await mgr.locator('.row-actions').getByRole('button', { name: 'Zużycie' }).click();
  await mgr.locator('.modal').getByLabel(/Ilość/).fill('100');
  await mgr.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
  await mgr.getByText('Stan spadnie poniżej zera').waitFor();
  await mgr.getByRole('button', { name: 'Anuluj' }).click();
  assert.equal(
    await sqlNum(`select sum(quantity_delta) from inventory_movements where product_id='${pid('Mleko 3,2%')}'`),
    4,
  );

  await mgr.goto(`${env.appUrl}/#/dashboard`);
  await mgr
    .getByText(/poniżej minimum/)
    .first()
    .waitFor();
  await mgr.getByText('Niski stan: Mleko 3,2%').waitFor();
});

scenario('inwentaryzacja: różnice na żywo, korekta stanu, historia', async ({ mk }) => {
  const mgr = await loginAs(env, await mk(), email('manager'));
  await mgr.goto(`${env.appUrl}/#/inwentaryzacja`);
  const row = mgr.locator('.item', { hasText: 'Pomidor' });
  await row.getByLabel(/Stan rzeczywisty: Pomidor/).fill('6');
  await row.getByText('różnica -2 kg').waitFor();
  await mgr.getByRole('button', { name: 'Zatwierdź inwentaryzację' }).click();
  await mgr
    .locator('.modal')
    .getByText(/Policzono 1 produkt, różnice w 1/)
    .waitFor();
  await mgr.locator('.modal').getByRole('button', { name: 'Zatwierdź' }).click();
  await toast(mgr, 'Inwentaryzacja zapisana. Skorygowano: 1.');
  assert.equal(
    await sqlNum(`select sum(quantity_delta) from inventory_movements where product_id='${pid('Pomidor')}'`),
    6,
  );
  assert.equal(await sqlNum(`select count(*) from inventory_counts`), 1);
  await mgr.goto(`${env.appUrl}/#/magazyn/${pid('Pomidor')}`);
  await mgr.locator('.item-title', { hasText: 'Inwentaryzacja' }).first().waitFor();
  await mgr.locator('.item-end', { hasText: '-2 kg' }).waitFor();
});

scenario('e-mail z listą zakupów: raz dziennie, treść, ręczna wysyłka', async ({ mk }) => {
  const be = env.be;
  await be.sql(`insert into shortages (restaurant_id, product_id, quantity, unit, urgent, reported_by) values
    ('${env.data.ids.rest}', '${pid('Pomidor')}', 12, 'kg', false, '${env.data.ids.ewa}'),
    ('${env.data.ids.rest}', '${pid('Kurczak')}', 15, 'kg', true, '${env.data.ids.ewa}');`);
  const call = (token) =>
    fetch(`${be.url}/functions/v1/daily-shopping-summary`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
  const mails = () => be.state.mails.filter((m) => m.kind === 'mail');

  be.state.clock = '2026-10-07T18:30:00Z'; // 20:30 lokalnie — za wcześnie
  assert.equal((await call('cron-secret')).status, 200);
  assert.equal(mails().length, 0);
  be.state.clock = '2026-10-07T19:30:00Z'; // 21:30 lokalnie
  assert.equal((await call('cron-secret')).status, 200);
  assert.equal(mails().length, 1);
  const m = mails()[0];
  assert.deepEqual(m.to, ['wlasciciel@example.com']);
  assert.equal(m.subject, 'Lista zakupów restauracji — 08.10.2026');
  assert.match(m.text, /PILNE\n• Kurczak — 15 kg/);
  assert.match(m.text, /WARZYWA\n• Pomidor — 12 kg/);
  assert.equal((await call('zly-sekret')).status, 401);
  await call('cron-secret');
  await call('cron-secret');
  assert.equal(mails().length, 1, 'kolejne wywołania tego samego dnia nie wysyłają maila');
  assert.equal(await sqlNum(`select count(*) from email_log where status='sent'`), 1);

  // ręczna wysyłka z aplikacji (manager) — wiele razy dozwolone; pracownik nie może
  const mgr = await loginAs(env, await mk(), email('manager'));
  await mgr.goto(`${env.appUrl}/#/zakupy`);
  await mgr.getByRole('button', { name: 'Wyślij mailem' }).click();
  await toast(mgr, 'Wysłano listę na 1 adres e-mail.');
  assert.equal(mails().length, 2);
  const ewaLogin = await fetch(`${be.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ewa@example.com', password: env.data.password }),
  }).then((r) => r.json());
  assert.equal((await call(ewaLogin.access_token)).status, 403);
  be.state.clock = null;
});

scenario(
  'właściciel: pracownicy (utwórz, zaloguj, dezaktywuj), szablony, ustawienia, historia zmian',
  async ({ mk }) => {
    const owner = await loginAs(env, await mk(), email('owner'));
    await owner.goto(`${env.appUrl}/#/pracownicy`);
    await owner.getByText('Dodaj pracownika').click();
    const modal = owner.locator('.modal');
    await modal.getByLabel('Imię i nazwisko').fill('Marek Nowak');
    await modal.getByLabel(/Adres e-mail/).fill('marek@example.com');
    const password = await modal.getByLabel('Hasło tymczasowe').inputValue();
    assert.ok(password.length >= 8);
    await modal.getByRole('button', { name: 'Utwórz konto' }).click();
    await modal.getByText('Konto utworzone: Marek Nowak').waitFor();
    await modal.getByRole('button', { name: 'Gotowe' }).click();

    const marek = await loginAs(env, await mk(), 'marek@example.com', password);
    await marek.getByText('Cześć, Marek!').waitFor();
    assert.equal(await sqlNum(`select count(*) from profiles where full_name='Marek Nowak' and role='employee'`), 1);

    // duplikat adresu
    await owner.getByText('Dodaj pracownika').click();
    await owner.locator('.modal').getByLabel('Imię i nazwisko').fill('Drugi Marek');
    await owner
      .locator('.modal')
      .getByLabel(/Adres e-mail/)
      .fill('marek@example.com');
    await owner.locator('.modal').getByRole('button', { name: 'Utwórz konto' }).click();
    await toast(owner, 'Konto z tym adresem e-mail już istnieje.');
    await owner.locator('.modal').getByRole('button', { name: 'Zamknij' }).click();

    // własna rola jest zablokowana
    await owner.getByRole('button', { name: /Jan Właściciel/ }).click();
    assert.ok(await owner.locator('.modal select').isDisabled());
    assert.equal(await owner.getByRole('button', { name: 'Dezaktywuj konto' }).count(), 0);
    await owner.locator('.modal').getByRole('button', { name: 'Zamknij' }).click();

    // dezaktywacja: Marek traci dostęp, nie może się zalogować
    await owner.getByRole('button', { name: /Marek Nowak/ }).click();
    await owner.getByRole('button', { name: 'Dezaktywuj konto' }).click();
    await owner.locator('.modal').getByRole('button', { name: 'Dezaktywuj', exact: true }).click();
    await toast(owner, 'Konto dezaktywowane.');
    const ctx2 = await mk();
    const page2 = await ctx2.newPage();
    await page2.goto(`${env.appUrl}/#/login`);
    await page2.getByLabel('Adres e-mail').fill('marek@example.com');
    await page2.getByLabel('Hasło').fill(password);
    await page2.getByRole('button', { name: 'Zaloguj się' }).click();
    await page2.getByText(/zablokowane/).waitFor();
    assert.equal(await sqlNum(`select count(*) from profiles where full_name='Marek Nowak' and active=false`), 1);
    // dotychczasowa sesja Marka nie ma już dostępu do danych (RLS odcina natychmiast)
    await marek.goto(`${env.appUrl}/#/magazyn`);
    await marek.waitForTimeout(500);
    assert.equal(await marek.locator('a.item').count(), 0);

    // szablon zadań
    await owner.goto(`${env.appUrl}/#/szablony`);
    await owner.getByText('Posprzątać chłodnię').waitFor();
    await owner.getByText('Nowy szablon').click();
    await owner.locator('.modal').getByLabel('Nazwa zadania').fill('Inwentaryzacja lodówek');
    await owner.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
    await owner.getByText('Zaznacz co najmniej jeden dzień.').waitFor();
    await owner.locator('.modal').getByRole('button', { name: 'pn', exact: true }).click();
    await owner.locator('.modal').getByRole('button', { name: 'pt', exact: true }).click();
    await owner.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
    await toast(owner, 'Zapisano szablon.');
    assert.deepEqual(
      await env.be.sql(`select days_of_week from task_templates where title='Inwentaryzacja lodówek'`),
      '{1,5}',
    );

    // ustawienia
    await owner.goto(`${env.appUrl}/#/ustawienia`);
    await owner
      .getByLabel('Odbiorcy e-maila z listą zakupów')
      .fill('szef@example.com\nksiegowa@example.com\nszef@example.com');
    await owner.getByLabel('Strefa czasu').fill('Mars/Olympus');
    await owner.getByRole('button', { name: 'Zapisz ustawienia' }).click();
    await owner.getByText('Nieznana strefa czasu').waitFor();
    await owner.getByLabel('Strefa czasu').fill('Europe/Warsaw');
    await owner.getByLabel('Odbiorcy e-maila z listą zakupów').fill('szef@example.com\nzly-adres');
    await owner.getByRole('button', { name: 'Zapisz ustawienia' }).click();
    await owner.getByText('Niepoprawny adres e-mail: zly-adres').waitFor();
    await owner
      .getByLabel('Odbiorcy e-maila z listą zakupów')
      .fill('szef@example.com\nksiegowa@example.com\nszef@example.com');
    await owner.getByRole('button', { name: 'Zapisz ustawienia' }).click();
    await toast(owner, 'Ustawienia zapisane.');
    assert.equal(await env.be.sql(`select summary_emails from restaurants`), '{szef@example.com,ksiegowa@example.com}');

    // historia zmian: KTO · CO · KIEDY
    await owner.goto(`${env.appUrl}/#/audyt`);
    await owner.getByText('Zgłoszono brak: Mleko 3,2% — 10 L (PILNE)').waitFor();
    await owner
      .locator('.item', { hasText: 'Zgłoszono brak: Mleko 3,2% — 10 L' })
      .getByText(/Ewa Pracownik · \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/)
      .waitFor();
    await owner.getByText(/Zapisano ruch \(odpad\): Mleko 3,2% -2 L/).waitFor();
    await owner.getByText('Zatwierdzono zakup').waitFor();
    await owner.getByText(/Utworzono konto: Marek Nowak/).waitFor();
  },
);

scenario('tryb offline: zgłoszenie zapisuje się lokalnie i wysyła raz po powrocie internetu', async ({ mk }) => {
  const ctx = await mk();
  const page = await loginAs(env, ctx, email('piotr'));
  await page.goto(`${env.appUrl}/#/braki/nowy`); // pobiera katalog do pamięci podręcznej
  await page.getByRole('combobox').waitFor();
  await page.goto(`${env.appUrl}/#/dzisiaj`);
  await page.getByText('Cześć, Piotr!').waitFor();
  await ctx.setOffline(true);
  await page.goto(`${env.appUrl}/#/braki/nowy`);
  await page.getByRole('combobox').waitFor();
  await pickProduct(page, 'maka', /Mąka/); // wyszukiwanie bez polskich znaków
  await page.getByLabel('Ilość', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'DODAJ' }).click();
  await toast(page, 'Brak internetu — zapisano na telefonie: Mąka — 7 kg');
  await page.getByText(/zapisana akcja czeka na wysłanie/).waitFor();
  await page
    .getByText(/Tryb offline|Brak połączenia/)
    .first()
    .waitFor();
  assert.equal(await sqlNum(`select count(*) from shortages where product_id='${pid('Mąka')}'`), 0);

  await ctx.setOffline(false);
  await page.getByText(/zapisana akcja czeka na wysłanie/).waitFor({ state: 'detached', timeout: 25000 });
  await page.waitForFunction(() => !document.querySelector('.banner-offline'), null, { timeout: 15000 });
  assert.equal(await sqlNum(`select count(*) from shortages where product_id='${pid('Mąka')}'`), 1);
  assert.equal(await sqlNum(`select quantity from shortages where product_id='${pid('Mąka')}'`), 7);
  await page.waitForTimeout(2500);
  assert.equal(
    await sqlNum(`select count(*) from shortages where product_id='${pid('Mąka')}'`),
    1,
    'brak duplikatów po synchronizacji',
  );
});

scenario('odhaczanie zadania offline trafia do kolejki i synchronizuje się', async ({ mk }) => {
  const ctx = await mk();
  const page = await loginAs(env, ctx, email('piotr'));
  await page.goto(`${env.appUrl}/#/zadania`);
  await page.getByRole('checkbox', { name: /Przygotować sosy/ }).waitFor();
  await ctx.setOffline(true);
  await page.getByRole('checkbox', { name: /Przygotować sosy/ }).click();
  await page.getByText(/oczekuje na wysłanie/).waitFor();
  assert.equal(await sqlNum(`select count(*) from tasks where title='Przygotować sosy' and status='done'`), 0);
  await ctx.setOffline(false);
  await page.getByText(/oczekuje na wysłanie/).waitFor({ state: 'detached', timeout: 25000 });
  assert.equal(
    await sqlNum(
      `select count(*) from tasks where title='Przygotować sosy' and status='done' and done_by='${env.data.ids.piotr}'`,
    ),
    1,
  );
});

scenario('reset hasła: link z e-maila, nowe hasło, logowanie; wygasły link', async ({ mk }) => {
  const ctx = await mk();
  const page = await ctx.newPage();
  await page.goto(`${env.appUrl}/#/zapomniane-haslo`);
  await page.getByLabel(/Adres e-mail konta/).fill('nie-istnieje@example.com');
  await Promise.all([
    page.waitForResponse(/auth\/v1\/recover/),
    page.getByRole('button', { name: 'Wyślij link' }).click(),
  ]);
  await page.getByText(/Jeśli konto o tym adresie istnieje/).waitFor();
  assert.equal(env.be.state.mails.filter((m) => m.kind === 'recovery').length, 0, 'nie ujawniamy, czy konto istnieje');
  await page.getByLabel(/Adres e-mail konta/).fill('piotr@example.com');
  await Promise.all([
    page.waitForResponse(/auth\/v1\/recover/),
    page.getByRole('button', { name: 'Wyślij link' }).click(),
  ]);
  await page.getByText(/Jeśli konto o tym adresie istnieje/).waitFor();
  const link = env.be.state.mails.filter((m) => m.kind === 'recovery').at(-1).link;
  assert.ok(link.includes('type=recovery'));

  await page.goto(link);
  await page.getByRole('heading', { name: 'Restaurant OS' }).waitFor();
  await page.getByLabel('Nowe hasło', { exact: true }).fill('krotkie');
  await page.getByLabel('Powtórz nowe hasło').fill('krotkie');
  await page.getByRole('button', { name: 'Zapisz hasło' }).click();
  await page.getByText('Hasło musi mieć co najmniej 8 znaków.').first().waitFor();
  await page.getByLabel('Nowe hasło', { exact: true }).fill('NoweHaslo123');
  await page.getByLabel('Powtórz nowe hasło').fill('Inne12345');
  await page.getByRole('button', { name: 'Zapisz hasło' }).click();
  await page.getByText('Hasła nie są takie same.').first().waitFor();
  await page.getByLabel('Powtórz nowe hasło').fill('NoweHaslo123');
  await page.getByRole('button', { name: 'Zapisz hasło' }).click();
  await toast(page, 'Hasło zostało zmienione.');
  await page.getByText('Cześć, Piotr!').waitFor();
  assert.ok(!page.url().includes('access_token'), 'tokeny nie zostają w adresie');

  const page2 = await loginAs(env, await mk(), 'piotr@example.com', 'NoweHaslo123');
  await page2.getByText('Cześć, Piotr!').waitFor();
  await env.be.sql(`update auth.fake_users set password='${env.data.password}' where email='piotr@example.com'`);

  const page3 = await (await mk()).newPage();
  await page3.goto(`${env.appUrl}/#error=access_denied&error_code=otp_expired&error_description=expired`);
  await page3.getByText(/Link wygasł lub został już użyty/).waitFor();
});

scenario('sesja: token odświeża się automatycznie przed wygaśnięciem', async ({ mk }) => {
  env.be.state.ttl = 65; // aplikacja odświeża token, gdy zostaje < 60 s
  try {
    const page = await loginAs(env, await mk(), email('ewa'));
    await page.waitForTimeout(7000);
    const before = env.be.state.requests.filter((r) => r.includes('grant_type=refresh_token')).length;
    await page.evaluate(() => (location.hash = '#/magazyn'));
    await page.locator('a.item', { hasText: 'Mleko 3,2%' }).waitFor();
    const after = env.be.state.requests.filter((r) => r.includes('grant_type=refresh_token')).length;
    assert.ok(after > before, 'wykonano odświeżenie tokenu');
    await page.getByRole('link', { name: 'Zadania' }).click();
    await page.getByText('Zadania na dziś').first().waitFor();
  } finally {
    env.be.state.ttl = 3600;
  }
});

const VIEWPORTS = [
  [360, 800],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1280, 800],
  [1440, 900],
];
scenario('responsywność: brak poziomego scrolla i właściwa nawigacja na 6 rozmiarach ekranu', async ({ mk }) => {
  for (const [w, h] of VIEWPORTS) {
    const ctx = await mk({ viewport: { width: w, height: h } });
    const ewa = await loginAs(env, ctx, email('ewa'));
    const check = async (page, label) => {
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        bottom: getComputedStyle(document.querySelector('.bottom-nav')).display,
        side: getComputedStyle(document.querySelector('.sidebar')).display,
      }));
      assert.ok(m.sw <= m.cw + 1, `${label} @${w}: poziomy scroll (${m.sw} > ${m.cw})`);
      if (w >= 1024)
        assert.ok(m.bottom === 'none' && m.side !== 'none', `${label} @${w}: panel boczny zamiast dolnego menu`);
      else assert.ok(m.bottom !== 'none' && m.side === 'none', `${label} @${w}: dolne menu na telefonie/tablecie`);
      if (w === 360 || w === 1440) await page.screenshot({ path: `${ARTIFACTS}/rwd-${label}-${w}.png` });
    };
    await check(ewa, 'dzisiaj');
    for (const [route, label, marker] of [
      ['magazyn', 'magazyn', 'Mleko 3,2%'],
      ['braki/nowy', 'zglos-brak', null],
      ['zadania', 'zadania', 'Zadania na dziś'],
      ['wiecej', 'wiecej', 'Zmień hasło'],
    ]) {
      await ewa.goto(`${env.appUrl}/#/${route}`);
      if (marker) await ewa.getByText(marker).first().waitFor();
      else await ewa.getByRole('combobox').waitFor();
      await check(ewa, label);
    }
    const mgr = await loginAs(env, await mk({ viewport: { width: w, height: h } }), email('manager'));
    await mgr.getByText('Cześć, Anna!').waitFor();
    await check(mgr, 'dashboard');
    await mgr.goto(`${env.appUrl}/#/zakupy`);
    await mgr.getByRole('tab', { name: 'Lista zakupów' }).waitFor();
    await check(mgr, 'zakupy');
    await mgr.goto(`${env.appUrl}/#/zakupy/nowy`);
    await mgr.getByRole('heading', { name: 'Pozycje' }).waitFor();
    await check(mgr, 'nowy-zakup');
    const owner = await loginAs(env, await mk({ viewport: { width: w, height: h } }), email('owner'));
    await owner.goto(`${env.appUrl}/#/pracownicy`);
    await owner.getByText('Dodaj pracownika').waitFor();
    await check(owner, 'pracownicy');
    await owner.goto(`${env.appUrl}/#/audyt`);
    await owner.getByText('Co', { exact: true }).waitFor();
    await check(owner, 'audyt');
  }
});

scenario('PWA: manifest, ikony, service worker i otwarcie aplikacji bez internetu', async ({ mk }) => {
  const ctx = await mk();
  const page = await ctx.newPage();
  await page.goto(`${env.appUrl}/#/login`);
  const mf = await (await fetch(`${env.appUrl}/manifest.webmanifest`)).json();
  assert.equal(mf.display, 'standalone');
  assert.equal(mf.lang, 'pl');
  assert.ok(
    mf.icons.some((i) => i.sizes === '192x192') &&
      mf.icons.some((i) => i.sizes === '512x512') &&
      mf.icons.some((i) => i.purpose === 'maskable'),
  );
  for (const i of mf.icons) assert.equal((await fetch(`${env.appUrl}/${i.src}`)).status, 200, i.src);
  assert.equal(await page.locator('link[rel=manifest]').count(), 1);
  assert.equal(await page.locator('meta[name=theme-color]').count(), 1);
  assert.equal(await page.locator('link[rel=apple-touch-icon]').count(), 1);

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  await page.getByRole('button', { name: 'Zaloguj się' }).waitFor();
  await ctx.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Zaloguj się' }).waitFor({ timeout: 10000 });
  await page.getByRole('heading', { name: 'Restaurant OS' }).waitFor();
  await ctx.setOffline(false);
});

scenario('katalog i dostawcy: dodanie produktu, duplikat nazwy, kategorie, „nie ma na liście”', async ({ mk }) => {
  const mgr = await loginAs(env, await mk(), email('manager'));
  await mgr.goto(`${env.appUrl}/#/magazyn`);
  await mgr.getByRole('button', { name: 'Produkt' }).click();
  const modal = mgr.locator('.modal');
  await modal.getByRole('button', { name: 'Dodaj produkt' }).click();
  await modal.getByText('Podaj nazwę.').waitFor();
  await modal.getByLabel('Nazwa').fill('Szafran');
  await modal.getByLabel('Jednostka').selectOption('g');
  await modal.getByLabel(/Minimalny stan/).fill('-3');
  await modal.getByRole('button', { name: 'Dodaj produkt' }).click();
  await modal.getByText('Ilość musi być większa od 0.').waitFor();
  await modal.getByLabel(/Minimalny stan/).fill('5');
  await modal.getByRole('button', { name: 'Dodaj produkt' }).click();
  await toast(mgr, 'Dodano produkt: Szafran');
  await mgr.getByText('Szafran').first().waitFor();
  await mgr.getByRole('button', { name: 'Produkt' }).click();
  await mgr.locator('.modal').getByLabel('Nazwa').fill('szafran');
  await mgr.locator('.modal').getByRole('button', { name: 'Dodaj produkt' }).click();
  await mgr.getByText('Produkt o tej nazwie już istnieje.').waitFor();
  await mgr.locator('.modal').getByRole('button', { name: 'Zamknij' }).click();

  // pracownik prosi o dodanie produktu → zadanie dla managera
  const ewa = await loginAs(env, await mk(), email('ewa'));
  await ewa.goto(`${env.appUrl}/#/braki/nowy`);
  await ewa.getByRole('button', { name: 'Nie ma na liście?' }).click();
  await ewa.locator('.modal').getByLabel('Nazwa produktu').fill('Trufle');
  await ewa.locator('.modal').getByRole('button', { name: 'Poproś o dodanie' }).click();
  await toast(ewa, 'Wysłano prośbę do managera.');
  await mgr.goto(`${env.appUrl}/#/zadania`);
  await mgr.getByText('Dodać produkt: Trufle').waitFor();

  // kategorie i dostawcy
  await mgr.goto(`${env.appUrl}/#/kategorie`);
  await mgr.getByRole('button', { name: 'Nowa kategoria' }).click();
  await mgr.locator('.modal').getByLabel('Nazwa kategorii').fill('Nabiał');
  await mgr.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
  await mgr.getByText('Kategoria o tej nazwie już istnieje.').waitFor();
  await mgr.locator('.modal').getByLabel('Nazwa kategorii').fill('Napoje');
  await mgr.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
  await toast(mgr, 'Zapisano kategorię.');
  await mgr.goto(`${env.appUrl}/#/dostawcy`);
  await mgr.getByRole('button', { name: 'Nowy dostawca' }).click();
  await mgr.locator('.modal').getByLabel('Nazwa', { exact: true }).fill('Hurtownia Smaków');
  await mgr
    .locator('.modal')
    .getByLabel(/E-mail/)
    .fill('zle');
  await mgr.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
  await mgr.getByText('Podaj poprawny adres e-mail.').waitFor();
  await mgr
    .locator('.modal')
    .getByLabel(/E-mail/)
    .fill('');
  await mgr.locator('.modal').getByRole('button', { name: 'Zapisz' }).click();
  await toast(mgr, 'Zapisano dostawcę.');
  await mgr.getByText('Hurtownia Smaków').waitFor();
});

scenario('zakupy: szkic nie rusza magazynu, walidacja pozycji, anulowanie szkicu', async ({ mk }) => {
  const mgr = await loginAs(env, await mk(), email('manager'));
  await mgr.goto(`${env.appUrl}/#/zakupy/nowy`);
  await mgr.getByRole('heading', { name: 'Pozycje' }).waitFor();
  await mgr.getByRole('button', { name: 'Zatwierdź zakup' }).click();
  await mgr.getByText('Wybierz produkt z listy.').waitFor();
  const line = mgr.locator('.line-item').first();
  await line.getByPlaceholder('Wpisz nazwę produktu…').fill('mak');
  await mgr.getByRole('option', { name: /Mąka/ }).click();
  await line.getByLabel('Ilość').fill('-4');
  await line.getByLabel('Cena netto za jedn.').fill('abc');
  await mgr.getByRole('button', { name: 'Szkic' }).click();
  await mgr.getByText('Ilość musi być większa od 0.').waitFor();
  await mgr.getByText('Cena musi być liczbą.').waitFor();
  await line.getByLabel('Ilość').fill('10');
  await line.getByLabel('Cena netto za jedn.').fill('3,20');
  const stock = () => sqlNum(`select sum(quantity_delta) from inventory_movements where product_id='${pid('Mąka')}'`);
  const before = await stock();
  await mgr.getByRole('button', { name: 'Szkic' }).click();
  await mgr.getByText('Szkic', { exact: true }).waitFor();
  assert.equal(await stock(), before, 'szkic nie zmienia stanu');
  await mgr.getByRole('button', { name: 'Anuluj szkic' }).click();
  await mgr.locator('.modal').getByRole('button', { name: 'Anuluj szkic' }).click();
  await mgr.getByText('Anulowany', { exact: true }).waitFor();
  assert.equal(await stock(), before);
  await mgr.goto(`${env.appUrl}/#/zakupy?tab=historia`);
  await mgr.getByText('Zatwierdzony', { exact: true }).first().waitFor();
  await mgr.getByText('Anulowany', { exact: true }).first().waitFor();
});

scenario('katalog z ilustracjami i szybki wybór kafelkami w „Zgłoś brak”', async ({ mk }) => {
  const mgr = await loginAs(env, await mk({ viewport: { width: 360, height: 780 } }), email('manager'));
  await mgr.goto(`${env.appUrl}/#/magazyn`);
  await mgr.getByRole('link', { name: 'Katalog' }).click();
  await mgr.getByRole('tab', { name: /Mięso/ }).waitFor();
  // brak zaznaczenia → podpowiedź, nic nie zapisujemy
  await mgr.getByRole('button', { name: 'Zaznacz produkty do dodania' }).click();
  await toast(mgr, 'Najpierw zaznacz produkty');
  await mgr.getByRole('tab', { name: /Zupy/ }).click();
  await mgr.getByRole('button', { name: /^Rosół/ }).click();
  await mgr.getByRole('button', { name: /^Żurek/ }).click();
  await mgr.getByRole('tab', { name: /Mięso/ }).click();
  await mgr.getByRole('button', { name: /^Boczek/ }).click();
  await mgr.getByRole('tab', { name: /Zupy \(2\)/ }).waitFor();
  await mgr.screenshot({ path: `${ARTIFACTS}/katalog-360.png` });
  const m = await mgr.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(m[0] <= m[1] + 1, `katalog: poziomy scroll ${m[0]} > ${m[1]}`);
  await mgr.getByRole('button', { name: 'Dodaj 3 produkty do magazynu' }).click();
  await toast(mgr, 'Dodano 3 produkty');
  assert.equal(
    await env.be.sql(
      `select string_agg(p.name || ':' || p.icon || ':' || coalesce(c.name, '-'), ',' order by p.name) from products p left join product_categories c on c.id = p.category_id where p.name in ('Rosół','Żurek','Boczek')`,
    ),
    'Boczek:🥓:Mięso,Rosół:🍲:Zupy,Żurek:🥣:Zupy',
    'produkty z ikonami; brakująca kategoria „Zupy” utworzona, istniejąca „Mięso” użyta ponownie',
  );
  await mgr.getByRole('tab', { name: /Zupy/ }).click();
  await mgr.getByRole('button', { name: 'Rosół — już w magazynie' }).waitFor();
  assert.ok(await mgr.getByRole('button', { name: 'Rosół — już w magazynie' }).isDisabled());
  // nowy produkt bez stanu i bez minimum nie jest „BRAKIEM”
  await mgr.goto(`${env.appUrl}/#/magazyn`);
  await mgr.locator('a.item', { hasText: 'Rosół' }).getByText('Bez stanu').waitFor();

  // pracownik: kafelki → produkt wybrany bez pisania
  const ewa = await loginAs(env, await mk({ viewport: { width: 360, height: 780 } }), email('ewa'));
  await ewa.goto(`${env.appUrl}/#/braki/nowy`);
  await ewa.getByRole('tab', { name: /Zupy/ }).click();
  await ewa.getByRole('listitem', { name: 'Wybierz: Rosół' }).click();
  await ewa.locator('.picker .item-title', { hasText: 'Rosół' }).waitFor();
  await ewa.screenshot({ path: `${ARTIFACTS}/szybki-wybor-360.png`, fullPage: true });
  await ewa.getByLabel('Ilość', { exact: true }).fill('5');
  await ewa.getByRole('button', { name: 'DODAJ' }).click();
  await toast(ewa, 'Dodano: Rosół — 5 L');
  const e = await ewa.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(e[0] <= e[1] + 1, `zgłoś brak: poziomy scroll ${e[0]} > ${e[1]}`);
  assert.equal(
    await sqlNum(
      `select count(*) from shortages s join products p on p.id = s.product_id where p.name = 'Rosół' and s.status = 'open' and s.quantity = 5`,
    ),
    1,
  );
});

scenario('skaner paragonów: zdjęcie → tabela → poprawki → zakup, magazyn i zapamiętane dopasowania', async ({ mk }) => {
  const mgr = await loginAs(env, await mk(), email('manager'));
  // bez klucza API: czytelny komunikat
  env.be.state.scanReply = null;
  await mgr.goto(`${env.appUrl}/#/zakupy`);
  await mgr.getByRole('link', { name: 'Skanuj paragon' }).click();
  await mgr.getByText('Zrób zdjęcie paragonu').first().waitFor();
  const photo = 'public/icons/icon-512.png';
  await mgr.getByLabel('Wybierz zdjęcia').setInputFiles(photo);
  await mgr.getByRole('img', { name: 'Zdjęcie 1' }).waitFor();
  await mgr.getByRole('button', { name: 'Odczytaj paragon' }).click();
  await toast(mgr, 'ANTHROPIC_API_KEY');

  env.be.state.scanReply = {
    readable: true,
    store: 'Makro',
    date: new Date().toISOString().slice(0, 10),
    document_number: '0815/2026',
    total: 60.59,
    notes: '',
    items: [
      {
        name: 'MLEKO 3,2% 1L',
        name_guess: 'Mleko 3,2%',
        quantity: 6,
        unit: 'szt',
        unit_price: 4.1,
        total: 24.6,
        vat_rate: 5,
        package_size: 1,
        package_unit: 'l',
        match: 'Mleko 3,2%',
        uncertain: false,
      },
      {
        name: 'POMIDORY MALINOWE',
        name_guess: 'Pomidory malinowe',
        quantity: 2.5,
        unit: 'kg',
        unit_price: 12,
        total: 30,
        vat_rate: 5,
        package_size: null,
        package_unit: null,
        match: '',
        uncertain: true,
      },
      {
        name: 'BATON PROTEIN',
        name_guess: 'Baton proteinowy',
        quantity: 1,
        unit: 'szt',
        unit_price: 5.99,
        total: 5.99,
        vat_rate: 23,
        package_size: null,
        package_unit: null,
        match: '',
        uncertain: false,
      },
    ],
  };
  await mgr.getByRole('button', { name: 'Odczytaj paragon' }).click();
  const table = mgr.locator('.receipt-table');
  await table.waitFor();
  const req = env.be.state.scanRequests.at(-1);
  assert.equal(req.messages[0].content[0].type, 'image');
  assert.equal(req.messages[0].content[0].source.media_type, 'image/jpeg', 'zdjęcie skompresowane do JPEG');
  assert.match(req.messages[0].content.at(-1).text, /Mleko 3,2%/);
  const rows = table.locator('tbody tr');
  assert.equal(await rows.count(), 3);
  assert.equal(
    await rows.nth(0).locator('select').first().inputValue(),
    pid('Mleko 3,2%'),
    'dopasowanie z podpowiedzi modelu',
  );
  assert.equal(
    await rows.nth(1).locator('select').first().inputValue(),
    pid('Pomidor'),
    'dopasowanie po podobnej nazwie',
  );
  assert.equal(await rows.nth(2).locator('select').first().inputValue(), '');
  await rows.nth(0).getByText('Do magazynu: 6 L').waitFor();
  await rows.nth(1).getByText('sprawdź').waitFor();
  await mgr.getByText('Suma na paragonie: 60,59 zł').waitFor();
  await mgr.screenshot({ path: `${ARTIFACTS}/skaner-tabela-390.png`, fullPage: true });
  const scroll = await mgr.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(scroll[0] <= scroll[1] + 1, 'tabela przewija się w swoim kontenerze, nie cała strona');

  // poprawka ilości pomidorów: 2,5 → 2 kg (wartość przelicza się)
  await mgr.getByLabel('Ilość: POMIDORY MALINOWE').fill('2');
  await mgr.getByLabel('Ilość: POMIDORY MALINOWE').press('Tab');
  await mgr.getByText('Suma pozycji (54,59 zł) różni się od sumy na paragonie').waitFor();
  // bez produktu w wierszu 3 → błąd; potem tworzymy nowy produkt z pozycji paragonu
  await mgr.getByRole('button', { name: 'Zapisz jako zakup' }).click();
  await toast(mgr, 'Przypisz produkt w wierszu: 3');
  await mgr.getByLabel('Produkt dla: BATON PROTEIN').selectOption('__new');
  await toast(mgr, 'Dodano produkt: Baton proteinowy');
  assert.equal(await sqlNum(`select count(*) from products where name = 'Baton proteinowy' and unit = 'szt'`), 1);
  // pomijamy baton mimo wszystko
  await mgr.getByLabel('Pomiń: BATON PROTEIN').check();

  const stock = (n) =>
    sqlNum(`select coalesce(sum(quantity_delta),0) from inventory_movements where product_id='${pid(n)}'`);
  const [milk0, tom0] = [await stock('Mleko 3,2%'), await stock('Pomidor')];
  await mgr.getByRole('button', { name: 'Zapisz jako zakup' }).click();
  await toast(mgr, 'Zapisano zakup i dodano towar do magazynu.');
  await mgr.waitForURL(/#\/zakupy\/[0-9a-f-]{36}$/);
  assert.equal((await stock('Mleko 3,2%')) - milk0, 6, '6 × 1 l mleka = +6 l');
  assert.equal((await stock('Pomidor')) - tom0, 2, 'poprawiona ilość pomidorów');
  assert.equal(
    await env.be.sql(
      `select round(i.unit_price_net, 4) || '/' || i.vat_rate from purchase_items i join receipt_scans r on r.purchase_id = i.purchase_id where i.product_id = '${pid('Mleko 3,2%')}'`,
    ),
    '3.9048/5.00',
    'cena netto = 4,10 brutto / 1,05',
  );
  assert.equal(
    await sqlNum(
      `select count(*) from receipt_scans s join purchases p on p.id = s.purchase_id and p.receipt_id = s.id`,
    ),
    1,
    'skan powiązany z zakupem',
  );
  assert.equal(await sqlNum(`select count(*) from product_aliases`), 2, 'zapamiętane dopasowania dla 2 pozycji');
  assert.equal(
    await env.be.sql(`select (items->1->>'quantity') || '/' || (items->2->>'skip') from receipt_scans`),
    '2/true',
    'poprawki z tabeli zapisane w skanie',
  );

  // ponowne otwarcie skanu: oznaczony jako zapisany, bez drugiego zapisu
  await mgr.goto(`${env.appUrl}/#/skaner`);
  await mgr.getByText('zapisany').first().click();
  await mgr.getByText('Ten paragon jest już zapisany jako zakup.').waitFor();
  assert.equal(await mgr.getByRole('button', { name: 'Zapisz jako zakup' }).count(), 0);

  // drugi paragon z tą samą nazwą: dopasowanie z pamięci (alias), nawet bez podpowiedzi modelu
  env.be.state.scanReply = {
    ...env.be.state.scanReply,
    items: [{ ...env.be.state.scanReply.items[1], match: '', name_guess: 'Coś zupełnie innego' }],
    total: 30,
  };
  await mgr.getByLabel('Wybierz zdjęcia').setInputFiles(photo);
  await mgr.getByRole('button', { name: 'Odczytaj paragon' }).click();
  await mgr.locator('.receipt-table').waitFor();
  assert.equal(await mgr.locator('.receipt-table tbody tr select').first().inputValue(), pid('Pomidor'));

  // pracownik nie ma dostępu do skanera
  const ewa = await loginAs(env, await mk(), email('ewa'));
  for (const route of ['skaner', 'katalog']) {
    await ewa.evaluate((r) => (location.hash = `#/${r}`), route);
    await ewa.waitForFunction(() => location.hash === '#/dzisiaj');
    await toast(ewa, 'Nie masz dostępu do tej sekcji.');
  }
});
