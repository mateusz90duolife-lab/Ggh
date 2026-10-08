// Arkusz podglądu wszystkich ilustracji (PNG) — do przeglądu wizualnego.
import { writeFileSync } from 'node:fs';
import { allArt } from './gen-art.mjs';

const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const art = Object.entries(await allArt()).filter(([k]) => !only || only.test(k));
const cells = art
  .map(
    ([k, s]) =>
      `<div class=c><img src="data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}"><b>${k}</b></div>`,
  )
  .join('');
const html = `<html><body style="margin:0;font:12px sans-serif;background:#f7f7f5"><div style="display:grid;grid-template-columns:repeat(8,120px);gap:6px;padding:8px">${cells}</div><style>.c{background:#fff;border:1px solid #e5e7eb;border-radius:10px;text-align:center;padding:6px}.c img{width:96px;height:96px}b{display:block}</style></body></html>`;
import { execSync } from 'node:child_process';
const pw = await import('playwright').catch(
  () => import(`${execSync('npm root -g').toString().trim()}/playwright/index.mjs`),
);
const b = await pw.chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1000, height: 400 } });
await p.setContent(html);
await p.screenshot({ path: process.argv[2], fullPage: true });
await b.close();
