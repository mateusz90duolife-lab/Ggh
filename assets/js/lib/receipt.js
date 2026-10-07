import { normalize } from './format.js';
/** Klucz zapamiętanego dopasowania: nazwa z paragonu bez wielkości liter, ogonków i podwójnych spacji. */
export function aliasKey(raw) {
    return normalize(raw).replace(/\s+/g, ' ').slice(0, 120);
}
const STOP = new Set(['i', 'w', 'z', 'na', 'do', 'kg', 'g', 'l', 'ml', 'szt', 'op', 'opak']);
function tokens(s) {
    return normalize(s)
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
}
/** Podobieństwo nazw 0..1: część wspólna słów (z dopasowaniem po początku słowa, np. „pomid” ~ „pomidory”). */
export function similarity(a, b) {
    const ta = tokens(a);
    const tb = tokens(b);
    if (!ta.length || !tb.length)
        return 0;
    const hit = (t, other) => other.some((o) => o === t || (t.length >= 4 && o.startsWith(t)) || (o.length >= 4 && t.startsWith(o)));
    const common = ta.filter((t) => hit(t, tb)).length;
    return common / Math.max(ta.length, tb.length);
}
/** Produkt dla pozycji paragonu: zapamiętane dopasowanie → podpowiedź modelu → podobna nazwa. */
export function matchProduct(item, products, aliases) {
    const active = products.filter((p) => p.active);
    const byId = new Map(active.map((p) => [p.id, p]));
    const aliased = aliases.get(aliasKey(item.name));
    if (aliased && byId.has(aliased))
        return { product: byId.get(aliased) ?? null, source: 'alias' };
    if (item.match) {
        const m = active.find((p) => normalize(p.name) === normalize(item.match));
        if (m)
            return { product: m, source: 'model' };
    }
    let best = null;
    let bestScore = 0;
    for (const p of active) {
        const s = Math.max(similarity(item.name_guess, p.name), similarity(item.name, p.name));
        if (s > bestScore) {
            best = p;
            bestScore = s;
        }
    }
    return bestScore >= 0.5 ? { product: best, source: 'similar' } : { product: null, source: null };
}
const FACTOR = {
    kg: { base: 'kg', f: 1 },
    g: { base: 'kg', f: 0.001 },
    l: { base: 'l', f: 1 },
    ml: { base: 'l', f: 0.001 },
};
/** Przelicza ilość między jednostkami tej samej miary (kg↔g, l↔ml). null, gdy się nie da. */
export function convertQty(qty, from, to) {
    if (from === to)
        return qty;
    const a = FACTOR[from];
    const b = FACTOR[to];
    if (!a || !b || a.base !== b.base)
        return null;
    return (qty * a.f) / b.f;
}
/** Jednostka dla nowego produktu tworzonego z pozycji paragonu (np. 5 × „Mąka 1 kg” → produkt w kg). */
export function unitForNewProduct(item) {
    if (item.unit === 'szt' && item.package_unit) {
        if (item.package_unit === 'g')
            return 'kg';
        if (item.package_unit === 'ml')
            return 'l';
        return item.package_unit;
    }
    return item.unit;
}
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
/**
 * Pozycja paragonu → pozycja zakupu w jednostce produktu. Ceny na paragonie są brutto:
 * cena netto = brutto / (1 + VAT). Bez stawki VAT zapisujemy cenę z paragonu i VAT 0.
 */
export function toPurchaseLine(item, productUnit) {
    let qty = convertQty(item.quantity, item.unit, productUnit);
    let warning = null;
    if (qty === null && item.package_size && item.package_unit) {
        const per = convertQty(item.package_size, item.package_unit, productUnit);
        if (per !== null)
            qty = item.quantity * per;
    }
    if (qty === null) {
        qty = item.quantity;
        warning = `Sprawdź ilość: paragon podaje ${item.unit}, produkt jest w ${productUnit}.`;
    }
    qty = round(qty, 3);
    const vat = item.vat_rate ?? 0;
    const grossUnit = qty > 0 ? item.total / qty : 0;
    return { quantity: qty, unit_price_net: round(grossUnit / (1 + vat / 100), 4), vat_rate: vat, warning };
}
const plNum = (n, d = 2) => (n === null ? '' : n.toFixed(d).replace('.', ','));
/** Tabela paragonu jako wiersze (do schowka i pliku CSV). */
export function receiptRows(items, productName) {
    const head = ['Lp.', 'Nazwa z paragonu', 'Produkt', 'Ilość', 'J.m.', 'Cena jedn. brutto', 'Wartość brutto', 'VAT %'];
    const body = items
        .filter((it) => !it.skip)
        .map((it, i) => [
        String(i + 1),
        it.name,
        productName(it.product_id) || it.name_guess,
        plNum(it.quantity, 3).replace(/,?0+$/, ''),
        it.unit,
        plNum(it.unit_price),
        plNum(it.total),
        it.vat_rate === null ? '' : String(it.vat_rate),
    ]);
    return [head, ...body];
}
export function toTsv(rows) {
    return rows.map((r) => r.map((c) => c.replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n');
}
/** CSV dla polskiego Excela: średnik jako separator, przecinek dziesiętny, BOM dla UTF-8. */
export function toCsv(rows) {
    const cell = (c) => (/[;"\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
    return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}
