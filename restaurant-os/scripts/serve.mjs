// Prosty serwer statyczny dla public/ (lokalny podgląd i testy E2E) z nagłówkami bezpieczeństwa jak na produkcji.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function startStaticServer(port = 0, host = '127.0.0.1', overrides = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      if (overrides[url.pathname]) {
        res.writeHead(200, {
          'content-type': TYPES[extname(url.pathname)] ?? 'text/plain',
          'cache-control': 'no-cache',
        });
        return res.end(overrides[url.pathname]);
      }
      let rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      if (rel.endsWith('/') || rel === '') rel = join(rel, 'index.html');
      const file = join(root, rel);
      if (!file.startsWith(root)) throw new Error('forbidden');
      const s = await stat(file);
      if (!s.isFile()) throw new Error('nf');
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': rel.endsWith('sw.js') ? 'no-cache' : 'no-cache',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'same-origin',
        'x-frame-options': 'DENY',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Nie znaleziono');
    }
  });
  return new Promise((ok) => server.listen(port, host, () => ok({ server, port: server.address().port })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await startStaticServer(Number(process.env.PORT ?? 8080));
  console.log(`Aplikacja: http://127.0.0.1:${port}/`);
}
