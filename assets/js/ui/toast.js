import { h } from '../dom.js';
let host = null;
export function toast(message, kind = 'ok') {
    if (!host || !host.isConnected) {
        host = h('div', { class: 'toasts', 'aria-live': 'polite', role: 'status' });
        document.body.appendChild(host);
    }
    const el = h('div', { class: `toast toast-${kind}` }, message);
    host.appendChild(el);
    const ttl = kind === 'error' ? 6000 : 3500;
    setTimeout(() => {
        el.classList.add('toast-out');
        setTimeout(() => el.remove(), 250);
    }, ttl);
}
