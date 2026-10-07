/* Service worker Restaurant OS.
 * - Precache powłoki aplikacji (lista i wersja z sw-assets.js generowanego w buildzie).
 * - Zasoby statyczne: cache-first (nazwa cache zawiera hash zawartości, więc jest bezpieczne).
 * - Nawigacja i config.js: network-first z awaryjnym fallbackiem do cache (otwarcie bez internetu).
 * - Żądań do innych domen (Supabase: auth, dane, zdjęcia) NIE przechwytujemy i nigdy nie cache'ujemy.
 */
importScripts('sw-assets.js');
const CACHE = `ros-${self.__VERSION__}`;
const ASSETS = self.__ASSETS__ || [];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ros-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst = async (key) => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(key, res.clone());
      return res;
    } catch (e) {
      const hit = await caches.match(key);
      if (hit) return hit;
      throw e;
    }
  };

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst('index.html').catch(() => caches.match('index.html')));
    return;
  }
  if (url.pathname.endsWith('/config.js') || url.pathname.endsWith('/sw-assets.js')) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then(async (res) => {
          if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
          return res;
        }),
    ),
  );
});
