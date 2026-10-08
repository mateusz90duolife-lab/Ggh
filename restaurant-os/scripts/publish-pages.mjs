// Buduje aplikację z ustawieniami z deploy/production.json i kopiuje ją do /docs w katalogu głównym repozytorium.
// GitHub Pages: Settings → Pages → „Deploy from a branch” → wybierz gałąź i folder /docs.
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(app, '..', 'docs');
const cfg = JSON.parse(readFileSync(join(app, 'deploy/production.json'), 'utf8'));
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) throw new Error('Uzupełnij deploy/production.json');

execFileSync('npm', ['run', 'build'], {
  cwd: app,
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_URL: cfg.SUPABASE_URL, SUPABASE_ANON_KEY: cfg.SUPABASE_ANON_KEY },
});
rmSync(out, { recursive: true, force: true });
cpSync(join(app, 'public'), out, { recursive: true });
writeFileSync(join(out, '.nojekyll'), ''); // bez przetwarzania Jekyll (pliki serwowane 1:1)
console.log(`Gotowe: ${out}`);
