import { onNet, getNet } from './api/net.js';
import { flushQueue, listQueue, onQueueChange, pendingCount } from './api/queue.js';
import { h, icon, mount } from './dom.js';
import { formatTime, plural } from './lib/format.js';
import { profile, restaurant, role, tz } from './state.js';
import { toast } from './ui/toast.js';
import { refreshCurrent } from './router.js';
const N = {
    dzisiaj: { path: '/dzisiaj', label: 'Dzisiaj', icon: 'home' },
    dashboard: { path: '/dashboard', label: 'Dashboard', icon: 'home' },
    magazyn: { path: '/magazyn', label: 'Magazyn', icon: 'box' },
    braki: { path: '/braki', label: 'Braki', icon: 'cart' },
    zakupy: { path: '/zakupy', label: 'Zakupy', icon: 'cart' },
    zadania: { path: '/zadania', label: 'Zadania', icon: 'check' },
    wiecej: { path: '/wiecej', label: 'Więcej', icon: 'more' },
    produkty: { path: '/produkty', label: 'Produkty', icon: 'box' },
    godziny: { path: '/godziny', label: 'Godziny', icon: 'clock' },
    zespol: { path: '/zespol', label: 'Zespół', icon: 'user' },
    skaner: { path: '/skaner', label: 'Skaner paragonów', icon: 'search' },
    katalog: { path: '/katalog', label: 'Katalog produktów', icon: 'list' },
    inwentaryzacja: { path: '/inwentaryzacja', label: 'Inwentaryzacja', icon: 'list' },
    dostawcy: { path: '/dostawcy', label: 'Dostawcy', icon: 'store' },
    kategorie: { path: '/kategorie', label: 'Kategorie', icon: 'tag' },
    powiadomienia: { path: '/powiadomienia', label: 'Powiadomienia', icon: 'bell' },
    pracownicy: { path: '/pracownicy', label: 'Pracownicy', icon: 'user' },
    szablony: { path: '/szablony', label: 'Szablony zadań', icon: 'history' },
    ustawienia: { path: '/ustawienia', label: 'Ustawienia', icon: 'sliders' },
    audyt: { path: '/audyt', label: 'Historia zmian', icon: 'shield' },
};
export function bottomNav(r) {
    return r === 'employee'
        ? [N.dzisiaj, N.produkty, N.godziny, N.zadania, N.wiecej]
        : [N.dashboard, N.magazyn, N.zakupy, N.zadania, N.wiecej];
}
/** Pozycje spoza dolnego paska — pokazywane w „Więcej” i w panelu bocznym na komputerze. */
export function moreNav(r) {
    if (r === 'employee')
        return [N.braki, N.magazyn];
    const base = [
        N.zespol,
        N.produkty,
        N.godziny,
        N.braki,
        N.skaner,
        N.katalog,
        N.inwentaryzacja,
        N.dostawcy,
        N.kategorie,
        N.powiadomienia,
    ];
    return r === 'owner' ? [...base, N.pracownicy, N.szablony, N.ustawienia, N.audyt] : base;
}
export function sidebarNav(r) {
    return [...bottomNav(r).filter((i) => i.path !== '/wiecej'), ...moreNav(r)];
}
/** Który element dolnego paska ma być aktywny dla danej ścieżki. */
export function activePrimary(r, path) {
    const primary = bottomNav(r).map((i) => i.path);
    const hit = primary.find((p) => p !== '/wiecej' && (path === p || path.startsWith(p + '/')));
    return hit ?? '/wiecej';
}
const root = () => document.getElementById('app');
let shell = null;
export function showBare() {
    shell = null;
    const el = h('main', { class: 'bare', id: 'view', tabindex: '-1' });
    mount(root(), el);
    return el;
}
export function showShell() {
    const r = role();
    if (!r)
        return showBare();
    if (shell && shell.forRole === r && shell.view.isConnected)
        return shell.view;
    const title = h('h1', { class: 'topbar-title', id: 'page-title' });
    const banners = h('div', { class: 'banners' });
    const view = h('main', { class: 'view', id: 'view', tabindex: '-1' });
    const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Menu główne' });
    const bottom = h('nav', { class: 'bottom-nav', 'aria-label': 'Menu dolne' });
    const topbar = h('header', { class: 'topbar' }, h('div', { class: 'topbar-brand' }, h('span', { class: 'logo' }, '🍽️'), h('span', null, restaurant()?.name ?? 'Restaurant OS')), title);
    mount(root(), h('div', { class: 'app' }, sidebar, h('div', { class: 'main-col' }, topbar, banners, view), bottom));
    shell = { view, title, banners, sidebar, bottom, forRole: r };
    buildNav(r, '/');
    renderBanners();
    return view;
}
function link(item, active, extra = '') {
    return h('a', {
        href: `#${item.path}`,
        class: `nav-link${active ? ' active' : ''}${extra}`,
        'aria-current': active ? 'page' : undefined,
    }, icon(item.icon, 22), h('span', null, item.label));
}
function buildNav(r, path) {
    if (!shell)
        return;
    const activeBottom = activePrimary(r, path);
    mount(shell.bottom, bottomNav(r).map((i) => link(i, i.path === activeBottom)));
    const p = profile();
    mount(shell.sidebar, h('div', { class: 'sidebar-brand' }, h('span', { class: 'logo' }, '🍽️'), h('span', null, restaurant()?.name ?? 'Restaurant OS')), h('nav', null, sidebarNav(r).map((i) => link(i, path === i.path || path.startsWith(i.path + '/')))), h('div', { class: 'sidebar-user' }, h('div', { class: 'sidebar-user-name' }, p?.full_name ?? ''), h('div', { class: 'sidebar-user-role' }, ROLE_LABEL[r]), h('a', { href: '#/wiecej', class: 'sidebar-user-link' }, 'Moje konto')));
}
export const ROLE_LABEL = { owner: 'Właściciel', manager: 'Manager', employee: 'Pracownik' };
export function updateNav(path) {
    const r = role();
    if (r && shell)
        buildNav(r, path);
}
export function setTitle(t) {
    document.title = `${t} · Restaurant OS`;
    if (shell)
        shell.title.textContent = t;
}
function renderBanners() {
    if (!shell)
        return;
    const net = getNet();
    const pending = pendingCount();
    const failed = listQueue().filter((i) => i.error).length;
    const items = [];
    if (net.offline) {
        items.push(h('div', { class: 'banner banner-offline', role: 'status' }, icon('wifioff', 18), h('span', null, net.staleSince
            ? `Tryb offline — dane z godz. ${formatTime(new Date(net.staleSince).toISOString(), tz())}. Zmiany magazynu i zakupów wymagają internetu.`
            : 'Brak połączenia z internetem. Zmiany magazynu i zakupów wymagają internetu.')));
    }
    if (pending > 0) {
        items.push(h('div', { class: 'banner banner-pending', role: 'status' }, icon('clock', 18), h('span', null, `${pending} ${plural(pending, 'zapisana akcja czeka', 'zapisane akcje czekają', 'zapisanych akcji czeka')} na wysłanie.`), !net.offline
            ? h('button', { class: 'banner-btn', type: 'button', onclick: () => void syncNow(true) }, 'Wyślij teraz')
            : null));
    }
    if (failed > 0) {
        items.push(h('div', { class: 'banner banner-error', role: 'alert' }, icon('alert', 18), h('span', null, `${failed} ${plural(failed, 'akcji nie udało się wysłać', 'akcje nie udało się wysłać', 'akcji nie udało się wysłać')}.`), h('a', { class: 'banner-btn', href: '#/wiecej' }, 'Zobacz')));
    }
    mount(shell.banners, items);
}
export async function syncNow(manual = false) {
    if (pendingCount() === 0)
        return;
    const r = await flushQueue();
    if (r.sent > 0) {
        toast(`Wysłano ${r.sent} ${plural(r.sent, 'zapisaną akcję', 'zapisane akcje', 'zapisanych akcji')}.`, 'ok');
        refreshCurrent();
    }
    else if (manual && r.remaining > 0) {
        toast('Nie udało się teraz wysłać — spróbujemy ponownie automatycznie.', 'info');
    }
    if (r.failed > 0)
        toast(`${r.failed} ${plural(r.failed, 'akcji nie została przyjęta', 'akcje nie zostały przyjęte', 'akcji nie zostało przyjętych')} przez serwer.`, 'error');
    renderBanners();
}
let wired = false;
export function wireStatus() {
    if (wired)
        return;
    wired = true;
    onNet((n) => {
        renderBanners();
        if (!n.offline)
            void syncNow();
    });
    onQueueChange(renderBanners);
    window.addEventListener('online', () => void syncNow());
    setInterval(() => {
        if (!document.hidden && pendingCount() > 0 && !getNet().offline)
            void syncNow();
    }, 20000);
}
