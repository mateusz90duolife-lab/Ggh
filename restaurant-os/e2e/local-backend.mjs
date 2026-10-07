// Lokalny backend TESTOWY zgodny z API Supabase (GoTrue + PostgREST + funkcje Edge) na prawdziwym PostgreSQL.
// Służy wyłącznie do testów E2E: SQL (RLS, RPC, triggery) wykonuje się naprawdę, a tłumaczenie zapytań PostgREST
// obsługuje tylko podzbiór składni używany przez aplikację. NIE jest to zamiennik Supabase na produkcji.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAdminUsers } from '../supabase/functions/_shared/adminUsers.ts';
import { handleDailySummary } from '../supabase/functions/_shared/dailySummary.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IDENT = /^[a-z_][a-z0-9_]*$/i;

function psql(db, sql) {
  return new Promise((ok) => {
    const p = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', db], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => ok({ code, out: out.trim(), err: err.trim() }));
    p.stdin.end(sql);
  });
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

export async function startBackend({ db = 'ros_e2e', port = 0, ttl = 3600 } = {}) {
  // ---- baza: czysta, z atrapą schematu Supabase + migracjami ----
  const admin = async (sql) => {
    const r = await psql(db, sql);
    if (r.code !== 0) throw new Error(`SQL: ${r.err}\n${sql.slice(0, 300)}`);
    return r.out;
  };
  await new Promise((ok) => spawn('dropdb', ['--if-exists', db]).on('close', ok));
  await new Promise((ok, no) =>
    spawn('createdb', [db]).on('close', (c) => (c === 0 ? ok() : no(new Error('createdb')))),
  );
  const mock = readFileSync(join(root, 'supabase/tests/00_supabase_mock.sql'), 'utf8');
  await admin(mock);
  await admin(
    `create table auth.fake_users (id uuid primary key, email text unique not null, password text not null, banned boolean not null default false);`,
  );
  for (const f of readdirSync(join(root, 'supabase/migrations')).sort())
    await admin(readFileSync(join(root, 'supabase/migrations', f), 'utf8'));
  await admin(
    `grant all on all tables in schema public to authenticated; grant usage on all sequences in schema public to authenticated;`,
  );

  // ---- stan serwera ----
  const state = {
    tokens: new Map(), // access_token -> {sub, role, exp}
    refresh: new Map(), // refresh_token -> userId
    mails: [], // „wysłane” e-maile (Resend) i linki resetu hasła
    clock: null, // nadpisanie czasu dla funkcji crona
    ttl,
    resendFail: false,
    requests: [],
  };
  const SERVICE = (() => {
    const t = `${b64({ alg: 'none' })}.${b64({ role: 'service_role', sub: 'service' })}.sig`;
    state.tokens.set(t, { sub: 'service', role: 'service_role', exp: 4102444800 });
    return t;
  })();
  const ANON_KEY = `${b64({ alg: 'none' })}.${b64({ role: 'anon' })}.sig`;
  let baseUrl = '';

  function issue(userId) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + state.ttl;
    const access = `${b64({ alg: 'none' })}.${b64({ sub: userId, role: 'authenticated', exp, jti: randomUUID() })}.sig`;
    const refresh = randomBytes(12).toString('hex');
    state.tokens.set(access, { sub: userId, role: 'authenticated', exp });
    state.refresh.set(refresh, userId);
    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: state.ttl,
      expires_at: exp,
      token_type: 'bearer',
    };
  }

  function principal(req) {
    const t = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const hit = state.tokens.get(t);
    if (hit && hit.exp > Math.floor(Date.now() / 1000)) return hit;
    if (hit) return { expired: true };
    return { sub: null, role: 'anon' };
  }

  const json = (res, status, body, extra = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...extra });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  // ---- tłumaczenie PostgREST → SQL ----
  function parseFilter(col, raw) {
    if (!IDENT.test(col)) throw new Error('bad column');
    let v = raw;
    let neg = false;
    if (v.startsWith('not.')) {
      neg = true;
      v = v.slice(4);
    }
    const dot = v.indexOf('.');
    const op = v.slice(0, dot);
    const val = v.slice(dot + 1);
    const c = `"${col}"`;
    const ops = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
    let sql;
    if (ops[op]) sql = `${c} ${ops[op]} ${lit(val)}`;
    else if (op === 'is') sql = `${c} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      const inner = val.replace(/^\(/, '').replace(/\)$/, '');
      const items = [...inner.matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)].map((m) => m[1] ?? m[2]);
      sql = items.length ? `${c}::text in (${items.map(lit).join(',')})` : 'false';
    } else if (op === 'ilike' || op === 'like') sql = `${c}::text ${op} ${lit(val.replace(/\*/g, '%'))}`;
    else throw new Error('unsupported op ' + op);
    return neg ? `not (${sql})` : sql;
  }
  const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);
  function where(params) {
    const parts = [];
    for (const [k, v] of params) if (!RESERVED.has(k)) parts.push(parseFilter(k, v));
    return parts.length ? ` where ${parts.join(' and ')}` : '';
  }
  function orderBy(params) {
    const o = params.get('order');
    if (!o) return '';
    return (
      ' order by ' +
      o
        .split(',')
        .map((p) => {
          const [col, ...mods] = p.split('.');
          if (!IDENT.test(col)) throw new Error('bad order');
          return `"${col}" ${mods.includes('desc') ? 'desc' : 'asc'}${mods.includes('nullslast') ? ' nulls last' : mods.includes('nullsfirst') ? ' nulls first' : ''}`;
        })
        .join(', ')
    );
  }
  function cols(params) {
    const s = params.get('select') ?? '*';
    if (s === '*') return '*';
    return s
      .split(',')
      .map((c) => {
        if (!IDENT.test(c)) throw new Error('unsupported select ' + c);
        return `"${c}"`;
      })
      .join(', ');
  }
  function setClause(body) {
    return Object.entries(body)
      .map(([k, v]) => {
        if (!IDENT.test(k)) throw new Error('bad column');
        return `"${k}" = ${valueLit(v)}`;
      })
      .join(', ');
  }
  function valueLit(v) {
    if (v === null) return 'null';
    if (Array.isArray(v))
      return v.every((x) => typeof x !== 'object')
        ? `'{${v.map((x) => `"${String(x).replace(/(["\\])/g, '\\$1')}"`).join(',')}}'`
        : lit(JSON.stringify(v));
    if (typeof v === 'object') return lit(JSON.stringify(v));
    return lit(v);
  }

  const typtypeCache = new Map();
  async function returnKind(fn) {
    if (typtypeCache.has(fn)) return typtypeCache.get(fn);
    const r = await admin(
      `select t.typtype::text || ':' || t.typname::text from pg_proc p join pg_type t on t.oid = p.prorettype join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = ${lit(fn)} limit 1;`,
    );
    typtypeCache.set(fn, r);
    return r;
  }

  async function runAs(pr, statement) {
    const roleSql =
      pr.role === 'service_role'
        ? ''
        : `set local role ${pr.role === 'authenticated' ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', ${lit(pr.sub ?? '')}, true);`;
    const script = `\\set VERBOSITY verbose\nbegin;\n\\o /dev/null\n${roleSql}\n\\o\n${statement}\ncommit;\n`;
    const r = await psql(db, script);
    if (r.code !== 0) {
      const m = /ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/.exec(r.err) ?? [];
      const code = m[1] ?? 'XX000';
      const message = (m[2] ?? r.err).trim();
      const status =
        code === '42501'
          ? pr.role === 'anon'
            ? 401
            : 403
          : code === '23505' || code === '23503'
            ? 409
            : code === '42883' || code === '42P01'
              ? 404
              : 400;
      return { error: { status, body: { code, message, details: null, hint: null } } };
    }
    return { out: r.out };
  }

  async function rest(req, res, url, body) {
    const pr = principal(req);
    if (pr.expired) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
    const p = url.pathname.replace('/rest/v1/', '');
    const params = url.searchParams;
    const wantRepr = /return=representation/.test(req.headers.prefer ?? '');
    let statement;
    let expectStatus = 200;
    if (p.startsWith('rpc/')) {
      const fn = p.slice(4);
      if (!IDENT.test(fn)) return json(res, 404, { message: 'bad fn' });
      const args = Object.entries(body ?? {})
        .map(([k, v]) => `"${k}" => ${valueLit(v)}`)
        .join(', ');
      const kind = await returnKind(fn);
      if (!kind) return json(res, 404, { code: '42883', message: `Could not find the function public.${fn}` });
      if (kind === 'p:void') statement = `select public."${fn}"(${args});`;
      else if (kind.startsWith('c:')) statement = `select to_jsonb(r) from public."${fn}"(${args}) r;`;
      else statement = `select to_jsonb(public."${fn}"(${args}));`;
      const r = await runAs(pr, statement);
      if (r.error) return json(res, r.error.status, r.error.body);
      return kind === 'p:void' ? json(res, 204) : json(res, 200, r.out ? JSON.parse(r.out) : null);
    }
    const table = p;
    if (!IDENT.test(table)) return json(res, 404, { message: 'bad table' });
    const t = `public."${table}"`;
    if (req.method === 'GET') {
      let lim = params.get('limit') ? ` limit ${Number(params.get('limit'))}` : '';
      statement = `select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (select ${cols(params)} from ${t}${where(params)}${orderBy(params)}${lim}) q;`;
    } else if (req.method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      keys.forEach((k) => {
        if (!IDENT.test(k)) throw new Error('bad column');
      });
      const values = rows
        .map((r) => `(${keys.map((k) => (k in r ? valueLit(r[k]) : 'default')).join(', ')})`)
        .join(', ');
      const conflict =
        params.get('on_conflict') && /ignore-duplicates/.test(req.headers.prefer ?? '')
          ? ` on conflict (${params
              .get('on_conflict')
              .split(',')
              .map((c) => `"${c}"`)
              .join(',')}) do nothing`
          : '';
      statement = `with ins as (insert into ${t} (${keys.map((k) => `"${k}"`).join(',')}) values ${values}${conflict} returning *) select coalesce(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) from ins;`;
      expectStatus = 201;
    } else if (req.method === 'PATCH') {
      statement = `with upd as (update ${t} set ${setClause(body)}${where(params)} returning *) select coalesce(jsonb_agg(to_jsonb(upd)), '[]'::jsonb) from upd;`;
    } else if (req.method === 'DELETE') {
      statement = `with del as (delete from ${t}${where(params)} returning *) select coalesce(jsonb_agg(to_jsonb(del)), '[]'::jsonb) from del;`;
    } else return json(res, 405, { message: 'method' });
    const r = await runAs(pr, statement);
    if (r.error) return json(res, r.error.status, r.error.body);
    const data = r.out ? JSON.parse(r.out) : [];
    if (req.method === 'GET' || wantRepr) return json(res, expectStatus, data);
    return json(res, req.method === 'POST' ? 201 : 204);
  }

  // ---- GoTrue ----
  async function auth(req, res, url, body) {
    const p = url.pathname.replace('/auth/v1', '');
    const q = (s) => admin(s);
    if (p === '/token') {
      const gt = url.searchParams.get('grant_type');
      if (gt === 'password') {
        const row = await q(
          `select id || '|' || banned from auth.fake_users where email = ${lit(String(body.email ?? '').toLowerCase())} and password = ${lit(body.password)};`,
        );
        if (!row) return json(res, 400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        const [id, banned] = row.split('|');
        if (banned === 'true') return json(res, 400, { error_code: 'user_banned', msg: 'User is banned' });
        const email = await q(`select email from auth.fake_users where id = '${id}';`);
        return json(res, 200, { ...issue(id), user: { id, email } });
      }
      if (gt === 'refresh_token') {
        const id = state.refresh.get(body.refresh_token);
        if (!id) return json(res, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        const banned = await q(`select banned from auth.fake_users where id = '${id}';`);
        if (banned === 't') {
          state.refresh.delete(body.refresh_token);
          return json(res, 400, { error_code: 'user_banned', msg: 'User is banned' });
        }
        state.refresh.delete(body.refresh_token);
        const email = await q(`select email from auth.fake_users where id = '${id}';`);
        return json(res, 200, { ...issue(id), user: { id, email } });
      }
    }
    if (p === '/logout') {
      const pr = principal(req);
      for (const [k, v] of state.refresh) if (v === pr.sub) state.refresh.delete(k);
      return json(res, 204);
    }
    if (p === '/recover') {
      const email = String(body.email ?? '').toLowerCase();
      const id = await q(`select id from auth.fake_users where email = ${lit(email)};`);
      if (id) {
        const tok = issue(id);
        state.mails.push({
          kind: 'recovery',
          to: email,
          link: `${url.searchParams.get('redirect_to') ?? ''}#access_token=${tok.access_token}&refresh_token=${tok.refresh_token}&expires_in=${tok.expires_in}&type=recovery`,
        });
      }
      return json(res, 200, {});
    }
    if (p === '/user' && req.method === 'GET') {
      const pr = principal(req);
      if (!pr.sub || pr.expired) return json(res, 401, { msg: 'invalid JWT' });
      const email = await q(`select email from auth.fake_users where id = '${pr.sub}';`);
      return json(res, 200, { id: pr.sub, email });
    }
    if (p === '/user' && req.method === 'PUT') {
      const pr = principal(req);
      if (!pr.sub || pr.expired) return json(res, 401, { msg: 'invalid JWT' });
      const cur = await q(`select password from auth.fake_users where id = '${pr.sub}';`);
      if (body.password === cur)
        return json(res, 422, { msg: 'New password should be different from the old password.' });
      if (String(body.password ?? '').length < 6)
        return json(res, 422, { msg: 'Password should be at least 6 characters.' });
      await q(`update auth.fake_users set password = ${lit(body.password)} where id = '${pr.sub}';`);
      return json(res, 200, { id: pr.sub });
    }
    if (p.startsWith('/admin/')) {
      const pr = principal(req);
      if (pr.role !== 'service_role') return json(res, 403, { msg: 'not admin' });
      if (p === '/admin/users' && req.method === 'GET') {
        const out = await q(
          `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email)), '[]'::jsonb) from auth.fake_users;`,
        );
        return json(res, 200, { users: JSON.parse(out) });
      }
      if (p === '/admin/users' && req.method === 'POST') {
        const email = String(body.email).toLowerCase();
        if (await q(`select 1 from auth.fake_users where email = ${lit(email)};`))
          return json(res, 422, { msg: 'A user with this email address has already been registered' });
        const id = randomUUID();
        await q(
          `insert into auth.users(id) values ('${id}'); insert into auth.fake_users(id, email, password) values ('${id}', ${lit(email)}, ${lit(body.password)});`,
        );
        return json(res, 200, { id, email });
      }
      const m = /^\/admin\/users\/([0-9a-f-]{36})$/.exec(p);
      if (m && req.method === 'PUT') {
        if (body.password) await q(`update auth.fake_users set password = ${lit(body.password)} where id = '${m[1]}';`);
        if (body.ban_duration)
          await q(`update auth.fake_users set banned = ${body.ban_duration !== 'none'} where id = '${m[1]}';`);
        return json(res, 200, { id: m[1] });
      }
      if (m && req.method === 'DELETE') {
        await q(`delete from auth.fake_users where id = '${m[1]}'; delete from auth.users where id = '${m[1]}';`);
        return json(res, 200, {});
      }
    }
    return json(res, 404, { msg: 'nieobsłużone ' + req.method + ' ' + p });
  }

  // ---- funkcje Edge: prawdziwe handlery, a „internet” to ten sam serwer + atrapa Resend ----
  const innerFetch = async (input, init) => {
    if (String(input).startsWith('https://api.resend.com/')) {
      if (state.resendFail) return new Response(JSON.stringify({ message: 'fail' }), { status: 422 });
      const b = JSON.parse(init.body);
      state.mails.push({ kind: 'mail', ...b });
      return new Response(JSON.stringify({ id: `re_${state.mails.length}` }), { status: 200 });
    }
    return fetch(input, init);
  };
  const FN_ENV = () => ({
    SUPABASE_URL: baseUrl,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    CRON_SECRET: 'cron-secret',
    RESEND_API_KEY: 're_test',
    MAIL_FROM: 'Restauracja <lista@example.com>',
  });
  async function fn(req, res, url, rawBody) {
    const name = url.pathname.replace('/functions/v1/', '');
    const webReq = new Request(`${baseUrl}${url.pathname}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : rawBody,
    });
    let out;
    if (name === 'admin-users') out = await handleAdminUsers(webReq, FN_ENV(), innerFetch);
    else if (name === 'daily-shopping-summary')
      out = await handleDailySummary(webReq, {
        env: FN_ENV(),
        fetchFn: innerFetch,
        now: () => (state.clock ? new Date(state.clock) : new Date()),
      });
    else return json(res, 404, { error: 'nie ma takiej funkcji' });
    const text = await out.text();
    res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
    res.end(text);
  }

  const server = createServer(async (req, res) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-expose-headers': '*',
    };
    const origWrite = res.writeHead.bind(res);
    res.writeHead = (status, headers = {}) => origWrite(status, { ...cors, ...headers });
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    try {
      const url = new URL(req.url, baseUrl || 'http://x');
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      state.requests.push(`${req.method} ${url.pathname}${url.search}`);
      const body =
        raw && url.pathname.startsWith('/rest')
          ? JSON.parse(raw)
          : raw && !url.pathname.startsWith('/functions')
            ? JSON.parse(raw)
            : undefined;
      if (url.pathname.startsWith('/rest/v1/')) return await rest(req, res, url, body);
      if (url.pathname.startsWith('/auth/v1/')) return await auth(req, res, url, body ?? {});
      if (url.pathname.startsWith('/functions/v1/')) return await fn(req, res, url, raw);
      return json(res, 404, { message: 'not found' });
    } catch (e) {
      return json(res, 500, { message: `backend testowy: ${e.message}` });
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    url: baseUrl,
    anonKey: ANON_KEY,
    state,
    sql: admin,
    close: () => new Promise((ok) => server.close(ok)),
  };
}

/** Dane startowe: lokal, 4 użytkowników, kategorie, produkty ze stanami, szablon zadań. */
export async function seed(be) {
  const ids = {
    rest: '00000000-0000-0000-0000-0000000000a1',
    owner: '10000000-0000-0000-0000-000000000001',
    manager: '10000000-0000-0000-0000-000000000002',
    ewa: '10000000-0000-0000-0000-000000000003',
    piotr: '10000000-0000-0000-0000-000000000004',
  };
  const users = [
    [ids.owner, 'wlasciciel@example.com', 'Jan Właściciel', 'owner'],
    [ids.manager, 'manager@example.com', 'Anna Manager', 'manager'],
    [ids.ewa, 'ewa@example.com', 'Ewa Pracownik', 'employee'],
    [ids.piotr, 'piotr@example.com', 'Piotr Kowalski', 'employee'],
  ];
  const PASSWORD = 'Haslo1234!';
  let sql = `insert into restaurants (id, name, timezone, summary_time, summary_emails) values ('${ids.rest}', 'Bistro Testowe', 'Europe/Warsaw', '21:00', '{wlasciciel@example.com}');`;
  for (const [id, email, name, role] of users) {
    sql += `insert into auth.users(id) values ('${id}'); insert into auth.fake_users(id, email, password) values ('${id}', '${email}', '${PASSWORD}'); insert into profiles (id, restaurant_id, full_name, role) values ('${id}', '${ids.rest}', '${name}', '${role}');`;
  }
  const cats = { nabial: 1, warzywa: 2, mieso: 3, suche: 4 };
  const catId = (n) => `20000000-0000-0000-0000-00000000000${n}`;
  const catNames = { 1: 'Nabiał', 2: 'Warzywa', 3: 'Mięso', 4: 'Suche' };
  for (const n of [1, 2, 3, 4])
    sql += `insert into product_categories (id, restaurant_id, name, sort_order) values ('${catId(n)}', '${ids.rest}', '${catNames[n]}', ${n});`;
  const prods = [
    ['Mleko 3,2%', 'l', 10, cats.nabial, 12],
    ['Śmietana', 'l', 2, cats.nabial, 1],
    ['Ser żółty', 'kg', 2, cats.nabial, 0],
    ['Pomidor', 'kg', 5, cats.warzywa, 8],
    ['Kurczak', 'kg', 5, cats.mieso, 4],
    ['Mąka', 'kg', 10, cats.suche, 25],
    ['Jajka', 'szt', 60, cats.suche, 120],
  ];
  const pid = {};
  prods.forEach(([name, unit, min, cat, stock], i) => {
    const id = `30000000-0000-0000-0000-0000000000${String(i + 1).padStart(2, '0')}`;
    pid[name] = id;
    sql += `insert into products (id, restaurant_id, name, unit, minimum_stock, category_id) values ('${id}', '${ids.rest}', '${name}', '${unit}', ${min}, '${catId(cat)}');`;
    if (stock > 0)
      sql += `insert into inventory_movements (restaurant_id, product_id, type, quantity_delta, note, created_by) values ('${ids.rest}', '${id}', 'adjustment', ${stock}, 'Stan początkowy', '${ids.manager}');`;
  });
  sql += `insert into task_templates (restaurant_id, title, days_of_week, created_by) values ('${ids.rest}', 'Posprzątać chłodnię', '{1,2,3,4,5,6,7}', '${ids.owner}'), ('${ids.rest}', 'Przygotować sosy', '{1,2,3,4,5,6,7}', '${ids.owner}');`;
  sql += `select generate_tasks_for('${ids.rest}', (now() at time zone 'Europe/Warsaw')::date);`;
  await be.sql(sql);
  return { ids, pid, password: PASSWORD, emails: Object.fromEntries(users.map(([id, email]) => [id, email])) };
}
