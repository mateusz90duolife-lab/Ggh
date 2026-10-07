function append(el, child) {
    if (child === null || child === undefined || child === false)
        return;
    if (Array.isArray(child)) {
        for (const c of child)
            append(el, c);
    }
    else if (child instanceof Node) {
        el.appendChild(child);
    }
    else {
        el.appendChild(document.createTextNode(String(child)));
    }
}
export function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props ?? {})) {
        if (value === undefined || value === null || value === false)
            continue;
        if (key === 'class')
            el.className = String(value);
        else if (key === 'dataset')
            Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        }
        else if (value === true)
            el.setAttribute(key, '');
        else if (key in el && key !== 'list' && key !== 'form' && !key.startsWith('aria-')) {
            el[key] = value;
        }
        else
            el.setAttribute(key, String(value));
    }
    for (const c of children)
        append(el, c);
    return el;
}
export function clear(el) {
    el.replaceChildren();
}
export function mount(el, ...children) {
    el.replaceChildren();
    for (const c of children)
        append(el, c);
}
const ICONS = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    box: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
    cart: 'M3 4h2l2.4 11h10.2L20 7H6 M9 20h.01 M17 20h.01',
    check: 'M9 11l3 3 8-8 M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9',
    more: 'M5 12h.01 M12 12h.01 M19 12h.01',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3',
    alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
    trash: 'M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14',
    edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
    chevron: 'M9 6l6 6-6 6',
    back: 'M15 6l-6 6 6 6',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 21h16',
    list: 'M9 3h6v3H9z M7 5H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2 M8 12h8 M8 16h8',
    sliders: 'M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M9 10v4 M17 16v4',
    history: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2',
    copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
    x: 'M6 6l12 12 M18 6L6 18',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    store: 'M3 9l1-5h16l1 5 M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M5 12v8h14v-8',
    tag: 'M20 12l-8 8-9-9V3h8z M7.5 7.5h.01',
    wifioff: 'M2 2l20 20 M8.5 16.4a5 5 0 0 1 7 0 M5 12.9a10 10 0 0 1 5-2.6 M19 12.9a10 10 0 0 0-2.4-1.8 M12 20h.01',
};
export function icon(name, size = 22) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', name === 'more' ? '3' : '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
}
