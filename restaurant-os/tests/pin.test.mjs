import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdminUsers } from '../supabase/functions/_shared/adminUsers.ts';
import { handlePinLogin } from '../supabase/functions/_shared/pinLogin.ts';
import { pinPassword } from '../supabase/functions/_shared/pin.ts';
import { createFake, baseProfiles, baseTokens, baseEnv, post, R_A } from './helpers/fakeSupabase.mjs';

function setup() {
  const fake = createFake({ restaurants: [{ id: R_A, name: 'A' }], profiles: baseProfiles(), tokens: baseTokens });
  let now = new Date('2026-10-07T12:00:00Z');
  const admin = (body, token = 't-owner') => handleAdminUsers(post(body, token), baseEnv, fake.fetchFn);
  const login = (nick, pin) =>
    handlePinLogin(post({ nick, pin }), { env: baseEnv, fetchFn: fake.fetchFn, now: () => now });
  return { fake, admin, login, tick: (min) => (now = new Date(now.getTime() + min * 60000)) };
}

test('właściciel zakłada konto na nick + PIN; pracownik loguje się nickiem i PIN-em', async () => {
  const { fake, admin, login } = setup();
  const r = await admin({ action: 'create', full_name: 'Kasia Nowak', nick: '  Kasia ', pin: '4821' });
  assert.equal(r.status, 200);
  const { user } = await r.json();
  assert.equal(user.nick, 'kasia');
  const auth = fake.state.authUsers.get(user.id);
  assert.match(auth.email, /^pin-[0-9a-f-]+@staff\.restaurant-os\.invalid$/);
  assert.equal(auth.password, await pinPassword(baseEnv.SUPABASE_SERVICE_ROLE_KEY, user.id, '4821'));
  assert.notEqual(auth.password, '4821', 'PIN nie jest hasłem w Auth');
  const p = fake.state.profiles.find((x) => x.id === user.id);
  assert.equal(p.nick, 'kasia');
  assert.equal(p.role, 'employee');

  const ok = await login('KASIA', '4821');
  assert.equal(ok.status, 200);
  const s = await ok.json();
  assert.equal(s.access_token, `at-${user.id}`);
  assert.ok(s.refresh_token);
  // lista kont pokazuje nick zamiast technicznego adresu
  const list = (await (await admin({ action: 'list' })).json()).users;
  const row = list.find((u) => u.id === user.id);
  assert.equal(row.nick, 'kasia');
  assert.equal(row.email, null);
});

test('walidacja: nick, PIN, zajęty nick, rola właściciela; tylko właściciel zakłada konta', async () => {
  const { admin } = setup();
  const bad = async (body, status) =>
    assert.equal((await admin({ action: 'create', full_name: 'Jan', ...body })).status, status);
  await bad({ nick: 'a', pin: '1234' }, 400);
  await bad({ nick: 'zły nick!', pin: '1234' }, 400);
  await bad({ nick: 'jan', pin: '123' }, 400);
  await bad({ nick: 'jan', pin: '12a4' }, 400);
  await bad({ nick: 'jan', pin: '1234', role: 'owner' }, 400);
  await bad({ nick: 'jan', pin: '1234' }, 200);
  await bad({ nick: 'JAN', pin: '9999' }, 409);
  assert.equal((await admin({ action: 'create', full_name: 'X', nick: 'xx', pin: '1111' }, 't-manager')).status, 403);
  assert.equal((await admin({ action: 'create', full_name: 'X', nick: 'xx', pin: '1111' }, 't-employee')).status, 403);
});

test('pin-login: zły PIN liczy próby, po 5 blokada na 15 min, ta sama odpowiedź dla nieznanego nicka', async () => {
  const { fake, admin, login, tick } = setup();
  const { user } = await (await admin({ action: 'create', full_name: 'Ola', nick: 'ola', pin: '1111' })).json();
  const unknown = await login('nikt', '1111');
  assert.equal(unknown.status, 401);
  assert.match((await unknown.json()).error, /Nieprawidłowy nick lub PIN/);
  for (let i = 1; i <= 4; i++) {
    const r = await login('ola', '0000');
    assert.equal(r.status, 401);
    assert.match((await r.json()).error, new RegExp(`Pozostało prób: ${5 - i}`));
  }
  const locked = await login('ola', '0000');
  assert.equal(locked.status, 429);
  // nawet poprawny PIN nie działa w czasie blokady
  assert.equal((await login('ola', '1111')).status, 429);
  tick(16);
  const r = await login('ola', '1111');
  assert.equal(r.status, 200);
  const p = fake.state.profiles.find((x) => x.id === user.id);
  assert.equal(p.pin_failed, 0);
  assert.equal(p.pin_locked_until, null);
  // walidacja wejścia
  assert.equal((await login('ola', '12')).status, 400);
  assert.equal((await login('', '1111')).status, 400);
});

test('nowy PIN od właściciela zdejmuje blokadę; stary PIN przestaje działać; nieaktywne konto odrzucone', async () => {
  const { fake, admin, login } = setup();
  const { user } = await (await admin({ action: 'create', full_name: 'Piotr', nick: 'piotr', pin: '2222' })).json();
  for (let i = 0; i < 5; i++) await login('piotr', '0000');
  assert.equal((await login('piotr', '2222')).status, 429);
  assert.equal((await admin({ action: 'set_pin', id: user.id, pin: '3333' })).status, 200);
  assert.equal((await login('piotr', '2222')).status, 401);
  assert.equal((await login('piotr', '3333')).status, 200);
  assert.equal((await admin({ action: 'set_pin', id: user.id, pin: '33' })).status, 400);
  // reset hasła nie dotyczy kont PIN; zmiana nicka
  assert.equal((await admin({ action: 'reset_password', id: user.id, password: 'Haslo1234' })).status, 400);
  assert.equal((await admin({ action: 'update', id: user.id, nick: 'piotrek' })).status, 200);
  assert.equal((await login('piotrek', '3333')).status, 200);
  fake.state.profiles.find((x) => x.id === user.id).active = false;
  assert.equal((await login('piotrek', '3333')).status, 403);
});
