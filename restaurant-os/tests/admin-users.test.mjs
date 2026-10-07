import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdminUsers } from '../supabase/functions/_shared/adminUsers.ts';
import { createFake, baseProfiles, baseTokens, baseEnv, post, U, R_A } from './helpers/fakeSupabase.mjs';

function setup(opts = {}) {
  const fake = createFake({
    restaurants: [{ id: R_A, name: 'A' }],
    profiles: baseProfiles(),
    tokens: baseTokens,
    emails: [
      { id: U.owner, email: 'wlasciciel@example.com' },
      { id: U.employee, email: 'pracownik@example.com' },
    ],
    ...opts,
  });
  const call = (body, token) => handleAdminUsers(post(body, token), baseEnv, fake.fetchFn);
  return { fake, call };
}

test('brak tokenu / zły token → 401; pracownik i manager → 403', async () => {
  const { call } = setup();
  assert.equal((await call({ action: 'list' })).status, 401);
  assert.equal((await call({ action: 'list' }, 'zly')).status, 401);
  assert.equal((await call({ action: 'list' }, 't-employee')).status, 403);
  assert.equal((await call({ action: 'list' }, 't-manager')).status, 403);
});

test('nieaktywny właściciel nie ma dostępu', async () => {
  const { fake, call } = setup();
  fake.state.profiles.find((p) => p.id === U.owner).active = false;
  assert.equal((await call({ action: 'list' }, 't-owner')).status, 401);
});

test('metoda inna niż POST → 405, OPTIONS → 204', async () => {
  const { fake } = setup();
  const g = await handleAdminUsers(new Request('https://f/x'), baseEnv, fake.fetchFn);
  assert.equal(g.status, 405);
  const o = await handleAdminUsers(new Request('https://f/x', { method: 'OPTIONS' }), baseEnv, fake.fetchFn);
  assert.equal(o.status, 204);
});

test('list: tylko własna restauracja, z adresami e-mail', async () => {
  const { call } = setup();
  const res = await call({ action: 'list' }, 't-owner');
  assert.equal(res.status, 200);
  const { users } = await res.json();
  assert.equal(users.length, 3);
  assert.ok(!users.some((u) => u.id === U.otherOwner));
  assert.equal(users.find((u) => u.id === U.employee).email, 'pracownik@example.com');
});

test('create: walidacja wejścia', async () => {
  const { call } = setup();
  const ok = {
    action: 'create',
    email: 'nowy@example.com',
    full_name: 'Anna Nowak',
    role: 'employee',
    password: 'haslo1234',
  };
  for (const bad of [
    { email: 'bez-malpy' },
    { full_name: 'A' },
    { role: 'admin' },
    { password: 'krotkie' },
    { password: 123 },
  ]) {
    const r = await call({ ...ok, ...bad }, 't-owner');
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
});

test('create: tworzy konto i profil w restauracji właściciela; duplikat → 409', async () => {
  const { fake, call } = setup();
  const body = {
    action: 'create',
    email: ' Nowy@Example.com ',
    full_name: ' Anna Nowak ',
    role: 'manager',
    password: 'haslo1234',
  };
  const r = await call(body, 't-owner');
  assert.equal(r.status, 200);
  const { user } = await r.json();
  assert.equal(user.email, 'nowy@example.com');
  const prof = fake.state.profiles.find((p) => p.id === user.id);
  assert.equal(prof.restaurant_id, R_A);
  assert.equal(prof.role, 'manager');
  assert.equal(prof.full_name, 'Anna Nowak');
  const dup = await call(body, 't-owner');
  assert.equal(dup.status, 409);
});

test('create: gdy zapis profilu zawiedzie, konto w Auth jest wycofywane', async () => {
  const { fake, call } = setup();
  fake.state.profileInsertFail = true;
  const before = fake.state.authUsers.size;
  const r = await call(
    { action: 'create', email: 'x@example.com', full_name: 'Jan Kowalski', role: 'employee', password: 'haslo1234' },
    't-owner',
  );
  assert.equal(r.status, 500);
  assert.equal(fake.state.authUsers.size, before);
});

test('update: nie można zmienić własnej roli ani się dezaktywować; imię można', async () => {
  const { call } = setup();
  assert.equal((await call({ action: 'update', id: U.owner, role: 'employee' }, 't-owner')).status, 400);
  assert.equal((await call({ action: 'update', id: U.owner, active: false }, 't-owner')).status, 400);
  assert.equal((await call({ action: 'update', id: U.owner, full_name: 'Nowe Imię' }, 't-owner')).status, 200);
  assert.equal((await call({ action: 'update', id: U.owner }, 't-owner')).status, 400);
});

test('update: zmiana roli i dezaktywacja blokuje logowanie w Auth; reaktywacja odblokowuje', async () => {
  const { fake, call } = setup();
  assert.equal((await call({ action: 'update', id: U.employee, role: 'manager' }, 't-owner')).status, 200);
  assert.equal(fake.state.profiles.find((p) => p.id === U.employee).role, 'manager');
  await call({ action: 'update', id: U.employee, active: false }, 't-owner');
  assert.equal(fake.state.authUsers.get(U.employee).banned, true);
  assert.equal(fake.state.profiles.find((p) => p.id === U.employee).active, false);
  await call({ action: 'update', id: U.employee, active: true }, 't-owner');
  assert.equal(fake.state.authUsers.get(U.employee).banned, false);
});

test('update/reset: cudzy użytkownik z innej restauracji → 404; zły id → 400', async () => {
  const { call } = setup();
  assert.equal((await call({ action: 'update', id: U.otherOwner, role: 'employee' }, 't-owner')).status, 404);
  assert.equal(
    (await call({ action: 'reset_password', id: U.otherOwner, password: 'haslo1234' }, 't-owner')).status,
    404,
  );
  assert.equal((await call({ action: 'update', id: 'abc', role: 'employee' }, 't-owner')).status, 400);
});

test('reset_password: wymaga min. 8 znaków i zmienia hasło', async () => {
  const { fake, call } = setup();
  assert.equal((await call({ action: 'reset_password', id: U.employee, password: '1234567' }, 't-owner')).status, 400);
  assert.equal(
    (await call({ action: 'reset_password', id: U.employee, password: 'nowehaslo1' }, 't-owner')).status,
    200,
  );
  assert.equal(fake.state.authUsers.get(U.employee).password, 'nowehaslo1');
});

test('nieznana akcja → 400; odpowiedzi nie ujawniają klucza service role', async () => {
  const { call } = setup();
  const r = await call({ action: 'drop_database' }, 't-owner');
  assert.equal(r.status, 400);
  assert.ok(!(await r.text()).includes('service-key'));
});

test('CORS: z ALLOWED_ORIGIN odpowiada tylko dla tej domeny', async () => {
  const { fake } = setup();
  const env = { ...baseEnv, ALLOWED_ORIGIN: 'https://app.example.com' };
  const good = await handleAdminUsers(
    post({ action: 'list' }, 't-owner', { origin: 'https://app.example.com' }),
    env,
    fake.fetchFn,
  );
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://app.example.com');
  const bad = await handleAdminUsers(
    post({ action: 'list' }, 't-owner', { origin: 'https://zly.example.com' }),
    env,
    fake.fetchFn,
  );
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
