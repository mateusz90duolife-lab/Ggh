// Zapisuje public/config.js z publicznych zmiennych środowiskowych (SUPABASE_URL, SUPABASE_ANON_KEY).
// Uruchamiane przez `npm run build` (np. na Vercel). Klucze serwerowe NIGDY nie trafiają do tego pliku.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (/service_role/i.test(key) || /service[_-]?role/i.test(process.env.SUPABASE_ANON_KEY_NAME ?? '')) {
  console.error('BŁĄD: do frontendu trafił klucz service_role. Użyj klucza publishable/anon.');
  process.exit(1);
}
try {
  const payload = key.split('.')[1];
  if (payload && JSON.parse(Buffer.from(payload, 'base64url').toString()).role === 'service_role') {
    console.error('BŁĄD: SUPABASE_ANON_KEY zawiera klucz service_role. Użyj klucza anon/publishable.');
    process.exit(1);
  }
} catch {
  /* klucz nie jest JWT (np. sb_publishable_…) — OK */
}

if (!url || !key) {
  console.warn('UWAGA: brak SUPABASE_URL / SUPABASE_ANON_KEY — aplikacja pokaże ekran „brak konfiguracji”.');
}
mkdirSync(resolve(root, 'public'), { recursive: true });
writeFileSync(
  resolve(root, 'public/config.js'),
  `window.__CONFIG__ = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key })};\n`,
);
console.log(`config.js zapisany (${url ? url : 'pusty'})`);
