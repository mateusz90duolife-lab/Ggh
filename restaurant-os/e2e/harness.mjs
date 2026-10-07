import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBackend, seed } from './local-backend.mjs';
import { startStaticServer } from '../scripts/serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const ARTIFACTS = resolve(here, '.artifacts');
mkdirSync(ARTIFACTS, { recursive: true });

async function loadPlaywright() {
  const candidates = ['playwright', `${execSync('npm root -g').toString().trim()}/playwright/index.mjs`];
  for (const c of candidates) {
    try {
      return await import(c);
    } catch {
      /* próbuj dalej */
    }
  }
  throw new Error('Brak pakietu playwright (npm i -D playwright albo zainstaluj globalnie).');
}

export async function setup({ db = 'ros_e2e', ttl = 3600 } = {}) {
  const pw = await loadPlaywright();
  const be = await startBackend({ db, ttl });
  const data = await seed(be);
  const config = `window.__CONFIG__ = ${JSON.stringify({ SUPABASE_URL: be.url, SUPABASE_ANON_KEY: be.anonKey })};\n`;
  const web = await startStaticServer(0, '127.0.0.1', { '/config.js': config });
  const appUrl = `http://127.0.0.1:${web.port}`;
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  return {
    be,
    data,
    appUrl,
    browser,
    async context(opts = {}) {
      return browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: 'pl-PL',
        timezoneId: 'Europe/Warsaw',
        ...opts,
      });
    },
    async close() {
      await browser.close();
      web.server.close();
      await be.close();
    },
  };
}

/** Loguje użytkownika w danym kontekście i zwraca stronę po wejściu do aplikacji. */
export async function loginAs(env, ctx, email, password = env.data.password) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('BŁĄD STRONY:', e.message));
  await page.goto(`${env.appUrl}/#/login`);
  await page.getByLabel('Adres e-mail').fill(email);
  await page.getByLabel('Hasło').fill(password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForSelector('.topbar-title', { timeout: 10000 });
  return page;
}
