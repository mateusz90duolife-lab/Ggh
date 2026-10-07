// Prosta atrapa Supabase (GoTrue + PostgREST + Resend) dla testów funkcji Edge. Tylko to, czego używają funkcje.
export function createFake({ restaurants = [], profiles = [], shopping = [], tokens = {}, emails = [], clock = () => new Date() } = {}) {
  const state = {
    restaurants,
    profiles,
    shopping,
    emailLog: [],
    authUsers: new Map(), // id -> {id,email,banned,password}
    sent: [], // wysłane maile (Resend)
    resendFail: false,
    profileInsertFail: false,
    calls: [],
    tokens, // token -> userId
  };
  for (const u of emails) state.authUsers.set(u.id, { ...u });
  let seq = 0;

  const J = (status, body) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  function filterRows(rows, params) {
    return rows.filter((r) => {
      for (const [k, v] of params) {
        if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
        if (k === 'or') {
          const m = /status\.eq\.failed,and\(status\.eq\.sending,claimed_at\.lt\.([^)]+)\)/.exec(v);
          if (!m) throw new Error('fake: nieobsługiwane or=' + v);
          const stuck = r.status === 'sending' && r.claimed_at < m[1];
          if (!(r.status === 'failed' || stuck)) return false;
          continue;
        }
        if (v.startsWith('eq.') && String(r[k]) !== v.slice(3)) return false;
      }
      return true;
    });
  }

  async function fetchFn(input, init = {}) {
    const url = new URL(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push(`${method} ${url.pathname}${url.search}`);
    const auth = (init.headers?.authorization ?? init.headers?.Authorization ?? '').replace(/^Bearer /i, '');

    if (url.hostname === 'api.resend.com') {
      if (state.resendFail) return J(422, { message: 'domain not verified' });
      state.sent.push({ auth, ...body });
      return J(200, { id: `re_${++seq}` });
    }

    const p = url.pathname;
    if (p === '/auth/v1/user') {
      const id = state.tokens[auth];
      return id ? J(200, { id }) : J(401, { msg: 'invalid' });
    }
    if (p === '/auth/v1/admin/users' && method === 'GET') {
      return J(200, { users: [...state.authUsers.values()].map(({ password: _p, ...u }) => u) });
    }
    if (p === '/auth/v1/admin/users' && method === 'POST') {
      if ([...state.authUsers.values()].some((u) => u.email === body.email)) return J(422, { msg: 'already registered' });
      const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
      state.authUsers.set(id, { id, email: body.email, password: body.password });
      return J(200, { id, email: body.email });
    }
    let m = /^\/auth\/v1\/admin\/users\/([^/]+)$/.exec(p);
    if (m) {
      const u = state.authUsers.get(m[1]);
      if (!u) return J(404, {});
      if (method === 'DELETE') {
        state.authUsers.delete(m[1]);
        return J(200, {});
      }
      if (method === 'PUT') {
        if (body.password) u.password = body.password;
        if (body.ban_duration) u.banned = body.ban_duration !== 'none';
        return J(200, { id: u.id });
      }
    }

    m = /^\/rest\/v1\/(\w+)$/.exec(p);
    if (m) {
      const table = m[1];
      const rows =
        table === 'profiles'
          ? state.profiles
          : table === 'restaurants'
            ? state.restaurants
            : table === 'shopping_list'
              ? state.shopping
              : table === 'email_log'
                ? state.emailLog
                : null;
      if (!rows) return J(404, { message: 'no table ' + table });
      if (method === 'GET') return J(200, filterRows(rows, url.searchParams));
      if (method === 'POST') {
        if (table === 'profiles' && state.profileInsertFail) return J(500, { message: 'fail' });
        if (table === 'email_log') {
          const key = (r) => `${r.restaurant_id}|${r.kind}|${r.local_date}`;
          if (rows.some((r) => key(r) === key(body))) return J(201, []); // ignore-duplicates
          const row = { id: `log${++seq}`, claimed_at: clock().toISOString(), ...body };
          rows.push(row);
          return J(201, [row]);
        }
        const row = { created_at: new Date().toISOString(), active: true, ...body };
        rows.push(row);
        return J(201, [row]);
      }
      if (method === 'PATCH') {
        const hit = filterRows(rows, url.searchParams);
        for (const r of hit) Object.assign(r, body);
        return J(200, hit);
      }
    }
    return J(404, { message: 'fake: nieobsłużone ' + method + ' ' + p });
  }

  return { state, fetchFn };
}

export const R_A = '00000000-0000-0000-0000-0000000000a1';
export const R_B = '00000000-0000-0000-0000-0000000000b1';
export const U = {
  owner: '10000000-0000-4000-8000-000000000001',
  manager: '10000000-0000-4000-8000-000000000002',
  employee: '10000000-0000-4000-8000-000000000003',
  otherOwner: '10000000-0000-4000-8000-000000000009',
};
export function baseProfiles() {
  return [
    { id: U.owner, restaurant_id: R_A, full_name: 'Właściciel', role: 'owner', active: true, created_at: '2026-01-01' },
    { id: U.manager, restaurant_id: R_A, full_name: 'Manager', role: 'manager', active: true, created_at: '2026-01-02' },
    { id: U.employee, restaurant_id: R_A, full_name: 'Pracownik', role: 'employee', active: true, created_at: '2026-01-03' },
    { id: U.otherOwner, restaurant_id: R_B, full_name: 'Obcy', role: 'owner', active: true, created_at: '2026-01-04' },
  ];
}
export const baseTokens = { 't-owner': U.owner, 't-manager': U.manager, 't-employee': U.employee, 't-other': U.otherOwner };
export const baseEnv = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  CRON_SECRET: 'cron-secret',
  RESEND_API_KEY: 're_key',
  MAIL_FROM: 'Restauracja <lista@example.com>',
};
export function post(body, token, extra = {}) {
  return new Request('https://f/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
    body: JSON.stringify(body ?? {}),
  });
}
