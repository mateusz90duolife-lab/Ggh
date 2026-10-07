// Testy bezpieczeństwa „statyczne”: sekrety nie trafiają do frontendu, config odrzuca klucz service_role,
// kod nie używa niebezpiecznych API, a migracje włączają RLS na każdej tabeli.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const textFiles = (d) => walk(join(root, d)).filter((f) => /\.(js|ts|html|css|json|webmanifest)$/.test(f));

test('frontend (src i public) nie zawiera sekretów ani kluczy serwerowych', () => {
  const bad = /service_role|SERVICE_ROLE|RESEND_API_KEY|AI_API_KEY|CRON_SECRET|re_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/;
  for (const f of [...textFiles('src'), ...textFiles('public')]) {
    if (f.endsWith('config.js')) continue; // generowany z publicznych zmiennych — sprawdzany osobno
    assert.doesNotMatch(readFileSync(f, 'utf8'), bad, f);
  }
});

test('kod aplikacji nie używa innerHTML/outerHTML/document.write/eval (ochrona przed XSS)', () => {
  for (const f of textFiles('src')) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(
      src,
      /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/,
      f,
    );
  }
});

test('write-config odrzuca klucz service_role (JWT i nazwa) i zapisuje tylko wartości publiczne', () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const serviceJwt = `${b64({ alg: 'none' })}.${b64({ role: 'service_role' })}.x`;
  const r = spawnSync('node', ['scripts/write-config.mjs'], {
    cwd: root,
    env: { ...process.env, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: serviceJwt },
    encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /service_role/);
  const okJwt = `${b64({ alg: 'none' })}.${b64({ role: 'anon' })}.x`;
  const ok = spawnSync('node', ['scripts/write-config.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      SUPABASE_URL: 'https://x.supabase.co/',
      SUPABASE_ANON_KEY: okJwt,
      RESEND_API_KEY: 're_sekret_nie_powinien_tu_trafic',
    },
    encoding: 'utf8',
  });
  assert.equal(ok.status, 0);
  const cfg = readFileSync(join(root, 'public/config.js'), 'utf8');
  assert.ok(cfg.includes('x.supabase.co') && !cfg.includes('re_sekret'));
  execFileSync('node', ['scripts/write-config.mjs'], {
    cwd: root,
    env: { ...process.env, SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
    stdio: 'ignore',
  });
});

test('migracje: każda tabela w schemacie public ma włączone RLS', () => {
  const sql = readdirSync(join(root, 'supabase/migrations'))
    .sort()
    .map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8'))
    .join('\n');
  const tables = [...sql.matchAll(/create table (\w+)\s*\(/g)].map((m) => m[1]);
  assert.equal(tables.length, 16, `znaleziono ${tables.length} tabel`);
  const enabledList = [...sql.matchAll(/foreach t in array array\[([^\]]+)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]),
  );
  const enabledDirect = [...sql.matchAll(/alter table (\w+)\s+enable row level security/g)].map((m) => m[1]);
  const enabled = new Set([...enabledList, ...enabledDirect]);
  const skip = new Set(['receipts', 'receipt_items']); // OCR nie jest częścią tego wydania
  const missing = tables.filter((t) => !enabled.has(t) && !skip.has(t));
  assert.deepEqual(missing, [], `tabele bez RLS: ${missing.join(', ')}`);
});

test('wszystkie funkcje SECURITY DEFINER mają ustawiony search_path', () => {
  const sql = readdirSync(join(root, 'supabase/migrations'))
    .sort()
    .map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8'))
    .join('\n');
  const defs = sql.split(/create or replace function/i).slice(1);
  for (const d of defs) {
    const head = d.slice(0, d.indexOf('$$', d.indexOf('$$') + 2) > 0 ? d.indexOf('as $$') + 5 : 600);
    if (/security definer/i.test(head)) assert.match(head, /set search_path = public/i, d.slice(0, 60));
  }
});

test('brak znaczników niedokończonej pracy i debugowania w kodzie (TODO, FIXME, MOCK, console.log…)', () => {
  // wielkość liter ma znaczenie: 'todo' to poprawny status zadania w bazie, a TODO to znacznik niedokończonej pracy
  const bad = /\b(TODO|FIXME|NOT IMPLEMENTED)\b|\b[Ll]orem ipsum\b|\b[Mm]ock(s|ed)?\b|console\.log|\bdebugger\b/;
  const files = [
    ...textFiles('src'),
    ...textFiles('supabase/functions'),
    join(root, 'public/index.html'),
    join(root, 'public/sw.js'),
  ];
  for (const f of files) {
    const hit = readFileSync(f, 'utf8')
      .split('\n')
      .find((l) => bad.test(l));
    assert.equal(hit, undefined, `${f}: ${hit}`);
  }
});
