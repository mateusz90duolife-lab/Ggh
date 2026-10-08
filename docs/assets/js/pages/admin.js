import { callFunction, eq, gte, insert, list, remove, update } from '../api/db.js';
import { h, mount } from '../dom.js';
import { describeAudit, AUDIT_TABLES } from '../lib/audit.js';
import { errorMessage } from '../lib/errors.js';
import { WEEKDAY_SHORT, formatDate, formatDateTime, nextOccurrences, plural, relativeTime } from '../lib/format.js';
import { generatePassword } from '../lib/password.js';
import { parseEmailList, validateEmail, validateText, validateTime, validateTimeZone } from '../lib/validate.js';
import { loadCatalog, nameOf, profile, restaurant, rememberName, tz, today } from '../state.js';
import { ROLE_LABEL } from '../layout.js';
import { button, chip, emptyState, errorState, field, guarded, selectInput, skeleton, textInput, } from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
// ------------------------------------------------------------------ pracownicy
export async function usersPage(c) {
    c.setTitle('Pracownicy');
    const host = h('div', { class: 'page' }, skeleton(4));
    mount(c.el, host);
    async function load() {
        try {
            const { users } = await callFunction('admin-users', { action: 'list' });
            if (!c.isAlive())
                return;
            for (const u of users)
                rememberName(u.id, u.full_name);
            const me = profile()?.id;
            mount(host, h('div', { class: 'row-actions' }, button('Dodaj pracownika', { icon: 'plus', onClick: () => openCreate(() => void load()) })), h('div', { class: 'card card-flush' }, users.map((u) => h('button', {
                type: 'button',
                class: 'item',
                style: 'width:100%;border:0;text-align:left;cursor:pointer',
                onclick: () => openEdit(u, u.id === me, () => void load()),
            }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, u.full_name, u.id === me ? h('span', { class: 'muted' }, ' (Ty)') : null), h('div', { class: 'item-sub' }, `${u.nick ? `nick: ${u.nick} · PIN` : (u.email ?? '—')} · ${u.last_sign_in_at ? `ostatnio: ${relativeTime(u.last_sign_in_at, new Date(), tz())}` : 'nie logował(a) się'}`)), h('span', { class: `badge ${u.active ? 'badge-neutral' : 'badge-out'}` }, u.active ? ROLE_LABEL[u.role] : 'Nieaktywny')))), h('p', { class: 'muted small' }, 'Dezaktywowane konto traci dostęp natychmiast, a historia jego działań zostaje zachowana.'));
        }
        catch (e) {
            if (c.isAlive())
                mount(host, errorState(errorMessage(e), () => void load()));
        }
    }
    await load();
}
function passwordBox(initial = '') {
    const input = textInput({ value: initial, autocomplete: 'off' });
    const f = field('Hasło tymczasowe', input, {
        hint: 'Min. 8 znaków. Przekaż osobiście — po pierwszym logowaniu można je zmienić w „Więcej”.',
    });
    const gen = button('Wygeneruj', {
        size: 'sm',
        variant: 'soft',
        onClick: () => {
            input.value = generatePassword();
        },
    });
    return { el: h('div', { class: 'form' }, f.el, h('div', null, gen)), get: () => input.value, input };
}
function randomPin() {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    return String((b[0] ?? 0) % 10000).padStart(4, '0');
}
function pinBox(label = 'PIN (4 cyfry)') {
    const input = h('input', {
        class: 'input',
        type: 'text',
        inputMode: 'numeric',
        autocomplete: 'off',
        maxLength: 4,
        value: randomPin(),
    });
    const f = field(label, input, { hint: 'Pracownik wpisuje go przy logowaniu razem z nickiem. Przekaż osobiście.' });
    const gen = button('Losuj', {
        size: 'sm',
        variant: 'soft',
        onClick: () => {
            input.value = randomPin();
        },
    });
    return { el: h('div', { class: 'form' }, f.el, h('div', null, gen)), get: () => input.value.trim(), input };
}
function openCreate(onSaved) {
    const name = field('Imię i nazwisko', textInput({ maxLength: 80, required: true, autocomplete: 'off' }));
    const modeSel = selectInput([
        { value: 'pin', label: 'Nick i 4-cyfrowy PIN (pracownik)' },
        { value: 'email', label: 'E-mail i hasło' },
    ], 'pin');
    const mode = field('Logowanie', modeSel);
    const nick = field('Nick (login)', textInput({ maxLength: 24, autocomplete: 'off', placeholder: 'np. kasia' }));
    nick.input.setAttribute('autocapitalize', 'none');
    const pin = pinBox();
    const email = field('Adres e-mail (login)', textInput({ type: 'email', inputMode: 'email', autocomplete: 'off', required: true }));
    const roleSel = selectInput([
        { value: 'employee', label: 'Pracownik' },
        { value: 'manager', label: 'Manager' },
        { value: 'owner', label: 'Właściciel' },
    ], 'employee');
    const role = field('Rola', roleSel);
    const pw = passwordBox(generatePassword());
    const pinPart = h('div', { class: 'form' }, nick.el, pin.el);
    const emailPart = h('div', { class: 'form' }, email.el, pw.el);
    const syncMode = () => {
        const isPin = modeSel.value === 'pin';
        pinPart.hidden = !isPin;
        emailPart.hidden = isPin;
        roleSel.querySelector('option[value="owner"]')?.toggleAttribute('disabled', isPin);
        if (isPin && roleSel.value === 'owner')
            roleSel.value = 'employee';
    };
    modeSel.addEventListener('change', syncMode);
    syncMode();
    const m = openModal({ title: 'Nowy pracownik', body: null });
    const save = button('Utwórz konto', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form', novalidate: true }, name.el, mode.el, pinPart, emailPart, role.el, save);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        void guarded(save, async () => {
            const n = validateText(name.input.value, 'imię i nazwisko', 2, 80);
            name.setError(n.ok ? null : n.error);
            const r = roleSel.value;
            let rows;
            if (modeSel.value === 'pin') {
                const nk = nick.input.value.trim().toLowerCase();
                const nickOk = /^[a-z0-9ąćęłńóśźż._-]{2,24}$/.test(nk);
                nick.setError(nickOk ? null : 'Nick: 2–24 znaki — małe litery, cyfry, kropka, myślnik.');
                const pn = pin.get();
                const pinOk = /^\d{4}$/.test(pn);
                pin.input.closest('.field')?.classList.toggle('has-error', !pinOk);
                if (!pinOk)
                    toast('PIN musi mieć dokładnie 4 cyfry.', 'error');
                if (!n.ok || !nickOk || !pinOk)
                    return;
                await callFunction('admin-users', { action: 'create', full_name: n.value, nick: nk, pin: pn, role: r });
                rows = [
                    ['Nick', nk],
                    ['PIN', pn],
                ];
            }
            else {
                const em = validateEmail(email.input.value);
                email.setError(em.ok ? null : em.error);
                const pass = pw.get();
                pw.input.closest('.field')?.classList.toggle('has-error', pass.length < 8);
                if (pass.length < 8)
                    toast('Hasło musi mieć co najmniej 8 znaków.', 'error');
                if (!n.ok || !em.ok || pass.length < 8)
                    return;
                await callFunction('admin-users', {
                    action: 'create',
                    email: em.value,
                    full_name: n.value,
                    role: r,
                    password: pass,
                });
                rows = [
                    ['Login', em.value],
                    ['Hasło tymczasowe', pass],
                ];
            }
            mount(m.el.querySelector('.modal-body'), h('div', { class: 'form' }, h('div', { class: 'notice notice-ok' }, `Konto utworzone: ${n.value}`), h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)])), h('p', { class: 'muted small' }, 'Zapisz lub przekaż te dane teraz — nie będą ponownie widoczne.'), button('Gotowe', { size: 'lg', block: true, onClick: () => m.close() })));
            onSaved();
        });
    });
    m.el.querySelector('.modal-body')?.replaceChildren(form);
    name.input.focus();
}
function openEdit(u, isSelf, onSaved) {
    const name = field('Imię i nazwisko', textInput({ value: u.full_name, maxLength: 80 }));
    const nickField = u.nick ? field('Nick (login)', textInput({ value: u.nick, maxLength: 24 })) : null;
    const role = field('Rola', selectInput([
        { value: 'employee', label: 'Pracownik' },
        { value: 'manager', label: 'Manager' },
        { value: 'owner', label: 'Właściciel' },
    ], u.role));
    if (isSelf)
        role.input.disabled = true;
    const m = openModal({ title: u.full_name, body: null });
    const save = button('Zapisz zmiany', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form', novalidate: true }, h('p', { class: 'muted' }, u.nick ? `Logowanie: nick „${u.nick}” i PIN` : (u.email ?? '')), name.el, nickField ? nickField.el : null, role.el, isSelf
        ? h('p', { class: 'muted small' }, 'Własnej roli i statusu nie można zmienić (zabezpieczenie przed zablokowaniem sobie dostępu).')
        : null, save);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        void guarded(save, async () => {
            const n = validateText(name.input.value, 'imię i nazwisko', 2, 80);
            name.setError(n.ok ? null : n.error);
            if (!n.ok)
                return;
            const patch = { action: 'update', id: u.id };
            if (n.value !== u.full_name)
                patch.full_name = n.value;
            if (nickField) {
                const nk = nickField.input.value.trim().toLowerCase();
                if (nk !== u.nick)
                    patch.nick = nk;
            }
            const r = role.input.value;
            if (!isSelf && r !== u.role)
                patch.role = r;
            if (Object.keys(patch).length === 2) {
                m.close();
                return;
            }
            await callFunction('admin-users', patch);
            m.close();
            toast('Zapisano zmiany.', 'ok');
            onSaved();
        });
    });
    const extra = h('div', { class: 'form', style: 'margin-top:18px;border-top:1px solid var(--border);padding-top:16px' }, u.nick
        ? button('Ustaw nowy PIN', { variant: 'soft', block: true, onClick: () => openSetPin(u, () => m.close()) })
        : button('Resetuj hasło', { variant: 'soft', block: true, onClick: () => openReset(u, () => m.close()) }), h('a', { class: 'btn btn-soft btn-block', href: `#/zespol/${u.id}` }, 'Godziny, zamówienia i zadania'), !isSelf
        ? button(u.active ? 'Dezaktywuj konto' : 'Aktywuj konto', {
            variant: u.active ? 'danger' : 'primary',
            block: true,
            onClick: async () => {
                if (u.active &&
                    !(await confirmDialog({
                        title: 'Dezaktywować konto?',
                        message: `${u.full_name} straci dostęp do aplikacji. Historia działań zostanie zachowana.`,
                        confirmLabel: 'Dezaktywuj',
                        danger: true,
                    })))
                    return;
                await callFunction('admin-users', { action: 'update', id: u.id, active: !u.active });
                m.close();
                toast(u.active ? 'Konto dezaktywowane.' : 'Konto aktywowane.', 'ok');
                onSaved();
            },
        })
        : null);
    m.el.querySelector('.modal-body')?.replaceChildren(form, extra);
}
function openSetPin(u, onDone) {
    const pin = pinBox('Nowy PIN (4 cyfry)');
    const m = openModal({ title: `Nowy PIN: ${u.full_name}`, body: null });
    const save = button('Ustaw PIN', {
        size: 'lg',
        block: true,
        onClick: async () => {
            const p = pin.get();
            if (!/^\d{4}$/.test(p)) {
                toast('PIN musi mieć dokładnie 4 cyfry.', 'error');
                return;
            }
            await callFunction('admin-users', { action: 'set_pin', id: u.id, pin: p });
            mount(m.el.querySelector('.modal-body'), h('div', { class: 'form' }, h('div', { class: 'notice notice-ok' }, 'PIN zmieniony. Blokada po błędnych próbach została zdjęta.'), h('dl', { class: 'kv' }, h('dt', null, 'Nick'), h('dd', null, u.nick ?? ''), h('dt', null, 'Nowy PIN'), h('dd', null, p)), button('Gotowe', {
                size: 'lg',
                block: true,
                onClick: () => {
                    m.close();
                    onDone();
                },
            })));
        },
    });
    m.el.querySelector('.modal-body')?.replaceChildren(h('div', { class: 'form' }, pin.el, save));
}
function openReset(u, onDone) {
    const pw = passwordBox(generatePassword());
    const m = openModal({ title: `Nowe hasło: ${u.full_name}`, body: null });
    const save = button('Ustaw hasło', {
        size: 'lg',
        block: true,
        onClick: async () => {
            const pass = pw.get();
            if (pass.length < 8) {
                toast('Hasło musi mieć co najmniej 8 znaków.', 'error');
                return;
            }
            await callFunction('admin-users', { action: 'reset_password', id: u.id, password: pass });
            mount(m.el.querySelector('.modal-body'), h('div', { class: 'form' }, h('div', { class: 'notice notice-ok' }, 'Hasło zostało zmienione.'), h('dl', { class: 'kv' }, h('dt', null, 'Nowe hasło'), h('dd', null, pass)), h('p', { class: 'muted small' }, 'Przekaż je osobiście — nie będzie ponownie widoczne.'), button('Gotowe', {
                size: 'lg',
                block: true,
                onClick: () => {
                    m.close();
                    onDone();
                },
            })));
        },
    });
    m.el.querySelector('.modal-body')?.replaceChildren(h('div', { class: 'form' }, pw.el, save));
}
// ------------------------------------------------------------------ szablony zadań
export async function templatesPage(c) {
    c.setTitle('Szablony zadań');
    const host = h('div', { class: 'page' }, skeleton(3));
    mount(c.el, host);
    async function load() {
        try {
            const rows = await list('task_templates', {
                select: 'id,title,description,days_of_week,active',
                order: 'title.asc',
            });
            if (!c.isAlive())
                return;
            mount(host, h('p', { class: 'muted' }, 'Zadania z szablonów tworzą się automatycznie każdego dnia, który zaznaczysz.'), h('div', { class: 'row-actions' }, button('Nowy szablon', { icon: 'plus', onClick: () => openTemplate(null, () => void load()) })), rows.length
                ? h('div', { class: 'card card-flush' }, rows.map((t) => h('button', {
                    type: 'button',
                    class: 'item',
                    style: 'width:100%;border:0;text-align:left;cursor:pointer',
                    onclick: () => openTemplate(t, () => void load()),
                }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, t.title), h('div', { class: 'item-sub' }, [...t.days_of_week]
                    .sort()
                    .map((d) => WEEKDAY_SHORT[d - 1])
                    .join(', '))), h('span', { class: `badge ${t.active ? 'badge-ok' : 'badge-neutral'}` }, t.active ? 'Aktywny' : 'Wyłączony'))))
                : emptyState('Brak szablonów', 'Dodaj np. „Sprzątanie chłodni” na poniedziałek, środę i piątek.'));
        }
        catch (e) {
            if (c.isAlive())
                mount(host, errorState(errorMessage(e), () => void load()));
        }
    }
    await load();
}
function openTemplate(t, onSaved) {
    const title = field('Nazwa zadania', textInput({ value: t?.title ?? '', maxLength: 120, required: true }));
    const desc = field('Opis (opcjonalnie)', textInput({ value: t?.description ?? '', maxLength: 500 }));
    const days = new Set(t?.days_of_week ?? []);
    const daysHost = h('div', { class: 'days' });
    const daysErr = h('div', { class: 'field-error', role: 'alert' });
    const preview = h('div', { class: 'muted small' });
    const activeBox = h('input', { type: 'checkbox', id: 't_active', checked: t?.active ?? true });
    function drawDays() {
        mount(daysHost, WEEKDAY_SHORT.map((label, i) => chip(label, {
            active: days.has(i + 1),
            onClick: () => {
                if (days.has(i + 1))
                    days.delete(i + 1);
                else
                    days.add(i + 1);
                daysErr.textContent = '';
                drawDays();
            },
        })));
        preview.textContent = days.size
            ? `Najbliższe: ${nextOccurrences([...days], today())
                .map(formatDate)
                .join(', ')}`
            : '';
    }
    drawDays();
    const m = openModal({ title: t ? 'Edytuj szablon' : 'Nowy szablon', body: null });
    const save = button('Zapisz', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form', novalidate: true }, title.el, desc.el, h('div', { class: 'field' }, h('label', null, 'Dni tygodnia'), daysHost, daysErr, preview), h('label', { class: 'check', for: 't_active' }, activeBox, h('span', null, 'Szablon aktywny')), save, t
        ? button('Usuń szablon', {
            variant: 'ghost',
            block: true,
            onClick: async () => {
                if (!(await confirmDialog({
                    title: 'Usunąć szablon?',
                    message: `„${t.title}” przestanie tworzyć nowe zadania. Dotychczasowe zadania zostają.`,
                    confirmLabel: 'Usuń',
                    danger: true,
                })))
                    return;
                await remove('task_templates', { id: eq(t.id) });
                m.close();
                toast('Szablon usunięty.', 'ok');
                onSaved();
            },
        })
        : null);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        void guarded(save, async () => {
            const n = validateText(title.input.value, 'nazwę zadania', 1, 120);
            title.setError(n.ok ? null : n.error);
            daysErr.textContent = days.size ? '' : 'Zaznacz co najmniej jeden dzień.';
            if (!n.ok || !days.size)
                return;
            const row = {
                title: n.value,
                description: desc.input.value.trim() || null,
                days_of_week: [...days].sort(),
                active: activeBox.checked,
            };
            if (t)
                await update('task_templates', { id: eq(t.id) }, row);
            else
                await insert('task_templates', row);
            m.close();
            toast('Zapisano szablon.', 'ok');
            onSaved();
        });
    });
    m.el.querySelector('.modal-body')?.replaceChildren(form);
    title.input.focus();
}
// ------------------------------------------------------------------ ustawienia
export async function settingsPage(c) {
    c.setTitle('Ustawienia');
    const r = restaurant();
    if (!r) {
        mount(c.el, h('div', { class: 'page' }, errorState('Nie wczytano danych lokalu.')));
        return;
    }
    const name = field('Nazwa lokalu', textInput({ value: r.name, maxLength: 100 }));
    const zone = field('Strefa czasu', textInput({ value: r.timezone }), { hint: 'np. Europe/Warsaw' });
    const time = field('Godzina wysyłki listy zakupów', textInput({ type: 'time', value: r.summary_time.slice(0, 5) }), {
        hint: 'Czas lokalny. Mail wychodzi raz dziennie, jeśli lista nie jest pusta.',
    });
    const emailsInput = h('textarea', { class: 'input', rows: 3, placeholder: 'wlasciciel@example.com' }, (r.summary_emails ?? []).join('\n'));
    const emails = field('Odbiorcy e-maila z listą zakupów', emailsInput, { hint: 'Jeden adres w linii (max 10).' });
    const save = button('Zapisz ustawienia', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form card', novalidate: true }, name.el, zone.el, time.el, emails.el, save);
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        void guarded(save, async () => {
            const n = validateText(name.input.value, 'nazwę lokalu', 1, 100);
            name.setError(n.ok ? null : n.error);
            const z = validateTimeZone(zone.input.value.trim());
            zone.setError(z.ok ? null : z.error);
            const t = validateTime(time.input.value);
            time.setError(t.ok ? null : t.error);
            const em = parseEmailList(emailsInput.value);
            emails.setError(em.ok ? null : em.error);
            if (!n.ok || !z.ok || !t.ok || !em.ok)
                return;
            await update('restaurants', { id: eq(r.id) }, { name: n.value, timezone: z.value, summary_time: `${t.value}:00`, summary_emails: em.value });
            Object.assign(r, { name: n.value, timezone: z.value, summary_time: `${t.value}:00`, summary_emails: em.value });
            toast('Ustawienia zapisane.', 'ok');
        });
    });
    const test = button('Wyślij testowy e-mail', {
        variant: 'soft',
        icon: 'mail',
        block: true,
        onClick: async () => {
            const res = await callFunction('daily-shopping-summary', { test: true });
            toast(`Wysłano wiadomość testową na ${res.sent_to} ${plural(res.sent_to, 'adres', 'adresy', 'adresów')}.`, 'ok');
        },
    });
    mount(c.el, h('div', { class: 'page' }, form, h('div', { class: 'card form' }, h('strong', null, 'Test wysyłki'), h('p', { class: 'muted small' }, 'Zapisz ustawienia, a potem wyślij wiadomość testową na podane adresy.'), test)));
}
// ------------------------------------------------------------------ historia zmian (audit log)
export async function auditPage(c) {
    c.setTitle('Historia zmian');
    const host = h('div', { class: 'page' }, skeleton(5));
    mount(c.el, host);
    let tableFilter = '';
    let actorFilter = '';
    let period = '7';
    let limit = 100;
    const catalog = await loadCatalog().catch(() => ({ products: [], categories: [] }));
    const prod = new Map(catalog.products.map((p) => [p.id, p]));
    const lookups = {
        productName: (id) => prod.get(id)?.name ?? 'produkt',
        productUnit: (id) => prod.get(id)?.unit ?? '',
        userName: (id) => nameOf(id),
    };
    const tableSel = selectInput([{ value: '', label: 'Wszystko' }, ...AUDIT_TABLES.map((t) => ({ value: t.value, label: t.label }))], '');
    const actors = [
        ...new Set([
            ...(await list('profiles', {
                select: 'id,full_name',
                order: 'full_name.asc',
            }).catch(() => [])),
        ]),
    ];
    const actorSel = selectInput([{ value: '', label: 'Wszyscy' }, ...actors.map((a) => ({ value: a.id, label: a.full_name }))], '');
    const periodSel = selectInput([
        { value: '1', label: 'Ostatnie 24 godziny' },
        { value: '7', label: 'Ostatnie 7 dni' },
        { value: '30', label: 'Ostatnie 30 dni' },
    ], '7');
    const listHost = h('div', null, skeleton(4));
    const apply = () => {
        tableFilter = tableSel.value;
        actorFilter = actorSel.value;
        period = periodSel.value;
        limit = 100;
        void load();
    };
    for (const s of [tableSel, actorSel, periodSel])
        s.addEventListener('change', apply);
    mount(host, h('div', { class: 'grid grid-3' }, field('Co', tableSel).el, field('Kto', actorSel).el, field('Kiedy', periodSel).el), listHost);
    async function load() {
        mount(listHost, skeleton(4));
        try {
            const since = new Date(Date.now() - Number(period) * 86400000).toISOString();
            const params = { created_at: gte(since) };
            if (tableFilter)
                params.table_name = eq(tableFilter);
            if (actorFilter)
                params.actor_id = eq(actorFilter);
            const rows = await list('audit_logs', {
                select: 'id,actor_id,action,table_name,record_id,old_data,new_data,created_at',
                params,
                order: 'id.desc',
                limit,
                cache: false,
            });
            if (!c.isAlive())
                return;
            mount(listHost, rows.length
                ? [
                    h('div', { class: 'card card-flush' }, rows.map((a) => h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' }, describeAudit(a, lookups)), h('div', { class: 'item-sub' }, `${a.actor_id ? nameOf(a.actor_id) : 'System'} · ${formatDateTime(a.created_at, tz())}`))))),
                    rows.length >= limit
                        ? h('div', { style: 'margin-top:12px' }, button('Pokaż starsze', {
                            variant: 'soft',
                            block: true,
                            onClick: () => {
                                limit += 100;
                                return load();
                            },
                        }))
                        : null,
                ]
                : emptyState('Brak zmian w wybranym okresie'));
        }
        catch (e) {
            if (c.isAlive())
                mount(listHost, errorState(errorMessage(e), () => void load()));
        }
    }
    await load();
}
