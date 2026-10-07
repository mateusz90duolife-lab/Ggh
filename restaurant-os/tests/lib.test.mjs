import './helpers/browserShim.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const f = await import('../public/assets/js/lib/format.js');
const v = await import('../public/assets/js/lib/validate.js');
const e = await import('../public/assets/js/lib/errors.js');
const u = await import('../public/assets/js/lib/units.js');
const j = await import('../public/assets/js/lib/jwt.js');
const id = await import('../public/assets/js/lib/uuid.js');

test('formatQty / formatQtyUnit: polski przecinek, bez zbędnych zer', () => {
  assert.equal(f.formatQty('10.000'), '10');
  assert.equal(f.formatQty(2.5), '2,5');
  assert.equal(f.formatQty('0.125'), '0,125');
  assert.equal(f.formatQty(null), '—');
  assert.equal(f.formatQty('abc'), '—');
  assert.equal(f.formatQtyUnit(10, 'l'), '10 L');
  assert.equal(f.formatQtyUnit(3, 'szt'), '3 szt.');
});

test('formatPLN / formatDate / formatDateTime / todayIn', () => {
  assert.equal(f.formatPLN(2438), '2 438,00 zł');
  assert.equal(f.formatPLN('5.4'), '5,40 zł');
  assert.equal(f.formatPLN(null), '—');
  assert.equal(f.formatDate('2026-10-08'), '08.10.2026');
  assert.equal(f.formatDateTime('2026-10-07T17:42:00Z', 'Europe/Warsaw'), '07.10.2026 19:42');
  assert.equal(f.formatTime('2026-10-07T17:42:00Z', 'Europe/Warsaw'), '19:42');
  assert.equal(f.todayIn('Europe/Warsaw', new Date('2026-10-07T22:30:00Z')), '2026-10-08');
  assert.equal(f.todayIn('Europe/Warsaw', new Date('2026-10-07T10:00:00Z')), '2026-10-07');
  assert.equal(f.formatLongDate('2026-10-07'), 'środa, 7 października');
});

test('plural: polskie liczebniki', () => {
  const p = (n) => f.plural(n, 'produkt', 'produkty', 'produktów');
  assert.deepEqual([1, 2, 4, 5, 12, 14, 22, 25, 112].map(p), [
    'produkt',
    'produkty',
    'produkty',
    'produktów',
    'produktów',
    'produktów',
    'produkty',
    'produktów',
    'produktów',
  ]);
});

test('normalize: wyszukiwanie bez wielkości liter i polskich znaków', () => {
  assert.equal(f.normalize('Śmietana 18%'), 'smietana 18%');
  assert.equal(f.normalize('ŁÓDŹ żółć'), 'lodz zolc');
});

test('relativeTime', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  assert.equal(f.relativeTime('2026-10-07T11:59:50Z', now), 'przed chwilą');
  assert.equal(f.relativeTime('2026-10-07T11:55:00Z', now), '5 min temu');
  assert.equal(f.relativeTime('2026-10-07T10:00:00Z', now), '2 godz. temu');
});

test('parseQuantity: przecinek/kropka, odrzuca ≤0, NaN, > 100000, śmieci', () => {
  assert.deepEqual(v.parseQuantity('2,5'), { ok: true, value: 2.5 });
  assert.deepEqual(v.parseQuantity(' 10 '), { ok: true, value: 10 });
  assert.equal(v.parseQuantity('0,0004').ok, false, 'ilość zaokrąglająca się do 0 jest odrzucana');
  assert.equal(v.parseQuantity('0,001').ok, true);
  for (const bad of ['', '0', '-5', '-999999', 'abc', '1e3', '1,2,3', '100001', 'NaN', 'Infinity', '--1']) {
    assert.equal(v.parseQuantity(bad).ok, false, `"${bad}" powinno być odrzucone`);
  }
  assert.equal(v.parseQuantity('100000').ok, true);
  assert.equal(v.parseQuantity('0', { allowZero: true }).ok, true);
  assert.equal(v.parseQuantity('1,23456').value, 1.235);
});

test('parseSignedQuantity: znak dozwolony, zero nie', () => {
  assert.deepEqual(v.parseSignedQuantity('-2,5'), { ok: true, value: -2.5 });
  assert.deepEqual(v.parseSignedQuantity('+3'), { ok: true, value: 3 });
  assert.equal(v.parseSignedQuantity('0').ok, false);
  assert.equal(v.parseSignedQuantity('x').ok, false);
  assert.equal(v.parseSignedQuantity('-100001').ok, false);
});

test('parseMoney', () => {
  assert.deepEqual(v.parseMoney('5,40'), { ok: true, value: 5.4 });
  assert.equal(v.parseMoney('-1').ok, false);
  assert.equal(v.parseMoney('').ok, false);
  assert.equal(v.parseMoney('1,23456', 2).value, 1.23);
});

test('validateText / validateEmail / validateNewPassword / parseEmailList / validateTime / validateTimeZone', () => {
  assert.equal(v.validateText('   ', 'nazwę', 1, 10).ok, false);
  assert.deepEqual(v.validateText('  Mleko   3,2% ', 'nazwę', 1, 20), { ok: true, value: 'Mleko 3,2%' });
  assert.equal(v.validateText('x'.repeat(11), 'nazwę', 1, 10).ok, false);
  assert.equal(v.validateEmail('a@b').ok, false);
  assert.deepEqual(v.validateEmail(' Jan@Example.COM '), { ok: true, value: 'jan@example.com' });
  assert.equal(v.validateNewPassword('1234567').ok, false);
  assert.equal(v.validateNewPassword('12345678', '12345679').ok, false);
  assert.equal(v.validateNewPassword('12345678', '12345678').ok, true);
  assert.deepEqual(v.parseEmailList('a@x.pl, b@x.pl;\na@x.pl'), { ok: true, value: ['a@x.pl', 'b@x.pl'] });
  assert.equal(v.parseEmailList('a@x.pl, zly').ok, false);
  assert.deepEqual(v.parseEmailList(''), { ok: true, value: [] });
  assert.equal(v.validateTime('21:00').ok, true);
  assert.equal(v.validateTime('24:00').ok, false);
  assert.equal(v.validateTimeZone('Europe/Warsaw').ok, true);
  assert.equal(v.validateTimeZone('Mars/Olympus').ok, false);
});

test('validatePurchaseDate: nie z przyszłości', () => {
  assert.equal(v.validatePurchaseDate('2026-10-07', '2026-10-07').ok, true);
  assert.equal(v.validatePurchaseDate('2026-10-08', '2026-10-07').ok, true);
  assert.equal(v.validatePurchaseDate('2026-10-09', '2026-10-07').ok, false);
  assert.equal(v.validatePurchaseDate('07.10.2026', '2026-10-07').ok, false);
  assert.equal(v.validatePurchaseDate('2026-13-45', '2026-10-07').ok, false);
});

test('fromPostgrest: komunikaty po polsku', () => {
  assert.equal(e.fromPostgrest(403, { code: '42501', message: 'new row violates row-level security policy' }).message, 'Brak uprawnień do tej operacji.');
  assert.equal(e.fromPostgrest(401, { message: 'JWT expired' }).status, 401);
  assert.equal(e.fromPostgrest(409, { code: '23505', message: 'dup' }).message, 'Taki rekord już istnieje.');
  assert.equal(e.fromPostgrest(400, { code: 'P0001', message: 'Zakup został już przetworzony' }).message, 'Zakup został już przetworzony');
  assert.match(e.fromPostgrest(400, { code: '23514', message: 'check' }).message, /nieprawidłowa/);
  assert.match(e.fromPostgrest(503, null).message, /Błąd serwera/);
  assert.equal(e.errorMessage(new e.NetworkError()), 'Brak połączenia z internetem.');
  assert.match(e.errorMessage(new Error('boom')), /nieoczekiwany/);
  assert.ok(!e.errorMessage(new Error('boom')).includes('boom'), 'szczegóły techniczne nie wyciekają do użytkownika');
});

test('units', () => {
  assert.equal(u.unitLabel('l'), 'L');
  assert.equal(u.unitLabel('xyz'), 'xyz');
  assert.ok(u.isUnit('kg') && !u.isUnit('lbs'));
  assert.ok(u.allowsFraction('kg') && !u.allowsFraction('szt'));
});

test('decodeJwt i uuid', () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(j.decodeJwt(`${b({})}.${b({ sub: 'abc', exp: 5 })}.x`).sub, 'abc');
  assert.equal(j.decodeJwt('zly'), null);
  const a = id.uuid();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, id.uuid());
});
