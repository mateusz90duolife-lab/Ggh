// Minimalne środowisko „przeglądarkowe” dla testów modułów src/ (kompilowanych do public/assets/js).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  get length() {
    return store.size;
  },
  key: (i) => [...store.keys()][i] ?? null,
  clear: () => store.clear(),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.location = { origin: 'https://app.test', pathname: '/', hash: '' };
globalThis.__CONFIG__ = undefined;

export function resetBrowser() {
  store.clear();
}
export function setConfig(cfg) {
  globalThis.__CONFIG__ = cfg;
}
export const storeRef = store;

/** Fabryka JWT bez podpisu (aplikacja go nie weryfikuje, robi to serwer). */
export function fakeJwt(payload) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'none' })}.${b(payload)}.sig`;
}
