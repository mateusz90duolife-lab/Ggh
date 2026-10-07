// Generuje public/sw-assets.js: lista plików do precache + wersja (hash zawartości) dla service workera.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SKIP = new Set(['sw.js', 'sw-assets.js', 'config.js']);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(root)
  .map((p) => relative(root, p).split('\\').join('/'))
  .filter((f) => !SKIP.has(f) && !f.endsWith('.map'))
  .sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 12);
const assets = ['./', ...files];
writeFileSync(
  join(root, 'sw-assets.js'),
  `self.__VERSION__ = ${JSON.stringify(version)};\nself.__ASSETS__ = ${JSON.stringify(assets)};\n`,
);
console.log(`sw-assets.js: ${assets.length} plików, wersja ${version}`);
