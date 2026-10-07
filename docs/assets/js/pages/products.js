import { eq, list, rpc } from '../api/db.js';
import { enqueue } from '../api/queue.js';
import { h, icon, mount } from '../dom.js';
import { categoryIcon, productIcon } from '../lib/catalog.js';
import { errorMessage, isNetworkError } from '../lib/errors.js';
import { formatQty, normalize, plural, relativeTime } from '../lib/format.js';
import { allowsFraction, unitLabel } from '../lib/units.js';
import { parseQuantity } from '../lib/validate.js';
import { uuid } from '../lib/uuid.js';
import { loadCatalog, profile, tz } from '../state.js';
import { button, emptyState, errorState, qtyText, sectionHeader, skeleton } from '../ui/components.js';
import { confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
const ALL = '__all';
const STOCK_COLS = 'product_id,name,unit,category_id,minimum_stock,active,stock,status,icon';
/**
 * „Produkty”: pracownik zaznacza kafelki (jeden lub wiele produktów), ustawia ilości i jednym przyciskiem
 * dopisuje je do listy potrzebnych albo dodaje / odejmuje ze stanu. Każda zmiana zapisuje się pod jego nazwiskiem.
 */
export async function productsPage(c) {
    c.setTitle('Produkty');
    const host = h('div', { class: 'page' }, skeleton(4));
    mount(c.el, host);
    let stock = [];
    let categories = [];
    let current = ALL;
    let query = '';
    const picked = new Map();
    const search = h('input', {
        class: 'input',
        type: 'search',
        placeholder: 'Szukaj produktu…',
        'aria-label': 'Szukaj produktu',
        autocomplete: 'off',
    });
    const chipsEl = h('div', { class: 'chips chips-scroll', role: 'tablist', 'aria-label': 'Kategorie' });
    const tilesEl = h('div', { class: 'tiles', role: 'group', 'aria-label': 'Produkty' });
    const panel = h('div', { class: 'pick-panel', hidden: true });
    const historyHost = h('div');
    search.addEventListener('input', () => {
        query = search.value;
        drawTiles();
    });
    const catName = () => new Map(categories.map((x) => [x.id, x.name]));
    function drawChips() {
        const used = categories.filter((x) => stock.some((s) => s.active && s.category_id === x.id));
        const groups = [
            { id: ALL, label: 'Wszystkie' },
            ...used.map((x) => ({ id: x.id, label: `${categoryIcon(x.name)} ${x.name}` })),
        ];
        chipsEl.replaceChildren(...groups.map((g) => h('button', {
            type: 'button',
            role: 'tab',
            class: `chip${g.id === current ? ' chip-active' : ''}`,
            'aria-selected': String(g.id === current),
            onclick: () => {
                current = g.id;
                drawChips();
                drawTiles();
            },
        }, g.label)));
    }
    function drawTiles() {
        const n = normalize(query);
        const names = catName();
        let rows = stock.filter((s) => s.active);
        if (current !== ALL)
            rows = rows.filter((s) => s.category_id === current);
        if (n)
            rows = rows.filter((s) => normalize(s.name).includes(n));
        if (!rows.length) {
            mount(tilesEl, emptyState('Nic nie znaleziono', 'Zmień kategorię albo wyszukiwanie.'));
            return;
        }
        tilesEl.replaceChildren(...rows.map((s) => {
            const on = picked.get(s.product_id);
            return h('button', {
                type: 'button',
                class: `tile${on ? ' tile-selected' : ''}`,
                'aria-pressed': String(!!on),
                'aria-label': `${s.name}, na stanie ${formatQty(s.stock)} ${unitLabel(s.unit)}`,
                onclick: () => toggle(s),
            }, h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, productIcon(s, names.get(s.category_id ?? ''))), h('span', null, s.name), h('span', { class: `tile-sub${s.status === 'low' || s.status === 'out' ? ' tile-warn' : ''}` }, on ? `wybrano: ${on.qty} ${unitLabel(s.unit)}` : `stan: ${formatQty(s.stock)} ${unitLabel(s.unit)}`));
        }));
    }
    function toggle(s) {
        if (picked.has(s.product_id))
            picked.delete(s.product_id);
        else
            picked.set(s.product_id, { p: s, qty: '1' });
        drawTiles();
        drawPanel();
    }
    function step(it, dir) {
        const r = parseQuantity(it.qty);
        const cur = r.ok ? r.value : 0;
        const by = allowsFraction(it.p.unit) && cur < 5 ? 0.5 : 1;
        const next = Math.max(0, Math.round((cur + dir * by) * 1000) / 1000);
        it.qty = formatQty(next === 0 ? by : next);
        drawPanel();
        drawTiles();
    }
    function drawPanel() {
        const items = [...picked.values()];
        panel.hidden = items.length === 0;
        if (!items.length) {
            panel.replaceChildren();
            return;
        }
        const names = catName();
        panel.replaceChildren(h('div', { class: 'pick-head' }, h('strong', null, `Zaznaczone: ${items.length} ${plural(items.length, 'produkt', 'produkty', 'produktów')}`), h('button', {
            type: 'button',
            class: 'muted small',
            style: 'background:none;border:0;cursor:pointer;text-decoration:underline',
            onclick: () => {
                picked.clear();
                drawPanel();
                drawTiles();
            },
        }, 'Wyczyść')), h('div', { class: 'pick-list' }, items.map((it) => {
            const qty = h('input', {
                class: 'input pick-qty',
                type: 'text',
                inputMode: 'decimal',
                value: it.qty,
                'aria-label': `Ilość: ${it.p.name}`,
            });
            qty.addEventListener('change', () => {
                it.qty = qty.value.trim();
                drawTiles();
            });
            return h('div', { class: 'pick-row' }, h('span', { class: 'prod-icon', 'aria-hidden': 'true' }, productIcon(it.p, names.get(it.p.category_id ?? ''))), h('span', { class: 'pick-name' }, it.p.name), h('button', {
                type: 'button',
                class: 'qty-btn qty-btn-sm',
                'aria-label': `Mniej: ${it.p.name}`,
                onclick: () => step(it, -1),
            }, icon('minus', 18)), qty, h('button', {
                type: 'button',
                class: 'qty-btn qty-btn-sm',
                'aria-label': `Więcej: ${it.p.name}`,
                onclick: () => step(it, 1),
            }, icon('plus', 18)), h('span', { class: 'pick-unit' }, unitLabel(it.p.unit)));
        })), h('div', { class: 'pick-actions' }, button('Na listę potrzebnych', { variant: 'danger', icon: 'cart', onClick: () => toShoppingList() }), button('Dodaj do stanu', { variant: 'primary', icon: 'plus', onClick: () => changeStock(1) }), button('Odejmij ze stanu', { variant: 'soft', icon: 'minus', onClick: () => changeStock(-1) })));
    }
    /** Sprawdza ilości; zwraca pozycje albo null (z komunikatem). */
    function validItems() {
        const out = [];
        for (const it of picked.values()) {
            const r = parseQuantity(it.qty);
            if (!r.ok) {
                toast(`${it.p.name}: ${r.error}`, 'error');
                return null;
            }
            out.push({ it, qty: r.value });
        }
        return out;
    }
    async function toShoppingList() {
        const items = validItems();
        if (!items)
            return;
        let queued = 0;
        for (const { it, qty } of items) {
            const clientId = uuid();
            const args = { p_product_id: it.p.product_id, p_quantity: qty, p_urgent: false, p_note: null };
            try {
                await rpc('report_shortage', { ...args, p_client_id: clientId });
            }
            catch (e) {
                if (!isNetworkError(e))
                    throw e;
                enqueue({ id: clientId, kind: 'report_shortage', label: `${it.p.name} — ${qtyText(qty, it.p.unit)}`, args });
                queued++;
            }
            picked.delete(it.p.product_id);
        }
        toast(queued
            ? `Brak internetu — zapisano na telefonie (${items.length}). Wyślemy automatycznie.`
            : `Dodano do listy potrzebnych: ${items.map(({ it, qty }) => `${it.p.name} ${qtyText(qty, it.p.unit)}`).join(', ')}`, queued ? 'info' : 'ok');
        drawPanel();
        drawTiles();
    }
    async function changeStock(sign) {
        const items = validItems();
        if (!items)
            return;
        if (sign < 0 &&
            items.length > 1 &&
            !(await confirmDialog({
                title: 'Odjąć ze stanu?',
                message: items.map(({ it, qty }) => `${it.p.name}: −${qtyText(qty, it.p.unit)}`).join('\n'),
                confirmLabel: 'Odejmij',
            })))
            return;
        const done = [];
        const failed = [];
        for (const { it, qty } of items) {
            try {
                await rpc('staff_stock_change', { p_product_id: it.p.product_id, p_delta: sign * qty, p_note: null });
                done.push(`${it.p.name} ${sign > 0 ? '+' : '−'}${qtyText(qty, it.p.unit)}`);
                picked.delete(it.p.product_id);
            }
            catch (e) {
                if (isNetworkError(e)) {
                    toast('Brak internetu — zmiany stanu wymagają połączenia. Spróbuj ponownie.', 'error');
                    break;
                }
                failed.push(`${it.p.name}: ${errorMessage(e)}`);
            }
        }
        if (done.length)
            toast(`${sign > 0 ? 'Dodano' : 'Odjęto'}: ${done.join(', ')}`, 'ok');
        if (failed.length)
            toast(failed.join(' · '), 'error');
        await load();
    }
    async function loadHistory() {
        const me = profile()?.id;
        if (!me)
            return;
        const rows = await list('inventory_movements', {
            select: 'id,product_id,type,quantity_delta,note,created_by,created_at',
            params: { created_by: eq(me) },
            order: 'created_at.desc',
            limit: 10,
        });
        if (!c.isAlive())
            return;
        const byId = new Map(stock.map((s) => [s.product_id, s]));
        mount(historyHost, sectionHeader('Moje ostatnie zmiany stanu'), rows.length
            ? h('div', { class: 'card card-flush' }, rows.map((m) => {
                const p = byId.get(m.product_id);
                const d = Number(m.quantity_delta);
                return h('div', { class: 'item' }, h('span', { class: 'prod-icon', 'aria-hidden': 'true' }, p ? productIcon(p) : '📦'), h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, p?.name ?? 'Produkt'), h('div', { class: 'item-sub' }, `${relativeTime(m.created_at, new Date(), tz())}${m.note ? ` · ${m.note}` : ''}`)), h('div', { class: `item-end ${d > 0 ? 'pos' : 'neg'}` }, `${d > 0 ? '+' : '−'}${qtyText(Math.abs(d), p?.unit ?? '')}`));
            }))
            : h('p', { class: 'muted' }, 'Brak Twoich zmian stanu.'));
    }
    async function load() {
        try {
            const [st, cat] = await Promise.all([
                list('product_stock', { select: STOCK_COLS, order: 'name.asc' }),
                loadCatalog(),
            ]);
            if (!c.isAlive())
                return;
            stock = st;
            categories = cat.categories;
            for (const [id, it] of picked) {
                const fresh = stock.find((s) => s.product_id === id && s.active);
                if (fresh)
                    it.p = fresh;
                else
                    picked.delete(id);
            }
            if (!host.contains(tilesEl)) {
                mount(host, h('p', { class: 'muted', style: 'margin:0' }, 'Dotknij produkty, aby je zaznaczyć (możesz kilka naraz), ustaw ilość i wybierz, co zrobić.'), h('div', { style: 'flex:1;min-width:200px' }, search), chipsEl, tilesEl, panel, historyHost);
                const pre = c.query.get('produkt');
                const s = pre ? stock.find((x) => x.product_id === pre && x.active) : undefined;
                if (s)
                    picked.set(s.product_id, { p: s, qty: '1' });
            }
            drawChips();
            drawTiles();
            drawPanel();
            await loadHistory().catch(() => undefined);
        }
        catch (e) {
            if (c.isAlive())
                mount(host, errorState(errorMessage(e), () => void load()));
        }
    }
    await load();
}
