// Generuje ilustracje produktów do public/img/p/<klucz>.svg (uruchamiane przy każdym buildzie).
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svg } from './art/lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'public', 'img', 'p');
const modules = ['produce', 'meat', 'dairy', 'soups', 'spices', 'sauces', 'accessories'];

export async function allArt() {
  const art = {};
  for (const m of modules) {
    let mod;
    try {
      mod = await import(`./art/${m}.mjs`);
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(`${m}.mjs`)) continue;
      throw e;
    }
    for (const [k, body] of Object.entries(mod.default)) {
      if (art[k]) throw new Error(`Powtórzony klucz ilustracji: ${k}`);
      if (k.length > 15) throw new Error(`Klucz ilustracji za długi (max 15): ${k}`);
      art[k] = svg(body);
    }
  }
  return art;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const art = await allArt();
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) if (f.endsWith('.svg') && !art[f.slice(0, -4)]) rmSync(join(out, f));
  for (const [k, s] of Object.entries(art)) writeFileSync(join(out, `${k}.svg`), s);
  console.log(`ilustracje: ${Object.keys(art).length}`);
}
