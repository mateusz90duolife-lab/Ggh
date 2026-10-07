import { consumeAuthHash, getSession, onSessionChange, signOut } from './api/auth.js';
import { clearCache } from './api/db.js';
import { flushQueue, pendingCount } from './api/queue.js';
import { getConfig } from './lib/config.js';
import { errorMessage, isNetworkError } from './lib/errors.js';
import { setTitle, showBare, showShell, syncNow, updateNav, wireStatus } from './layout.js';
import { blockedScreen, configMissingScreen, setLoginNotice } from './pages/auth.js';
import { setLogoutHandler } from './pages/more.js';
import { navigate, startRouter } from './router.js';
import { routes } from './routes.js';
import { homePath, loadContext, resetContext, role } from './state.js';
import { toast } from './ui/toast.js';
import { h } from './dom.js';

const root = (): HTMLElement => document.getElementById('app') as HTMLElement;
let routerStarted = false;
let entering: Promise<void> | null = null;
let explicitLogout = false;

function ensureRouter(): void {
  if (routerStarted) return;
  routerStarted = true;
  startRouter(routes, {
    outlet: (route) => (route.roles === 'public' ? showBare() : showShell()),
    guard(route, path) {
      const hasSession = !!getSession();
      if (!route) return null;
      if (route.roles === 'public') {
        if (hasSession && role() && (path === '/login' || path === '/zapomniane-haslo')) return homePath(role());
        return null;
      }
      if (!hasSession || !role()) return '/login';
      if (!route.roles.includes(role()!)) {
        toast('Nie masz dostępu do tej sekcji.', 'error');
        return homePath(role());
      }
      return null;
    },
    onRendered: (_route, path) => updateNav(path),
    setTitle,
    notFound: () => (getSession() && role() ? homePath(role()) : '/login'),
  });
}

async function enterApp(): Promise<void> {
  if (entering) return entering;
  entering = (async () => {
    try {
      const status = await loadContext();
      if (status !== 'ok') {
        blockedScreen(root(), status);
        return;
      }
      wireStatus();
      const first = !routerStarted;
      ensureRouter();
      // po linku resetu hasła zostajemy na ekranie ustawiania nowego hasła
      if (!first && location.hash !== '#/nowe-haslo') navigate(homePath(role()), { replace: true });
      if (pendingCount() > 0) void flushQueue().then(() => syncNow());
    } catch (e) {
      if (isNetworkError(e)) blockedScreen(root(), 'offline');
      else {
        blockedScreen(root(), 'no-profile');
        toast(errorMessage(e), 'error');
      }
    } finally {
      entering = null;
    }
  })();
  return entering;
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw?.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
          });
        });
      })
      .catch(() => {
        /* aplikacja działa także bez service workera */
      });
    // Przeładowanie tylko przy AKTUALIZACJI (był już aktywny service worker). Przy pierwszej instalacji
    // przejęcie kontroli nie może przeładować strony — użytkownik mógłby stracić wpisywane dane.
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      location.reload();
    });
  });
}

function showUpdateBanner(worker: ServiceWorker): void {
  if (document.getElementById('update-banner')) return;
  document.body.appendChild(
    h(
      'div',
      {
        id: 'update-banner',
        class: 'banner banner-pending',
        role: 'status',
        style: 'position:fixed;left:0;right:0;top:0;z-index:90',
      },
      h('span', null, 'Dostępna nowa wersja aplikacji.'),
      h(
        'button',
        { class: 'banner-btn', type: 'button', onclick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
        'Odśwież',
      ),
    ),
  );
}

/** Wczytuje sesję z linku z e-maila i czyści adres. Zwraca true, gdy to link resetu hasła. */
function handleAuthFragment(): boolean {
  const fromLink = consumeAuthHash();
  if (!fromLink) return false;
  if (fromLink.type === 'recovery') {
    history.replaceState(null, '', '#/nowe-haslo');
    return true;
  }
  if (fromLink.type === 'error') {
    setLoginNotice(fromLink.error ?? 'Link jest nieprawidłowy.', 'error');
    history.replaceState(null, '', '#/login');
    return false;
  }
  history.replaceState(null, '', '#/');
  return false;
}

function boot(): void {
  registerServiceWorker();
  if (!getConfig()) {
    configMissingScreen(root());
    return;
  }
  // Link z e-maila (reset hasła) wraca z tokenami we fragmencie adresu.
  handleAuthFragment();
  // Gdy aplikacja jest już otwarta (np. zainstalowana jako PWA), link zmienia tylko fragment adresu
  // i strona nie ładuje się od nowa — obsługujemy to zdarzeniem hashchange (przed routerem).
  window.addEventListener('hashchange', () => {
    if (!location.hash || location.hash.startsWith('#/')) return;
    if (handleAuthFragment()) {
      resetContext();
      void enterApp();
    }
  });

  setLogoutHandler(() => {
    explicitLogout = true;
    void signOut();
  });
  let hadSession = !!getSession();
  onSessionChange((s) => {
    if (s) {
      // odświeżenie tokenu też zgłasza zmianę sesji — wchodzimy do aplikacji tylko po zalogowaniu
      if (!hadSession) {
        hadSession = true;
        void enterApp();
      }
      return;
    }
    resetContext();
    clearCache();
    if (hadSession && !explicitLogout) setLoginNotice('Sesja wygasła. Zaloguj się ponownie.', 'info');
    explicitLogout = false;
    hadSession = false;
    ensureRouter();
    navigate('/login', { replace: true });
  });

  if (getSession()) void enterApp();
  else {
    ensureRouter();
    if (!location.hash || location.hash === '#/') navigate('/login', { replace: true });
  }
}

boot();
