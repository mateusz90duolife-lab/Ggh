import { resetBrowser, setConfig, fakeJwt, storeRef } from './helpers/browserShim.mjs';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const auth = await import('../public/assets/js/api/auth.js');
const db = await import('../public/assets/js/api/db.js');
const queue = await import('../public/assets/js/api/queue.js');
const net = await import('../public/assets/js/api/net.js');
const { NetworkError, ApiError } = await import('../public/assets/js/lib/errors.js');

const URL_ = 'https://x.supabase.co';
const now = () => Math.floor(Date.now() / 1000);
let calls;
let handler;

function tokenResponse(userId = 'user-1', ttl = 3600, refresh = 'r1') {
  const exp = now() + ttl;
  return { access_token: fakeJwt({ sub: userId, exp }), refresh_token: refresh, expires_in: ttl, user: { id: userId, email: 'a@b.pl' } };
}
const J = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(async () => {
  await auth.signOut().catch(() => {});
  resetBrowser();
  setConfig({ SUPABASE_URL: URL_, SUPABASE_ANON_KEY: 'anon-key' });
  net.markOnline();
  calls = [];
  handler = () => J(404, { message: 'nieobsłużone' });
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(input);
    const rec = { method: (init.method ?? 'GET').toUpperCase(), path: u.pathname, query: u.search, headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(rec);
    return handler(rec);
  };
});

async function loginAs(userId = 'user-1', ttl = 3600) {
  handler = (r) => (r.path === '/auth/v1/token' ? J(200, tokenResponse(userId, ttl)) : J(204));
  return auth.signIn('a@b.pl', 'haslo1234');
}

test('signIn: sukces zapisuje sesję i wysyła klucz anon', async () => {
  const s = await loginAs();
  assert.equal(s.user.id, 'user-1');
  assert.equal(auth.getSession().user.id, 'user-1');
  assert.equal(calls[0].headers.apikey, 'anon-key');
  assert.equal(calls[0].query, '?grant_type=password');
  assert.ok(storeRef.has('ros.session'));
});

test('signIn: złe hasło / konto zablokowane / limit prób / brak sieci → czytelne komunikaty', async () => {
  handler = () => J(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
  await assert.rejects(auth.signIn('a@b.pl', 'x'), { message: 'Nieprawidłowy e-mail lub hasło.' });
  handler = () => J(400, { error_code: 'user_banned', msg: 'User is banned' });
  await assert.rejects(auth.signIn('a@b.pl', 'x'), /zablokowane/);
  handler = () => J(429, { msg: 'rate' });
  await assert.rejects(auth.signIn('a@b.pl', 'x'), /Zbyt wiele prób/);
  globalThis.fetch = async () => {
    throw new TypeError('network');
  };
  await assert.rejects(auth.signIn('a@b.pl', 'x'), NetworkError);
  assert.equal(auth.getSession(), null);
});

test('brak konfiguracji → czytelny błąd, bez zapytań', async () => {
  setConfig(undefined);
  await assert.rejects(auth.signIn('a@b.pl', 'x'), /nie jest skonfigurowana/);
  assert.equal(calls.length, 0);
});

test('getAccessToken: odświeża przed wygaśnięciem, jedno odświeżenie dla równoległych wywołań', async () => {
  await loginAs('user-1', 30); // wygasa za 30 s → trzeba odświeżyć
  let refreshes = 0;
  handler = (r) => {
    if (r.query.includes('refresh_token')) {
      refreshes++;
      assert.equal(r.body.refresh_token, 'r1');
      return J(200, tokenResponse('user-1', 3600, 'r2'));
    }
    return J(204);
  };
  const [a, b, c] = await Promise.all([auth.getAccessToken(), auth.getAccessToken(), auth.getAccessToken()]);
  assert.equal(refreshes, 1);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(auth.getSession().refresh_token, 'r2');
});

test('getAccessToken: unieważniony refresh token wylogowuje; brak sieci zachowuje ważny token', async () => {
  await loginAs('user-1', 30);
  handler = () => J(400, { error_code: 'refresh_token_not_found' });
  assert.equal(await auth.getAccessToken(), null);
  assert.equal(auth.getSession(), null);

  await loginAs('user-1', 30);
  const tok = auth.getSession().access_token;
  globalThis.fetch = async () => {
    throw new TypeError('network');
  };
  assert.equal(await auth.getAccessToken(), tok, 'token jeszcze ważny → używamy go mimo braku sieci');
});

test('list: składa zapytanie PostgREST z filtrami, sortowaniem i limitem', async () => {
  await loginAs();
  handler = () => J(200, [{ id: 1 }]);
  const rows = await db.list('tasks', {
    select: 'id,title',
    params: { due_date: db.eq('2026-10-07'), status: db.inList(['todo', 'done']) },
    order: 'created_at.asc',
    limit: 50,
  });
  assert.deepEqual(rows, [{ id: 1 }]);
  const last = calls.at(-1);
  const q = new URLSearchParams(last.query);
  assert.equal(last.path, '/rest/v1/tasks');
  assert.equal(q.get('select'), 'id,title');
  assert.equal(q.get('due_date'), 'eq.2026-10-07');
  assert.equal(q.get('status'), 'in.(todo,done)');
  assert.equal(q.get('order'), 'created_at.asc');
  assert.equal(q.get('limit'), '50');
  assert.ok(last.headers.authorization.startsWith('Bearer '));
  assert.equal(last.headers.apikey, 'anon-key');
});

test('inList: cudzysłowy dla wartości ze znakami specjalnymi', () => {
  assert.equal(db.inList(['a', 'b c', 'd,e']), 'in.(a,"b c","d,e")');
  assert.equal(db.inList([1, 2]), 'in.(1,2)');
});

test('list: brak internetu → dane z pamięci podręcznej (oznaczone jako nieaktualne), a bez cache → błąd', async () => {
  await loginAs();
  handler = () => J(200, [{ id: 'p1', name: 'Mleko' }]);
  await db.list('products', { select: 'id,name' });
  globalThis.fetch = async () => {
    throw new TypeError('network');
  };
  const rows = await db.list('products', { select: 'id,name' });
  assert.deepEqual(rows, [{ id: 'p1', name: 'Mleko' }]);
  assert.equal(net.getNet().offline, true);
  assert.ok(net.getNet().staleSince > 0);
  await assert.rejects(db.list('products', { select: 'id' }), NetworkError, 'inne zapytanie nie ma cache');
  await assert.rejects(db.list('products', { select: 'id,name', cache: false }), NetworkError);
  db.clearCache();
  await assert.rejects(db.list('products', { select: 'id,name' }), NetworkError);
});

test('cache jest per użytkownik (po zmianie konta nie widać cudzych danych)', async () => {
  await loginAs('user-1');
  handler = () => J(200, [{ secret: 1 }]);
  await db.list('products');
  await auth.signOut();
  await loginAs('user-2');
  globalThis.fetch = async () => {
    throw new TypeError('network');
  };
  await assert.rejects(db.list('products'), NetworkError);
});

test('401 → jedno odświeżenie tokenu i ponowienie zapytania', async () => {
  await loginAs();
  let first = true;
  handler = (r) => {
    if (r.query.includes('refresh_token')) return J(200, tokenResponse('user-1', 3600, 'r9'));
    if (first) {
      first = false;
      return J(401, { message: 'JWT expired', code: 'PGRST301' });
    }
    return J(200, [{ ok: true }]);
  };
  assert.deepEqual(await db.list('tasks'), [{ ok: true }]);
});

test('błędy PostgREST są tłumaczone; RPC z komunikatem po polsku przechodzi wprost', async () => {
  await loginAs();
  handler = () => J(400, { code: 'P0001', message: 'Zakup został już przetworzony' });
  await assert.rejects(db.rpc('confirm_purchase', { p_purchase_id: 'x' }), { message: 'Zakup został już przetworzony' });
  handler = () => J(403, { code: '42501', message: 'new row violates row-level security policy for table "products"' });
  await assert.rejects(db.insert('products', { name: 'x' }), { message: 'Brak uprawnień do tej operacji.' });
});

test('insert/update/remove/rpc/callFunction: poprawne metody, nagłówki i ciało', async () => {
  await loginAs();
  handler = () => J(201, [{ id: 'n1' }]);
  await db.insert('products', { name: 'Ser' });
  assert.equal(calls.at(-1).method, 'POST');
  assert.equal(calls.at(-1).headers.prefer, 'return=representation');
  assert.deepEqual(calls.at(-1).body, { name: 'Ser' });
  handler = () => J(200, [{ id: 'n1' }]);
  await db.update('products', { id: db.eq('n1') }, { active: false });
  assert.equal(calls.at(-1).method, 'PATCH');
  assert.equal(calls.at(-1).query, '?id=eq.n1');
  handler = () => J(204);
  await db.remove('tasks', { id: db.eq('t1') });
  assert.equal(calls.at(-1).method, 'DELETE');
  handler = () => J(200, 'uuid-123');
  assert.equal(await db.rpc('submit_inventory_count', { p_items: [] }), 'uuid-123');
  assert.equal(calls.at(-1).path, '/rest/v1/rpc/submit_inventory_count');
  handler = () => J(200, { users: [] });
  await db.callFunction('admin-users', { action: 'list' });
  assert.equal(calls.at(-1).path, '/functions/v1/admin-users');
  handler = () => J(403, { error: 'Tylko właściciel może zarządzać kontami.' });
  await assert.rejects(db.callFunction('admin-users', { action: 'list' }), { message: 'Tylko właściciel może zarządzać kontami.' });
});

test('update/remove bez filtra są zablokowane (ochrona przed masową zmianą)', async () => {
  await loginAs();
  await assert.rejects(db.update('products', {}, { active: false }), ApiError);
  await assert.rejects(db.remove('tasks', {}), ApiError);
});

test('kolejka offline: wysyła po kolei z client_id, usuwa wysłane', async () => {
  await loginAs();
  queue.enqueue({ kind: 'report_shortage', label: 'Mleko — 10 L', args: { p_product_id: 'p1', p_quantity: 10, p_urgent: false, p_note: null } });
  queue.enqueue({ kind: 'complete_task', label: 'Sprzątanie', args: { p_task_id: 't1', p_done: true } });
  const ids = queue.listQueue().map((i) => i.id);
  assert.equal(queue.pendingCount(), 2);
  handler = () => J(200, {});
  const r = await queue.flushQueue();
  assert.deepEqual(r, { sent: 2, failed: 0, remaining: 0 });
  const rpcCalls = calls.filter((c) => c.path.startsWith('/rest/v1/rpc/'));
  assert.equal(rpcCalls[0].path, '/rest/v1/rpc/report_shortage');
  assert.equal(rpcCalls[0].body.p_client_id, ids[0], 'idempotencja: client_id = id elementu kolejki');
  assert.equal(rpcCalls[1].path, '/rest/v1/rpc/complete_task');
  assert.equal(queue.listQueue().length, 0);
});

test('kolejka offline: brak sieci zatrzymuje wysyłkę, elementy zostają', async () => {
  await loginAs();
  queue.enqueue({ kind: 'report_shortage', label: 'a', args: { p_product_id: 'p1', p_quantity: 1, p_urgent: false, p_note: null } });
  queue.enqueue({ kind: 'report_shortage', label: 'b', args: { p_product_id: 'p2', p_quantity: 2, p_urgent: false, p_note: null } });
  globalThis.fetch = async () => {
    throw new TypeError('network');
  };
  const r = await queue.flushQueue();
  assert.deepEqual(r, { sent: 0, failed: 0, remaining: 2 });
  assert.equal(queue.listQueue().length, 2);
});

test('kolejka offline: błąd 4xx oznacza element jako nieudany (widoczny), pozostałe są wysyłane; 5xx zatrzymuje', async () => {
  await loginAs();
  queue.enqueue({ kind: 'report_shortage', label: 'zły', args: { p_product_id: 'x', p_quantity: 1, p_urgent: false, p_note: null } });
  queue.enqueue({ kind: 'report_shortage', label: 'dobry', args: { p_product_id: 'p2', p_quantity: 2, p_urgent: false, p_note: null } });
  handler = (r) => (r.body.p_product_id === 'x' ? J(400, { code: 'P0001', message: 'Produkt nie istnieje lub jest nieaktywny' }) : J(200, {}));
  const r = await queue.flushQueue();
  assert.deepEqual(r, { sent: 1, failed: 1, remaining: 0 });
  const failed = queue.failedItems();
  assert.equal(failed.length, 1);
  assert.equal(failed[0].error, 'Produkt nie istnieje lub jest nieaktywny');
  queue.removeFromQueue(failed[0].id);
  assert.equal(queue.listQueue().length, 0);

  queue.enqueue({ kind: 'report_shortage', label: 'a', args: { p_product_id: 'p1', p_quantity: 1, p_urgent: false, p_note: null } });
  handler = () => J(503, {});
  const r2 = await queue.flushQueue();
  assert.equal(r2.remaining, 1, 'błąd serwera 5xx: element zostaje do ponowienia');
  assert.equal(queue.failedItems().length, 0);
});

test('kolejka offline: ostatnia decyzja o zadaniu wygrywa; równoległe flush = jedna wysyłka', async () => {
  await loginAs();
  queue.enqueue({ kind: 'complete_task', label: 't', args: { p_task_id: 't1', p_done: true } });
  queue.enqueue({ kind: 'complete_task', label: 't', args: { p_task_id: 't1', p_done: false } });
  assert.equal(queue.listQueue().length, 1);
  assert.equal(queue.listQueue()[0].args.p_done, false);
  handler = () => J(200, {});
  await Promise.all([queue.flushQueue(), queue.flushQueue()]);
  assert.equal(calls.filter((c) => c.path.endsWith('/complete_task')).length, 1);
});

test('kolejka jest per użytkownik', async () => {
  await loginAs('user-1');
  queue.enqueue({ kind: 'complete_task', label: 't', args: { p_task_id: 't1', p_done: true } });
  await auth.signOut();
  await loginAs('user-2');
  assert.equal(queue.listQueue().length, 0);
});

test('consumeAuthHash: reset hasła wczytuje sesję; błędy i zwykłe trasy są rozpoznawane', async () => {
  assert.equal(auth.consumeAuthHash('#/dzisiaj'), null);
  assert.equal(auth.consumeAuthHash(''), null);
  const err = auth.consumeAuthHash('#error=access_denied&error_code=otp_expired&error_description=x');
  assert.equal(err.type, 'error');
  assert.match(err.error, /wygasł/);
  const tok = fakeJwt({ sub: 'u9', exp: now() + 3600 });
  const r = auth.consumeAuthHash(`#access_token=${tok}&refresh_token=rr&expires_in=3600&type=recovery`);
  assert.deepEqual(r, { type: 'recovery' });
  assert.equal(auth.getSession().user.id, 'u9');
});

test('requestPasswordReset zawsze neutralny (nie ujawnia istnienia konta); updatePassword mapuje błędy', async () => {
  handler = () => J(400, { msg: 'User not found' });
  await auth.requestPasswordReset('nie@ma.pl');
  assert.match(calls.at(-1).query, /redirect_to=https%3A%2F%2Fapp\.test%2F/);
  await loginAs();
  handler = () => J(422, { msg: 'New password should be different from the old password.' });
  await assert.rejects(auth.updatePassword('haslo1234'), /różnić się/);
  handler = () => J(200, {});
  await auth.updatePassword('haslo12345');
  assert.equal(calls.at(-1).method, 'PUT');
});

test('signOut czyści sesję lokalnie nawet bez sieci', async () => {
  await loginAs();
  globalThis.fetch = async () => {
    throw new TypeError('network');
  };
  await auth.signOut();
  assert.equal(auth.getSession(), null);
  assert.equal(storeRef.has('ros.session'), false);
});
