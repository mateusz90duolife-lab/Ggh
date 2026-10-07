import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDailySummary, localParts } from '../supabase/functions/_shared/dailySummary.ts';
import {
  buildSummary,
  formatQty,
  addDays,
  escapeHtml,
  formatDatePl,
} from '../supabase/functions/_shared/summaryMail.ts';
import { createFake, baseProfiles, baseTokens, baseEnv, post, R_A } from './helpers/fakeSupabase.mjs';

const row = (name, cat, order, unit, qty, urgent = false, reports = 1) => ({
  product_name: name,
  category_name: cat,
  category_order: order,
  unit,
  total_quantity: qty,
  urgent,
  reports_count: reports,
});
const SHOP = [
  row('Mleko', 'Nabiał', 1, 'l', '10.000', false, 3),
  row('Śmietana', 'Nabiał', 1, 'l', '6.000'),
  row('Pomidor', 'Warzywa', 2, 'kg', '12.000'),
  row('Kurczak', 'Mięso', 4, 'kg', '2.500', true),
];

function setup({
  shopping = SHOP,
  emails = ['wlasciciel@example.com'],
  summaryTime = '21:00:00',
  tz = 'Europe/Warsaw',
} = {}) {
  // 7 paź 2026, 19:30 UTC = 21:30 w Warszawie (CEST)
  let nowIso = '2026-10-07T19:30:00Z';
  const fake = createFake({
    restaurants: [{ id: R_A, name: 'Bistro <Test>', timezone: tz, summary_time: summaryTime, summary_emails: emails }],
    profiles: baseProfiles(),
    shopping: shopping.map((s) => ({ ...s, restaurant_id: R_A })),
    tokens: baseTokens,
    clock: () => new Date(nowIso),
  });
  const deps = (env = baseEnv) => ({ env, fetchFn: fake.fetchFn, now: () => new Date(nowIso) });
  const cron = (env) => handleDailySummary(post({}, 'cron-secret'), deps(env));
  return { fake, cron, setNow: (v) => (nowIso = v), deps };
}

test('localParts: strefa Europe/Warsaw (CEST i CET)', () => {
  assert.deepEqual(localParts(new Date('2026-10-07T19:30:00Z'), 'Europe/Warsaw'), {
    date: '2026-10-07',
    time: '21:30',
  });
  assert.deepEqual(localParts(new Date('2026-10-07T22:30:00Z'), 'Europe/Warsaw'), {
    date: '2026-10-08',
    time: '00:30',
  });
  assert.deepEqual(localParts(new Date('2026-12-01T20:00:00Z'), 'Europe/Warsaw'), {
    date: '2026-12-01',
    time: '21:00',
  });
});

test('cron: przed godziną podsumowania nic nie wysyła', async () => {
  const { fake, cron, setNow } = setup();
  setNow('2026-10-07T18:30:00Z'); // 20:30 lokalnie
  const r = await cron();
  assert.equal(r.status, 200);
  assert.equal(fake.state.sent.length, 0);
  assert.equal(fake.state.emailLog.length, 0);
});

test('cron: po godzinie wysyła 1 mail z poprawną treścią i zapisuje email_log', async () => {
  const { fake, cron } = setup();
  const r = await cron();
  assert.equal(r.status, 200);
  assert.equal(fake.state.sent.length, 1);
  const mail = fake.state.sent[0];
  assert.equal(mail.auth, 're_key');
  assert.deepEqual(mail.to, ['wlasciciel@example.com']);
  assert.equal(mail.subject, 'Lista zakupów restauracji — 08.10.2026');
  assert.match(mail.text, /poniżej lista zakupów na jutro \(08\.10\.2026\)/);
  assert.match(mail.text, /• Mleko — 10 L/);
  assert.match(mail.text, /• Pomidor — 12 kg/);
  assert.equal(fake.state.emailLog.length, 1);
  assert.equal(fake.state.emailLog[0].status, 'sent');
  assert.equal(fake.state.emailLog[0].local_date, '2026-10-07');
  assert.ok(fake.state.emailLog[0].provider_id.startsWith('re_'));
});

test('cron: drugie i trzecie wywołanie tego samego dnia NIE wysyła kolejnego maila', async () => {
  const { fake, cron } = setup();
  await cron();
  await cron();
  await cron();
  assert.equal(fake.state.sent.length, 1);
});

test('cron: równoległe wywołania wysyłają dokładnie 1 mail', async () => {
  const { fake, cron } = setup();
  await Promise.all([cron(), cron(), cron()]);
  assert.equal(fake.state.sent.length, 1);
});

test('cron: następnego dnia wysyła ponownie', async () => {
  const { fake, cron, setNow } = setup();
  await cron();
  setNow('2026-10-08T19:30:00Z');
  await cron();
  assert.equal(fake.state.sent.length, 2);
  assert.equal(fake.state.emailLog.length, 2);
});

test('cron: błąd Resend zapisuje failed, a kolejne wywołanie ponawia i wysyła', async () => {
  const { fake, cron } = setup();
  fake.state.resendFail = true;
  await cron();
  assert.equal(fake.state.sent.length, 0);
  assert.equal(fake.state.emailLog[0].status, 'failed');
  assert.match(fake.state.emailLog[0].error, /Resend/);
  fake.state.resendFail = false;
  await cron();
  assert.equal(fake.state.sent.length, 1);
  assert.equal(fake.state.emailLog[0].status, 'sent');
  await cron();
  assert.equal(fake.state.sent.length, 1);
});

test('cron: „zawieszone” wysyłanie (>10 min) jest przejmowane, świeże — nie', async () => {
  const { fake, cron } = setup();
  fake.state.emailLog.push({
    id: 'x',
    restaurant_id: R_A,
    kind: 'shopping_summary',
    local_date: '2026-10-07',
    status: 'sending',
    claimed_at: '2026-10-07T19:25:00.000Z',
  });
  await cron();
  assert.equal(fake.state.sent.length, 0, 'świeży wpis (5 min) nie jest przejmowany');
  fake.state.emailLog[0].claimed_at = '2026-10-07T19:10:00.000Z';
  await cron();
  assert.equal(fake.state.sent.length, 1, 'wpis starszy niż 10 min jest przejmowany');
});

test('cron: pusta lista → status skipped, bez maila; brak odbiorców → skipped', async () => {
  const a = setup({ shopping: [] });
  await a.cron();
  assert.equal(a.fake.state.sent.length, 0);
  assert.equal(a.fake.state.emailLog[0].status, 'skipped');
  const b = setup({ emails: [] });
  await b.cron();
  assert.equal(b.fake.state.sent.length, 0);
  assert.equal(b.fake.state.emailLog[0].status, 'skipped');
  const c = setup({ emails: ['to-nie-email'] });
  await c.cron();
  assert.equal(c.fake.state.sent.length, 0);
});

test('zły sekret crona i brak JWT → 401; brak konfiguracji maila → 500', async () => {
  const { fake, deps } = setup();
  assert.equal((await handleDailySummary(post({}, 'zly-sekret'), deps())).status, 401);
  assert.equal((await handleDailySummary(post({}), deps())).status, 401);
  const noKey = await handleDailySummary(post({}, 'cron-secret'), deps({ ...baseEnv, RESEND_API_KEY: undefined }));
  assert.equal(noKey.status, 500);
  assert.equal(fake.state.sent.length, 0);
});

test('wysyłka ręczna: pracownik 403; manager/właściciel wysyła, bez wpisu w email_log', async () => {
  const { fake, deps } = setup();
  assert.equal((await handleDailySummary(post({}, 't-employee'), deps())).status, 403);
  const r = await handleDailySummary(post({}, 't-manager'), deps());
  assert.equal(r.status, 200);
  assert.equal(fake.state.sent.length, 1);
  assert.match(fake.state.sent[0].text, /aktualna lista zakupów/);
  assert.equal(fake.state.emailLog.length, 0);
  const t = await handleDailySummary(post({ test: true }, 't-owner'), deps());
  assert.equal(t.status, 200);
  assert.match(fake.state.sent[1].subject, /^\[TEST\]/);
  await handleDailySummary(post({}, 't-owner'), deps());
  assert.equal(fake.state.sent.length, 3, 'ręcznie można wysłać wielokrotnie');
});

test('wysyłka ręczna bez odbiorców → 400 z komunikatem po polsku', async () => {
  const { deps } = setup({ emails: [] });
  const r = await handleDailySummary(post({}, 't-owner'), deps());
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /odbiorc/i);
});

test('klucz Resend nie wycieka w odpowiedzi błędu', async () => {
  const { fake, deps } = setup();
  fake.state.resendFail = true;
  const r = await handleDailySummary(post({}, 't-owner'), deps());
  assert.equal(r.status, 500);
  assert.ok(!(await r.text()).includes('re_key'));
});

test('buildSummary: PILNE na górze, kategorie wg kolejności, ilości po polsku, escapowanie HTML', () => {
  const m = buildSummary({
    rows: [...SHOP, row('<b>Ser</b> & "żółty"', 'Nabiał', 1, 'kg', 0.125)],
    forDate: '2026-10-08',
    restaurantName: 'Bistro <Test>',
    forTomorrow: true,
  });
  const lines = m.text.split('\n');
  assert.ok(lines.indexOf('PILNE') < lines.indexOf('NABIAŁ'));
  assert.ok(lines.indexOf('NABIAŁ') < lines.indexOf('WARZYWA'));
  assert.ok(m.text.includes('• Kurczak — 2,5 kg'));
  assert.ok(
    !lines.slice(lines.indexOf('NABIAŁ')).includes('• Kurczak — 2,5 kg'),
    'pilna pozycja nie powtarza się w kategorii',
  );
  assert.ok(m.text.includes('0,125 kg'));
  assert.ok(!m.html.includes('<b>Ser</b>'));
  assert.ok(m.html.includes('&lt;b&gt;Ser&lt;/b&gt; &amp; &quot;żółty&quot;'));
  assert.ok(m.html.includes('Bistro &lt;Test&gt;'));
  assert.ok(m.text.endsWith('Pozdrawiam\nSystem magazynowy'));
});

test('helpery: formatQty, addDays, formatDatePl, escapeHtml', () => {
  assert.equal(formatQty('10.000'), '10');
  assert.equal(formatQty(2.5), '2,5');
  assert.equal(formatQty('abc'), '?');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(formatDatePl('2026-10-08'), '08.10.2026');
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
