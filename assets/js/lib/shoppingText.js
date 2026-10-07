import { formatDate, formatQty } from './format.js';
import { unitLabel } from './units.js';
/** Tekst listy zakupów do skopiowania / udostępnienia (ten sam układ co e-mail). */
export function buildShoppingText(items, isoDate) {
    const line = (r) => `• ${r.product_name} — ${formatQty(r.total_quantity)} ${unitLabel(r.unit)}`;
    const byName = (a, b) => a.product_name.localeCompare(b.product_name, 'pl');
    const out = [`LISTA ZAKUPÓW — ${formatDate(isoDate)}`, ''];
    const urgent = items.filter((i) => i.urgent).sort(byName);
    if (urgent.length)
        out.push('PILNE', ...urgent.map(line), '');
    const groups = new Map();
    for (const i of items.filter((x) => !x.urgent)) {
        const g = groups.get(i.category_name) ?? { order: i.category_order ?? Number.MAX_SAFE_INTEGER, rows: [] };
        g.rows.push(i);
        groups.set(i.category_name, g);
    }
    for (const [name, g] of [...groups.entries()].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0], 'pl'))) {
        out.push(name.toUpperCase(), ...g.rows.sort(byName).map(line), '');
    }
    if (items.length === 0)
        out.push('(lista jest pusta)', '');
    return out.join('\n').trimEnd();
}
