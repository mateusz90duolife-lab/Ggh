import { rpc, update } from '../api/db.js';
import { enqueue, listQueue } from '../api/queue.js';
import { h, icon, mount } from '../dom.js';
import { errorMessage, isNetworkError } from '../lib/errors.js';
import { allowsFraction, unitLabel } from '../lib/units.js';
import { formatQty } from '../lib/format.js';
import { parseQuantity, validateText } from '../lib/validate.js';
import { uuid } from '../lib/uuid.js';
import { navigate } from '../router.js';
import { homePath, isManager, loadCatalog, role } from '../state.js';
import { loadOpenShortages, shortageFrequency } from '../data.js';
import { shortageItem } from './today.js';
import { button, emptyState, errorState, field, guarded, numberInput, qtyText, sectionHeader, skeleton, textInput, } from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { productPicker } from '../ui/picker.js';
import { quickPick } from '../ui/quickPick.js';
import { toast } from '../ui/toast.js';
export async function shortagesPage(c) {
    c.setTitle('Braki');
    const host = h('div');
    mount(c.el, h('div', { class: 'page' }, h('div', { class: 'row-actions' }, h('a', { class: 'btn btn-danger', href: '#/braki/nowy' }, icon('plus', 20), h('span', null, 'Zgłoś brak')), isManager()
        ? h('a', { class: 'btn btn-soft', href: '#/zakupy' }, icon('cart', 20), h('span', null, 'Lista zakupów'))
        : null), host));
    mount(host, skeleton(4));
    async function load() {
        try {
            const [shortages, catalog] = await Promise.all([loadOpenShortages(200), loadCatalog()]);
            if (!c.isAlive())
                return;
            draw(shortages, new Map(catalog.products.map((p) => [p.id, p.name])));
        }
        catch (e) {
            if (c.isAlive())
                mount(host, errorState(errorMessage(e), () => void load()));
        }
    }
    function draw(shortages, names) {
        const queued = listQueue().filter((i) => i.kind === 'report_shortage');
        const parts = [];
        if (queued.length) {
            parts.push(sectionHeader('Oczekują na wysłanie'), h('div', { class: 'card card-flush' }, queued.map((q) => h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, q.label), h('div', { class: 'item-sub' }, q.error ? `Błąd: ${q.error}` : 'Zapisane na telefonie')), q.error
                ? h('span', { class: 'badge badge-out' }, 'Błąd')
                : h('span', { class: 'badge badge-low' }, icon('clock', 14), 'Czeka')))));
        }
        parts.push(sectionHeader(`Otwarte braki (${shortages.length})`));
        if (shortages.length === 0)
            parts.push(emptyState('Brak otwartych braków', 'Wszystko jest na stanie — albo nikt jeszcze nic nie zgłosił.'));
        else
            parts.push(h('div', { class: 'card card-flush' }, shortages.map((s) => {
                const row = shortageItem(s, names);
                if (isManager()) {
                    row.appendChild(h('button', {
                        type: 'button',
                        class: 'icon-btn',
                        'aria-label': `Anuluj zgłoszenie: ${names.get(s.product_id) ?? 'produkt'}`,
                        onclick: () => void cancel(s, names),
                    }, icon('x', 20)));
                }
                return row;
            })));
        mount(host, parts);
    }
    async function cancel(s, names) {
        const label = `${names.get(s.product_id) ?? 'Produkt'} — ${qtyText(s.quantity, s.unit)}`;
        if (!(await confirmDialog({
            title: 'Anulować zgłoszenie?',
            message: `${label}. Pozycja zniknie z listy zakupów.`,
            confirmLabel: 'Anuluj zgłoszenie',
            cancelLabel: 'Zostaw',
            danger: true,
        })))
            return;
        try {
            await update('shortages', { id: `eq.${s.id}` }, { status: 'cancelled', resolved_at: new Date().toISOString() });
            toast('Zgłoszenie anulowane.', 'ok');
            await load();
        }
        catch (e) {
            toast(errorMessage(e), 'error');
        }
    }
    await load();
    c.poll(load, 10000);
}
/** NAJPROSTSZY ekran w aplikacji: produkt → ilość → DODAJ. */
export async function reportShortagePage(c) {
    c.setTitle('Zgłoś brak');
    mount(c.el, h('div', { class: 'page' }, skeleton(3)));
    let products;
    let categories;
    let freq;
    try {
        const [cat, f] = await Promise.all([loadCatalog(), shortageFrequency().catch(() => new Map())]);
        products = cat.products;
        categories = cat.categories;
        freq = f;
    }
    catch (e) {
        mount(c.el, h('div', { class: 'page' }, errorState(errorMessage(e), () => c.refresh())));
        return;
    }
    if (!c.isAlive())
        return;
    const added = [];
    const addedHost = h('div');
    const qtyInput = numberInput({ value: '1' });
    qtyInput.setAttribute('aria-label', 'Ilość');
    const unitEl = h('div', { class: 'qty-unit', 'aria-live': 'polite' }, '—');
    const qtyErr = h('div', { class: 'field-error', role: 'alert' });
    const picker = productPicker({
        products,
        categories,
        frequency: freq,
        onChange: (p) => {
            unitEl.textContent = p ? unitLabel(p.unit) : '—';
            if (p && !allowsFraction(p.unit) && /[.,]/.test(qtyInput.value))
                qtyInput.value = String(Math.max(1, Math.round(Number(qtyInput.value.replace(',', '.')) || 1)));
        },
    });
    const preselect = c.query.get('produkt');
    if (preselect) {
        const p = products.find((x) => x.id === preselect && x.active);
        if (p)
            picker.set(p);
    }
    const urgent = h('input', { type: 'checkbox', id: 'urgent' });
    const note = textInput({ maxLength: 300, placeholder: 'np. do piątku, konkretna marka' });
    function step(dir) {
        const p = picker.get();
        const r = parseQuantity(qtyInput.value);
        const cur = r.ok ? r.value : 0;
        const stepBy = p && allowsFraction(p.unit) && cur < 5 ? 0.5 : 1;
        const next = Math.max(0, Math.round((cur + dir * stepBy) * 1000) / 1000);
        qtyInput.value = formatQty(next === 0 ? 1 : next);
    }
    const submit = button('DODAJ', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form card', novalidate: true }, picker.el, h('div', { class: 'field' }, h('label', null, 'Ilość'), h('div', { class: 'qty-row' }, h('button', { type: 'button', class: 'qty-btn', 'aria-label': 'Mniej', onclick: () => step(-1) }, icon('minus', 24)), qtyInput, h('button', { type: 'button', class: 'qty-btn', 'aria-label': 'Więcej', onclick: () => step(1) }, icon('plus', 24)), unitEl), qtyErr), h('label', { class: 'check', for: 'urgent' }, urgent, h('span', null, 'PILNE')), h('details', null, h('summary', { class: 'muted', style: 'cursor:pointer;padding:6px 0' }, 'Dodaj uwagę'), field('Uwaga', note).el), submit, h('button', {
        type: 'button',
        class: 'muted small',
        style: 'background:none;border:0;padding:8px;cursor:pointer;text-decoration:underline',
        onclick: () => openRequestProduct(),
    }, 'Nie ma na liście?'));
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        void guarded(submit, async () => {
            const p = picker.get();
            picker.setError(p ? null : 'Wybierz produkt z listy.');
            const q = parseQuantity(qtyInput.value);
            qtyErr.textContent = q.ok ? '' : q.error;
            const n = validateText(note.value, 'uwaga', 0, 300);
            if (!n.ok)
                toast(n.error, 'error');
            if (!p || !q.ok || !n.ok)
                return;
            const clientId = uuid();
            const args = {
                p_product_id: p.id,
                p_quantity: q.value,
                p_urgent: urgent.checked,
                p_note: n.value || null,
            };
            const label = `${p.name} — ${qtyText(q.value, p.unit)}`;
            try {
                await rpc('report_shortage', { ...args, p_client_id: clientId });
                toast(`Dodano: ${label}`, 'ok');
            }
            catch (err) {
                if (!isNetworkError(err))
                    throw err;
                enqueue({ id: clientId, kind: 'report_shortage', label, args });
                toast(`Brak internetu — zapisano na telefonie: ${label}. Wyślemy automatycznie.`, 'info');
            }
            added.unshift(label);
            mount(addedHost, h('div', { class: 'card' }, h('strong', null, 'Dodane teraz'), h('ul', { style: 'margin:8px 0 0;padding-left:20px' }, added.slice(0, 6).map((a) => h('li', null, a)))));
            picker.set(null);
            qtyInput.value = '1';
            urgent.checked = false;
            note.value = '';
            picker.focusQuiet();
        });
    });
    function openRequestProduct() {
        const name = field('Nazwa produktu', textInput({ maxLength: 80, placeholder: 'np. Szafran' }));
        const m = openModal({ title: 'Nie ma na liście?', body: null });
        const send = button('Poproś o dodanie', { type: 'submit', size: 'lg', block: true });
        const f = h('form', { class: 'form', novalidate: true }, h('p', { class: 'muted' }, 'Manager dostanie zadanie „Dodać produkt” i doda go do katalogu.'), name.el, send);
        f.addEventListener('submit', (e) => {
            e.preventDefault();
            void guarded(send, async () => {
                const v = validateText(name.input.value, 'nazwę produktu', 1, 80);
                name.setError(v.ok ? null : v.error);
                if (!v.ok)
                    return;
                await rpc('request_new_product', { p_name: v.value });
                m.close();
                toast('Wysłano prośbę do managera.', 'ok');
            });
        });
        m.el.querySelector('.modal-body')?.replaceChildren(f);
        name.input.focus();
    }
    mount(c.el, h('div', { class: 'page' }, form, addedHost, quickPick({
        products,
        categories,
        frequency: freq,
        onPick: (p) => {
            picker.set(p);
            form.scrollIntoView({ block: 'start', behavior: 'smooth' });
            qtyInput.focus({ preventScroll: true });
            qtyInput.select();
        },
    }), h('div', { class: 'row-actions' }, button('Gotowe', { variant: 'ghost', onClick: () => navigate(homePath(role())) }))));
    picker.focusQuiet();
}
