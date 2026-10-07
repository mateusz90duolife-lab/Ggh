import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleScanReceipt,
  sanitizeResult,
  buildRequest,
  cleanDate,
  DAILY_LIMIT,
  MODEL,
  RECEIPT_SCHEMA,
} from '../supabase/functions/_shared/scanReceipt.ts';
import { createFake, baseProfiles, baseTokens, baseEnv, post, R_A, R_B } from './helpers/fakeSupabase.mjs';

const IMG = { media_type: 'image/jpeg', data: 'A'.repeat(400) };
const NOW = new Date('2026-10-07T12:00:00Z');

const answer = {
  readable: true,
  store: 'Makro Cash and Carry',
  date: '2026-10-06',
  document_number: '123/45',
  total: 30.4,
  notes: '',
  items: [
    {
      name: 'MLEKO 3,2% 1L',
      name_guess: 'Mleko 3,2%',
      quantity: 2,
      unit: 'szt',
      unit_price: 4.1,
      total: 8.2,
      vat_rate: 5,
      package_size: 1,
      package_unit: 'l',
      match: 'mleko',
      uncertain: false,
    },
    {
      name: 'POMIDORY LUZ',
      name_guess: 'Pomidory',
      quantity: 1.85,
      unit: 'kg',
      unit_price: 12,
      total: 22.2,
      vat_rate: 5,
      package_size: null,
      package_unit: null,
      match: 'Coś spoza listy',
      uncertain: true,
    },
  ],
};

function client(reply, calls = []) {
  return {
    async create(params) {
      calls.push(params);
      if (reply instanceof Error) throw reply;
      return typeof reply === 'function' ? reply(params, calls.length) : reply;
    },
  };
}
const ok = (obj = answer) => ({
  stop_reason: 'end_turn',
  model: MODEL,
  content: [
    { type: 'thinking', thinking: '' },
    { type: 'text', text: JSON.stringify(obj) },
  ],
});

function setup({ reply = ok(), claude, scans = [], classifyError } = {}) {
  const fake = createFake({
    restaurants: [{ id: R_A, name: 'A' }],
    profiles: baseProfiles(),
    tokens: baseTokens,
    products: [
      { name: 'Mleko', restaurant_id: R_A },
      { name: 'Ser', restaurant_id: R_A },
    ],
    scans,
  });
  const calls = [];
  const deps = {
    env: baseEnv,
    fetchFn: fake.fetchFn,
    claude: claude === undefined ? client(reply, calls) : claude,
    classifyError,
    now: () => NOW,
  };
  const call = (body, token = 't-manager') => handleScanReceipt(post(body, token), deps);
  return { fake, calls, call };
}

test('scan-receipt: uprawnienia — bez tokenu 401, pracownik 403, manager i właściciel OK', async () => {
  const { call } = setup();
  assert.equal((await call({ images: [IMG] }, null)).status, 401);
  assert.equal((await call({ images: [IMG] }, 't-employee')).status, 403);
  assert.equal((await call({ images: [IMG] }, 't-manager')).status, 200);
  assert.equal((await call({ images: [IMG] }, 't-owner')).status, 200);
});

test('scan-receipt: bez klucza ANTHROPIC_API_KEY → 503 z instrukcją', async () => {
  const { call } = setup({ claude: null });
  const r = await call({ images: [IMG] });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /ANTHROPIC_API_KEY/);
});

test('scan-receipt: walidacja zdjęć', async () => {
  const { call, calls } = setup();
  assert.equal((await call({})).status, 400);
  assert.equal((await call({ images: [] })).status, 400);
  assert.equal((await call({ images: [IMG, IMG, IMG, IMG, IMG] })).status, 400);
  assert.equal((await call({ images: [{ media_type: 'application/pdf', data: IMG.data }] })).status, 400);
  assert.equal(
    (await call({ images: [{ media_type: 'image/jpeg', data: 'to nie base64 <script>'.repeat(10) }] })).status,
    400,
  );
  assert.equal(
    (await call({ images: [{ media_type: 'image/png', data: 'A'.repeat(5 * 1024 * 1024 + 4) }] })).status,
    413,
  );
  assert.equal(calls.length, 0, 'żadne wywołanie API dla błędnych danych');
});

test('scan-receipt: wynik → tabela, zapis skanu w bazie lokalu wywołującego', async () => {
  const { call, fake, calls } = setup();
  const r = await call({ images: [IMG, IMG] });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.store, 'Makro Cash and Carry');
  assert.equal(body.date, '2026-10-06');
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].match, 'Mleko', 'dopasowanie bez względu na wielkość liter, nazwa z listy produktów');
  assert.equal(body.items[1].match, '', 'nazwa spoza listy produktów jest odrzucana');
  assert.equal(body.items_total, 30.4);
  assert.ok(body.scan_id);
  assert.equal(fake.state.scans.length, 1);
  assert.equal(fake.state.scans[0].restaurant_id, R_A);
  assert.equal(fake.state.scans[0].receipt_date, '2026-10-06');
  // zapytanie do Claude: model, oba zdjęcia, lista produktów, schemat JSON, fallback
  const req = calls[0];
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.fallbacks, 'default');
  assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.equal(req.thinking, undefined);
  const content = req.messages[0].content;
  assert.equal(content.filter((b) => b.type === 'image').length, 2);
  assert.match(content.at(-1).text, /Mleko\nSer/);
  assert.match(content.at(-1).text, /2 zdjęcia jednego paragonu/);
});

test('scan-receipt: odmowa, ucięta odpowiedź i zły JSON → czytelne błędy, bez zapisu', async () => {
  for (const [reply, status] of [
    [{ stop_reason: 'refusal', content: [] }, 422],
    [{ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"items":[' }] }, 422],
    [{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'nie JSON' }] }, 502],
  ]) {
    const { call, fake } = setup({ reply });
    const r = await call({ images: [IMG] });
    assert.equal(r.status, status);
    assert.ok((await r.json()).error);
    assert.equal(fake.state.scans.length, 0);
  }
});

test('scan-receipt: błędy API klasyfikowane przez SDK; 400 → jedna próba bez funkcji beta', async () => {
  const authErr = Object.assign(new Error('invalid x-api-key'), { kind: 'auth' });
  const classifyError = (e) => e.kind ?? 'other';
  let r = await setup({ reply: authErr, classifyError }).call({ images: [IMG] });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /nieprawidłowy/);
  r = await setup({ reply: new Error('boom'), classifyError }).call({ images: [IMG] });
  assert.equal(r.status, 502);

  const bad = Object.assign(new Error('unknown field'), { kind: 'bad_request' });
  const s = setup({ reply: (_p, n) => (n === 1 ? Promise.reject(bad) : ok()), classifyError });
  r = await s.call({ images: [IMG] });
  assert.equal(r.status, 200);
  assert.equal(s.calls.length, 2);
  assert.equal(s.calls[1].fallbacks, undefined);
  assert.equal(s.calls[1].betas, undefined);
});

test('scan-receipt: dobowy limit skanów lokalu', async () => {
  const scans = Array.from({ length: DAILY_LIMIT }, (_, i) => ({ id: `s${i}`, restaurant_id: R_A }));
  const { call, calls } = setup({ scans });
  const r = await call({ images: [IMG] });
  assert.equal(r.status, 429);
  assert.equal(calls.length, 0);
  // skany innego lokalu się nie liczą
  const other = setup({ scans: scans.map((x) => ({ ...x, restaurant_id: R_B })) });
  assert.equal((await other.call({ images: [IMG] })).status, 200);
});

test('sanitizeResult: odrzuca śmieci i uzupełnia brakujące wartości', () => {
  const r = sanitizeResult(
    {
      readable: true,
      store: '  Lidl   sp. z o.o. ',
      date: '2031-01-01',
      total: -5,
      items: [
        { name: 'OK', quantity: 2, unit: 'kg', unit_price: null, total: 10 },
        { name: 'Bez ilości', quantity: 0, unit: 'szt', unit_price: 1, total: 1 },
        { name: '', quantity: 1, unit: 'szt', unit_price: 1, total: 1 },
        { name: 'Zła jednostka', quantity: 1, unit: 'tona', unit_price: 3, total: null, vat_rate: 230 },
        { name: 'Paczka bez jednostki', quantity: 1, unit: 'szt', unit_price: 3, total: 3, package_size: 2 },
      ],
    },
    [],
    NOW,
  );
  assert.equal(r.store, 'Lidl sp. z o.o.');
  assert.equal(r.date, null, 'data z przyszłości odrzucona');
  assert.equal(r.total, null);
  assert.deepEqual(
    r.items.map((i) => i.name),
    ['OK', 'Zła jednostka', 'Paczka bez jednostki'],
  );
  assert.equal(r.items[0].unit_price, 5);
  assert.equal(r.items[1].unit, 'szt');
  assert.equal(r.items[1].total, 3);
  assert.equal(r.items[1].vat_rate, null);
  assert.equal(r.items[2].package_size, null);
  assert.equal(sanitizeResult({ readable: true, items: [] }, [], NOW).readable, false);
  assert.equal(sanitizeResult(null, [], NOW).items.length, 0);
});

test('cleanDate i schemat odpowiedzi', () => {
  assert.equal(cleanDate('2026-10-06', NOW), '2026-10-06');
  assert.equal(cleanDate('2026-02-30', NOW), null);
  assert.equal(cleanDate('06.10.2026', NOW), null);
  assert.equal(cleanDate('2020-01-01', NOW), null);
  // structured outputs: każdy obiekt ma additionalProperties=false i wszystkie pola wymagane
  const check = (s) => {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(check);
    }
    if (s.items) check(s.items);
  };
  check(RECEIPT_SCHEMA);
  const req = buildRequest([IMG], [], false);
  assert.equal(req.fallbacks, undefined);
  assert.match(req.messages[0].content.at(-1).text, /nie ma jeszcze produktów/);
});
