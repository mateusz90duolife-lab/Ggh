import { h } from './dom.js';
import { errorMessage } from './lib/errors.js';
import { errorState } from './ui/components.js';
let routes = [];
let hooks;
let cleanups = [];
let token = 0;
let currentPath = '';
function compile(pattern) {
    const keys = [];
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
export function match(path) {
    for (const r of routes) {
        const { re, keys } = compile(r.pattern);
        const m = re.exec(path);
        if (m) {
            const params = {};
            keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
            return { route: r, params };
        }
    }
    return null;
}
export function parseHash(hash = location.hash) {
    const raw = hash.replace(/^#/, '') || '/';
    const [p, q] = raw.split('?');
    return { path: (p || '/').replace(/\/+$/, '') || '/', query: new URLSearchParams(q ?? '') };
}
export function navigate(path, opts = {}) {
    const target = `#${path}`;
    if (opts.replace) {
        history.replaceState(null, '', target);
        void render();
    }
    else if (location.hash === target) {
        void render();
    }
    else {
        location.hash = target;
    }
}
export function currentRoutePath() {
    return currentPath;
}
export function refreshCurrent() {
    void render();
}
export function startRouter(defs, h_) {
    routes = defs;
    hooks = h_;
    window.addEventListener('hashchange', () => void render());
    void render();
}
async function render() {
    const my = ++token;
    for (const fn of cleanups.splice(0)) {
        try {
            fn();
        }
        catch {
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
    const ctx = {
        params: m.params,
        query,
        el,
        path,
        setTitle: (t) => {
            if (my === token)
                hooks.setTitle(t);
        },
        onCleanup: (fn) => cleanups.push(fn),
        poll: (fn, ms) => {
            const run = () => {
                if (my !== token || document.hidden)
                    return;
                void Promise.resolve(fn()).catch(() => { });
            };
            const id = setInterval(run, ms);
            const onVis = () => {
                if (!document.hidden)
                    run();
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
    }
    catch (e) {
        if (my !== token)
            return;
        el.replaceChildren(h('div', { class: 'page' }, errorState(errorMessage(e), () => void render())));
    }
    if (my === token) {
        window.scrollTo({ top: 0 });
        // Dla czytników ekranu przenosimy fokus na widok, ale nie odbieramy go polu, które strona sama ustawiła
        // (np. wyszukiwarka produktu na ekranie „Zgłoś brak”).
        const active = document.activeElement;
        if (!active || active === document.body || !el.contains(active))
            el.focus({ preventScroll: true });
    }
}
