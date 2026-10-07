import { h } from './dom.js';
import { errorMessage } from './lib/errors.js';
import type { Role } from './types.js';
import { errorState } from './ui/components.js';

export interface PageCtx {
  params: Record<string, string>;
  query: URLSearchParams;
  el: HTMLElement;
  path: string;
  setTitle(t: string): void;
  onCleanup(fn: () => void): void;
  /** Cykliczne odświeżanie (tylko gdy karta jest widoczna). Zatrzymywane przy zmianie strony. */
  poll(fn: () => void | Promise<void>, ms: number): void;
  isAlive(): boolean;
  /** Ponowne wyrenderowanie bieżącej strony (np. po synchronizacji kolejki). */
  refresh(): void;
}

export type PageFn = (c: PageCtx) => void | Promise<void>;

export interface RouteDef {
  pattern: string;
  title: string;
  page: PageFn;
  /** 'public' = bez logowania; tablica = dozwolone role. */
  roles: Role[] | 'public';
}

export interface RouterHooks {
  /** Zwraca element, do którego renderujemy stronę (z powłoką aplikacji lub bez). */
  outlet(route: RouteDef, path: string): HTMLElement;
  /** Zwraca ścieżkę przekierowania, jeśli użytkownik nie ma dostępu; null = dostęp OK. */
  guard(route: RouteDef | null, path: string): string | null;
  onRendered(route: RouteDef | null, path: string): void;
  setTitle(t: string): void;
  notFound(path: string): string;
}

let routes: RouteDef[] = [];
let hooks: RouterHooks;
let cleanups: (() => void)[] = [];
let token = 0;
let currentPath = '';

function compile(pattern: string): { re: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = pattern
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { re: new RegExp(`^${src}$`), keys };
}

export function match(path: string): { route: RouteDef; params: Record<string, string> } | null {
  for (const r of routes) {
    const { re, keys } = compile(r.pattern);
    const m = re.exec(path);
    if (m) {
      const params: Record<string, string> = {};
      keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
      return { route: r, params };
    }
  }
  return null;
}

export function parseHash(hash: string = location.hash): { path: string; query: URLSearchParams } {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q] = raw.split('?');
  return { path: (p || '/').replace(/\/+$/, '') || '/', query: new URLSearchParams(q ?? '') };
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const target = `#${path}`;
  if (opts.replace) {
    history.replaceState(null, '', target);
    void render();
  } else if (location.hash === target) {
    void render();
  } else {
    location.hash = target;
  }
}

export function currentRoutePath(): string {
  return currentPath;
}

export function refreshCurrent(): void {
  void render();
}

export function startRouter(defs: RouteDef[], h_: RouterHooks): void {
  routes = defs;
  hooks = h_;
  window.addEventListener('hashchange', () => void render());
  void render();
}

async function render(): Promise<void> {
  const my = ++token;
  for (const fn of cleanups.splice(0)) {
    try {
      fn();
    } catch {
      /* sprzątanie nie może przerwać nawigacji */
    }
  }
  const { path, query } = parseHash();
  currentPath = path;
  const m = match(path);
  const redirect = hooks.guard(m?.route ?? null, path);
  if (redirect !== null) {
    navigate(redirect, { replace: true });
    return;
  }
  if (!m) {
    navigate(hooks.notFound(path), { replace: true });
    return;
  }
  const el = hooks.outlet(m.route, path);
  el.replaceChildren();
  hooks.setTitle(m.route.title);
  hooks.onRendered(m.route, path);

  const ctx: PageCtx = {
    params: m.params,
    query,
    el,
    path,
    setTitle: (t) => {
      if (my === token) hooks.setTitle(t);
    },
    onCleanup: (fn) => cleanups.push(fn),
    poll: (fn, ms) => {
      const run = () => {
        if (my !== token || document.hidden) return;
        void Promise.resolve(fn()).catch(() => {});
      };
      const id = setInterval(run, ms);
      const onVis = () => {
        if (!document.hidden) run();
      };
      document.addEventListener('visibilitychange', onVis);
      cleanups.push(() => {
        clearInterval(id);
        document.removeEventListener('visibilitychange', onVis);
      });
    },
    isAlive: () => my === token,
    refresh: () => void render(),
  };

  try {
    await m.route.page(ctx);
  } catch (e) {
    if (my !== token) return;
    el.replaceChildren(
      h(
        'div',
        { class: 'page' },
        errorState(errorMessage(e), () => void render()),
      ),
    );
  }
  if (my === token) {
    window.scrollTo({ top: 0 });
    // Dla czytników ekranu przenosimy fokus na widok, ale nie odbieramy go polu, które strona sama ustawiła
    // (np. wyszukiwarka produktu na ekranie „Zgłoś brak”).
    const active = document.activeElement;
    if (!active || active === document.body || !el.contains(active)) el.focus({ preventScroll: true });
  }
}
