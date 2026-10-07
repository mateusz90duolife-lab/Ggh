import { eq, insert, list, remove, update } from '../api/db.js';
import { h, icon, mount } from '../dom.js';
import { ApiError, errorMessage } from '../lib/errors.js';
import { relativeTime } from '../lib/format.js';
import { validateEmail, validateText } from '../lib/validate.js';
import { navigate } from '../router.js';
import { isOwner, tz } from '../state.js';
import { button, emptyState, errorState, field, guarded, numberInput, skeleton, textInput } from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { parseQuantity } from '../lib/validate.js';
// ------------------------------------------------------------------ kategorie
export async function categoriesPage(c) {
    c.setTitle('Kategorie');
    const host = h('div', { class: 'page' }, skeleton(4));
    mount(c.el, host);
    async function load() {
        try {
            const rows = await list('product_categories', {
                select: 'id,name,sort_order',
                order: 'sort_order.asc,name.asc',
            });
            if (!c.isAlive())
                return;
            mount(host, h('div', { class: 'row-actions' }, button('Nowa kategoria', { icon: 'plus', onClick: () => openCategory(null, rows, () => void load()) })), rows.length
                ? h('div', { class: 'card card-flush' }, rows.map((r) => h('button', {
                    type: 'button',
                    class: 'item',
                    style: 'width:100%;border:0;text-align:left;cursor:pointer',
                    onclick: () => openCategory(r, rows, () => void load()),
                }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, r.name), h('div', { class: 'item-sub' }, `kolejność: ${r.sort_order}`)), icon('chevron', 18))))
                : emptyState('Brak kategorii', 'Kategorie porządkują magazyn i listę zakupów (np. Nabiał, Warzywa, Mięso).'));
        }
        catch (e) {
            if (c.isAlive())
                mount(host, errorState(errorMessage(e), () => void load()));
        }
    }
    await load();
}
function openCategory(cat, all, onSaved) {
    const name = field('Nazwa kategorii', textInput({ value: cat?.name ?? '', maxLength: 60, required: true }));
    const order = field('Kolejność na liście', numberInput({ value: String(cat?.sort_order ?? (all.length ? Math.max(...all.map((x) => x.sort_order)) + 1 : 1)) }), { hint: 'Mniejsza liczba = wyżej.' });
    const m = openModal({ title: cat ? 'Edytuj kategorię' : 'Nowa kategoria', body: null });
    const save = button('Zapisz', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form', novalidate: true }, name.el, order.el, save, cat && isOwner()
        ? button('Usuń kategorię', {
            variant: 'ghost',
            block: true,
            onClick: async () => {
                if (!(await confirmDialog({
                    title: 'Usunąć kategorię?',
                    message: `Produkty z kategorii „${cat.name}” zostaną oznaczone jako „Inne”.`,
                    confirmLabel: 'Usuń',
                    danger: true,
                })))
                    return;
                await remove('product_categories', { id: eq(cat.id) });
                m.close();
                toast('Kategoria usunięta.', 'ok');
                onSaved();
            },
        })
        : null);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        void guarded(save, async () => {
            const n = validateText(name.input.value, 'nazwę kategorii', 1, 60);
            name.setError(n.ok ? null : n.error);
            const o = parseQuantity(order.input.value, { allowZero: true });
            order.setError(o.ok ? null : o.error);
            if (!n.ok || !o.ok)
                return;
            try {
                if (cat)
                    await update('product_categories', { id: eq(cat.id) }, { name: n.value, sort_order: Math.round(o.value) });
                else
                    await insert('product_categories', { name: n.value, sort_order: Math.round(o.value) });
            }
            catch (err) {
                if (err instanceof ApiError && err.code === '23505') {
                    name.setError('Kategoria o tej nazwie już istnieje.');
                    return;
                }
                throw err;
            }
            m.close();
            toast('Zapisano kategorię.', 'ok');
            onSaved();
        });
    });
    m.el.querySelector('.modal-body')?.replaceChildren(form);
    name.input.focus();
}
export async function suppliersPage(c) {
    c.setTitle('Dostawcy');
    const host = h('div', { class: 'page' }, skeleton(4));
    mount(c.el, host);
    async function load() {
        try {
            const rows = await list('suppliers', {
                select: 'id,name,active,tax_id,phone,email',
                order: 'name.asc',
            });
            if (!c.isAlive())
                return;
            mount(host, h('div', { class: 'row-actions' }, button('Nowy dostawca', { icon: 'plus', onClick: () => openSupplier(null, () => void load()) })), rows.length
                ? h('div', { class: 'card card-flush' }, rows.map((r) => h('button', {
                    type: 'button',
                    class: 'item',
                    style: 'width:100%;border:0;text-align:left;cursor:pointer',
                    onclick: () => openSupplier(r, () => void load()),
                }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, r.name), h('div', { class: 'item-sub' }, [r.phone, r.email].filter(Boolean).join(' · ') || 'brak danych kontaktowych')), r.active ? null : h('span', { class: 'badge badge-neutral' }, 'nieaktywny'))))
                : emptyState('Brak dostawców', 'Dodaj dostawcę, aby przypisywać go do zakupów.'));
        }
        catch (e) {
            if (c.isAlive())
                mount(host, errorState(errorMessage(e), () => void load()));
        }
    }
    await load();
}
function openSupplier(s, onSaved) {
    const name = field('Nazwa', textInput({ value: s?.name ?? '', maxLength: 120, required: true }));
    const nip = field('NIP (opcjonalnie)', textInput({ value: s?.tax_id ?? '', maxLength: 20, inputMode: 'numeric' }));
    const phone = field('Telefon (opcjonalnie)', textInput({ value: s?.phone ?? '', maxLength: 30, type: 'tel' }));
    const email = field('E-mail (opcjonalnie)', textInput({ value: s?.email ?? '', maxLength: 200, type: 'email' }));
    const activeBox = h('input', { type: 'checkbox', id: 's_active', checked: s?.active ?? true });
    const m = openModal({ title: s ? 'Edytuj dostawcę' : 'Nowy dostawca', body: null });
    const save = button('Zapisz', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form', novalidate: true }, name.el, nip.el, phone.el, email.el, s ? h('label', { class: 'check', for: 's_active' }, activeBox, h('span', null, 'Dostawca aktywny')) : null, save);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        void guarded(save, async () => {
            const n = validateText(name.input.value, 'nazwę', 1, 120);
            name.setError(n.ok ? null : n.error);
            const emRaw = email.input.value.trim();
            const em = emRaw ? validateEmail(emRaw) : { ok: true, value: '' };
            email.setError(em.ok ? null : em.error);
            if (!n.ok || !em.ok)
                return;
            const row = {
                name: n.value,
                tax_id: nip.input.value.trim() || null,
                phone: phone.input.value.trim() || null,
                email: em.value || null,
                ...(s ? { active: activeBox.checked } : {}),
            };
            try {
                if (s)
                    await update('suppliers', { id: eq(s.id) }, row);
                else
                    await insert('suppliers', row);
            }
            catch (err) {
                if (err instanceof ApiError && err.code === '23505') {
                    name.setError('Dostawca o tej nazwie już istnieje.');
                    return;
                }
                throw err;
            }
            m.close();
            toast('Zapisano dostawcę.', 'ok');
            onSaved();
        });
    });
    m.el.querySelector('.modal-body')?.replaceChildren(form);
    name.input.focus();
}
// ------------------------------------------------------------------ powiadomienia
export async function notificationsPage(c) {
    c.setTitle('Powiadomienia');
    const host = h('div', { class: 'page' }, skeleton(4));
    mount(c.el, host);
    async function load() {
        try {
            const rows = await list('notifications', {
                select: 'id,type,title,body,read_at,created_at',
                order: 'created_at.desc',
                limit: 50,
                cache: false,
            });
            if (!c.isAlive())
                return;
            const unread = rows.filter((r) => !r.read_at).length;
            mount(host, unread
                ? h('div', { class: 'row-actions' }, button('Oznacz wszystkie jako przeczytane', {
                    variant: 'soft',
                    onClick: async () => {
                        await update('notifications', { read_at: 'is.null' }, { read_at: new Date().toISOString() });
                        await load();
                    },
                }))
                : null, rows.length
                ? h('div', { class: 'card card-flush' }, rows.map((n) => h('button', {
                    type: 'button',
                    class: 'item',
                    style: 'width:100%;border:0;text-align:left;cursor:pointer',
                    onclick: async () => {
                        if (!n.read_at)
                            await update('notifications', { id: eq(n.id) }, { read_at: new Date().toISOString() }).catch(() => []);
                        if (n.type === 'low_stock')
                            navigate('/magazyn?filtr=braki');
                        else
                            await load();
                    },
                }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, n.read_at ? n.title : `● ${n.title}`), h('div', { class: 'item-sub' }, `${n.body ?? ''} · ${relativeTime(n.created_at, new Date(), tz())}`)))))
                : emptyState('Brak powiadomień', 'Alert pojawi się, gdy stan produktu spadnie poniżej minimum.'));
        }
        catch (e) {
            if (c.isAlive())
                mount(host, errorState(errorMessage(e), () => void load()));
        }
    }
    await load();
}
