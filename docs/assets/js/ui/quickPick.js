import { h } from '../dom.js';
import { categoryIcon } from '../lib/catalog.js';
import { artEl } from './art.js';
import { unitLabel } from '../lib/units.js';
const FREQUENT = '__czesto';
const ALL = '__wszystkie';
const FREQUENT_LIMIT = 12;
/**
 * Szybki wybór produktu: zakładki kategorii z ilustracjami + kafelki produktów.
 * Jedno dotknięcie kafelka wybiera produkt (bez pisania).
 */
export function quickPick(opts) {
    const active = opts.products.filter((p) => p.active);
    const freq = opts.frequency ?? new Map();
    const catName = new Map(opts.categories.map((c) => [c.id, c.name]));
    const frequent = active
        .filter((p) => (freq.get(p.id) ?? 0) > 0)
        .sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pl'))
        .slice(0, FREQUENT_LIMIT);
    const groups = [];
    if (frequent.length)
        groups.push({ id: FREQUENT, label: '⭐ Często' });
    for (const c of opts.categories) {
        if (active.some((p) => p.category_id === c.id))
            groups.push({ id: c.id, label: `${categoryIcon(c.name)} ${c.name}` });
    }
    if (active.some((p) => !p.category_id || !catName.has(p.category_id)))
        groups.push({ id: '', label: `${categoryIcon(null)} Inne` });
    groups.push({ id: ALL, label: 'Wszystkie' });
    let current = groups[0]?.id ?? ALL;
    const chipsEl = h('div', { class: 'chips chips-scroll', role: 'tablist', 'aria-label': 'Kategorie' });
    const tilesEl = h('div', { class: 'tiles', role: 'list' });
    function itemsFor(id) {
        if (id === FREQUENT)
            return frequent;
        if (id === ALL)
            return active;
        if (id === '')
            return active.filter((p) => !p.category_id || !catName.has(p.category_id));
        return active.filter((p) => p.category_id === id);
    }
    function draw() {
        chipsEl.replaceChildren(...groups.map((g) => h('button', {
            type: 'button',
            role: 'tab',
            class: `chip${g.id === current ? ' chip-active' : ''}`,
            'aria-selected': String(g.id === current),
            onclick: () => {
                current = g.id;
                draw();
            },
        }, g.label)));
        tilesEl.replaceChildren(...itemsFor(current).map((p) => h('button', {
            type: 'button',
            role: 'listitem',
            class: 'tile',
            'aria-label': `Wybierz: ${p.name}`,
            onclick: () => opts.onPick(p),
        }, artEl(p, catName.get(p.category_id ?? ''), 'tile-art'), h('span', { class: 'tile-name' }, p.name), h('span', { class: 'tile-sub' }, unitLabel(p.unit)))));
    }
    draw();
    return h('section', { class: 'card quick-pick', 'aria-label': 'Szybki wybór produktu' }, h('div', { class: 'section-head', style: 'margin:0 0 8px' }, h('h2', null, 'Szybki wybór')), chipsEl, h('div', { style: 'height:10px' }), tilesEl);
}
