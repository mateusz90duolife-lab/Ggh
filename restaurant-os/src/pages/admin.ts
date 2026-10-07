import { callFunction, eq, gte, insert, list, remove, update } from '../api/db.js';
import { h, mount } from '../dom.js';
import { describeAudit, AUDIT_TABLES } from '../lib/audit.js';
import { errorMessage } from '../lib/errors.js';
import { WEEKDAY_SHORT, formatDate, formatDateTime, nextOccurrences, plural, relativeTime } from '../lib/format.js';
import { generatePassword } from '../lib/password.js';
import { parseEmailList, validateEmail, validateText, validateTime, validateTimeZone } from '../lib/validate.js';
import type { PageCtx } from '../router.js';
import { loadCatalog, nameOf, profile, restaurant, rememberName, tz, today } from '../state.js';
import type { AuditLog, Role, TaskTemplate, TeamUser } from '../types.js';
import { ROLE_LABEL } from '../layout.js';
import {
  button,
  chip,
  emptyState,
  errorState,
  field,
  guarded,
  selectInput,
  skeleton,
  textInput,
} from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

// ------------------------------------------------------------------ pracownicy
export async function usersPage(c: PageCtx): Promise<void> {
  c.setTitle('Pracownicy');
  const host = h('div', { class: 'page' }, skeleton(4));
  mount(c.el, host);

  async function load() {
    try {
      const { users } = await callFunction<{ users: TeamUser[] }>('admin-users', { action: 'list' });
      if (!c.isAlive()) return;
      for (const u of users) rememberName(u.id, u.full_name);
      const me = profile()?.id;
      mount(
        host,
        h(
          'div',
          { class: 'row-actions' },
          button('Dodaj pracownika', { icon: 'plus', onClick: () => openCreate(() => void load()) }),
        ),
        h(
          'div',
          { class: 'card card-flush' },
          users.map((u) =>
            h(
              'button',
              {
                type: 'button',
                class: 'item',
                style: 'width:100%;border:0;text-align:left;cursor:pointer',
                onclick: () => openEdit(u, u.id === me, () => void load()),
              },
              h(
                'div',
                { class: 'item-main' },
                h(
                  'div',
                  { class: 'item-title' },
                  u.full_name,
                  u.id === me ? h('span', { class: 'muted' }, ' (Ty)') : null,
                ),
                h(
                  'div',
                  { class: 'item-sub' },
                  `${u.email ?? '—'} · ${u.last_sign_in_at ? `ostatnio: ${relativeTime(u.last_sign_in_at, new Date(), tz())}` : 'nie logował(a) się'}`,
                ),
              ),
              h(
                'span',
                { class: `badge ${u.active ? 'badge-neutral' : 'badge-out'}` },
                u.active ? ROLE_LABEL[u.role] : 'Nieaktywny',
              ),
            ),
          ),
        ),
        h(
          'p',
          { class: 'muted small' },
          'Dezaktywowane konto traci dostęp natychmiast, a historia jego działań zostaje zachowana.',
        ),
      );
    } catch (e) {
      if (c.isAlive())
        mount(
          host,
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
}

function passwordBox(initial = ''): { el: HTMLElement; get(): string; input: HTMLInputElement } {
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

function openCreate(onSaved: () => void): void {
  const name = field('Imię i nazwisko', textInput({ maxLength: 80, required: true, autocomplete: 'off' }));
  const email = field(
    'Adres e-mail (login)',
    textInput({ type: 'email', inputMode: 'email', autocomplete: 'off', required: true }),
  );
  const role = field(
    'Rola',
    selectInput(
      [
        { value: 'employee', label: 'Pracownik' },
        { value: 'manager', label: 'Manager' },
        { value: 'owner', label: 'Właściciel' },
      ],
      'employee',
    ),
  );
  const pw = passwordBox(generatePassword());
  const m = openModal({ title: 'Nowy pracownik', body: null });
  const save = button('Utwórz konto', { type: 'submit', size: 'lg', block: true });
  const form = h('form', { class: 'form', novalidate: true }, name.el, email.el, role.el, pw.el, save);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const n = validateText((name.input as HTMLInputElement).value, 'imię i nazwisko', 2, 80);
      name.setError(n.ok ? null : n.error);
      const em = validateEmail((email.input as HTMLInputElement).value);
      email.setError(em.ok ? null : em.error);
      const pass = pw.get();
      pw.input.closest('.field')?.classList.toggle('has-error', pass.length < 8);
      if (pass.length < 8) toast('Hasło musi mieć co najmniej 8 znaków.', 'error');
      if (!n.ok || !em.ok || pass.length < 8) return;
      await callFunction('admin-users', {
        action: 'create',
        email: em.value,
        full_name: n.value,
        role: (role.input as HTMLSelectElement).value,
        password: pass,
      });
      mount(
        m.el.querySelector('.modal-body') as HTMLElement,
        h(
          'div',
          { class: 'form' },
          h('div', { class: 'notice notice-ok' }, `Konto utworzone: ${n.value}`),
          h(
            'dl',
            { class: 'kv' },
            h('dt', null, 'Login'),
            h('dd', null, em.value),
            h('dt', null, 'Hasło tymczasowe'),
            h('dd', null, pass),
          ),
          h('p', { class: 'muted small' }, 'Zapisz lub przekaż to hasło teraz — nie będzie ponownie widoczne.'),
          button('Gotowe', { size: 'lg', block: true, onClick: () => m.close() }),
        ),
      );
      onSaved();
    });
  });
  m.el.querySelector('.modal-body')?.replaceChildren(form);
  name.input.focus();
}

function openEdit(u: TeamUser, isSelf: boolean, onSaved: () => void): void {
  const name = field('Imię i nazwisko', textInput({ value: u.full_name, maxLength: 80 }));
  const role = field(
    'Rola',
    selectInput(
      [
        { value: 'employee', label: 'Pracownik' },
        { value: 'manager', label: 'Manager' },
        { value: 'owner', label: 'Właściciel' },
      ],
      u.role,
    ),
  );
  if (isSelf) (role.input as HTMLSelectElement).disabled = true;
  const m = openModal({ title: u.full_name, body: null });
  const save = button('Zapisz zmiany', { type: 'submit', size: 'lg', block: true });
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    h('p', { class: 'muted' }, u.email ?? ''),
    name.el,
    role.el,
    isSelf
      ? h(
          'p',
          { class: 'muted small' },
          'Własnej roli i statusu nie można zmienić (zabezpieczenie przed zablokowaniem sobie dostępu).',
        )
      : null,
    save,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const n = validateText((name.input as HTMLInputElement).value, 'imię i nazwisko', 2, 80);
      name.setError(n.ok ? null : n.error);
      if (!n.ok) return;
      const patch: Record<string, unknown> = { action: 'update', id: u.id };
      if (n.value !== u.full_name) patch.full_name = n.value;
      const r = (role.input as HTMLSelectElement).value as Role;
      if (!isSelf && r !== u.role) patch.role = r;
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
  const extra = h(
    'div',
    { class: 'form', style: 'margin-top:18px;border-top:1px solid var(--border);padding-top:16px' },
    button('Resetuj hasło', { variant: 'soft', block: true, onClick: () => openReset(u, () => m.close()) }),
    !isSelf
      ? button(u.active ? 'Dezaktywuj konto' : 'Aktywuj konto', {
          variant: u.active ? 'danger' : 'primary',
          block: true,
          onClick: async () => {
            if (
              u.active &&
              !(await confirmDialog({
                title: 'Dezaktywować konto?',
                message: `${u.full_name} straci dostęp do aplikacji. Historia działań zostanie zachowana.`,
                confirmLabel: 'Dezaktywuj',
                danger: true,
              }))
            )
              return;
            await callFunction('admin-users', { action: 'update', id: u.id, active: !u.active });
            m.close();
            toast(u.active ? 'Konto dezaktywowane.' : 'Konto aktywowane.', 'ok');
            onSaved();
          },
        })
      : null,
  );
  m.el.querySelector('.modal-body')?.replaceChildren(form, extra);
}

function openReset(u: TeamUser, onDone: () => void): void {
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
      mount(
        m.el.querySelector('.modal-body') as HTMLElement,
        h(
          'div',
          { class: 'form' },
          h('div', { class: 'notice notice-ok' }, 'Hasło zostało zmienione.'),
          h('dl', { class: 'kv' }, h('dt', null, 'Nowe hasło'), h('dd', null, pass)),
          h('p', { class: 'muted small' }, 'Przekaż je osobiście — nie będzie ponownie widoczne.'),
          button('Gotowe', {
            size: 'lg',
            block: true,
            onClick: () => {
              m.close();
              onDone();
            },
          }),
        ),
      );
    },
  });
  m.el.querySelector('.modal-body')?.replaceChildren(h('div', { class: 'form' }, pw.el, save));
}

// ------------------------------------------------------------------ szablony zadań
export async function templatesPage(c: PageCtx): Promise<void> {
  c.setTitle('Szablony zadań');
  const host = h('div', { class: 'page' }, skeleton(3));
  mount(c.el, host);
  async function load() {
    try {
      const rows = await list<TaskTemplate>('task_templates', {
        select: 'id,title,description,days_of_week,active',
        order: 'title.asc',
      });
      if (!c.isAlive()) return;
      mount(
        host,
        h('p', { class: 'muted' }, 'Zadania z szablonów tworzą się automatycznie każdego dnia, który zaznaczysz.'),
        h(
          'div',
          { class: 'row-actions' },
          button('Nowy szablon', { icon: 'plus', onClick: () => openTemplate(null, () => void load()) }),
        ),
        rows.length
          ? h(
              'div',
              { class: 'card card-flush' },
              rows.map((t) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'item',
                    style: 'width:100%;border:0;text-align:left;cursor:pointer',
                    onclick: () => openTemplate(t, () => void load()),
                  },
                  h(
                    'div',
                    { class: 'item-main' },
                    h('div', { class: 'item-title' }, t.title),
                    h(
                      'div',
                      { class: 'item-sub' },
                      [...t.days_of_week]
                        .sort()
                        .map((d) => WEEKDAY_SHORT[d - 1])
                        .join(', '),
                    ),
                  ),
                  h(
                    'span',
                    { class: `badge ${t.active ? 'badge-ok' : 'badge-neutral'}` },
                    t.active ? 'Aktywny' : 'Wyłączony',
                  ),
                ),
              ),
            )
          : emptyState('Brak szablonów', 'Dodaj np. „Sprzątanie chłodni” na poniedziałek, środę i piątek.'),
      );
    } catch (e) {
      if (c.isAlive())
        mount(
          host,
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
}

function openTemplate(t: TaskTemplate | null, onSaved: () => void): void {
  const title = field('Nazwa zadania', textInput({ value: t?.title ?? '', maxLength: 120, required: true }));
  const desc = field('Opis (opcjonalnie)', textInput({ value: t?.description ?? '', maxLength: 500 }));
  const days = new Set<number>(t?.days_of_week ?? []);
  const daysHost = h('div', { class: 'days' });
  const daysErr = h('div', { class: 'field-error', role: 'alert' });
  const preview = h('div', { class: 'muted small' });
  const activeBox = h('input', { type: 'checkbox', id: 't_active', checked: t?.active ?? true });
  function drawDays() {
    mount(
      daysHost,
      WEEKDAY_SHORT.map((label, i) =>
        chip(label, {
          active: days.has(i + 1),
          onClick: () => {
            if (days.has(i + 1)) days.delete(i + 1);
            else days.add(i + 1);
            daysErr.textContent = '';
            drawDays();
          },
        }),
      ),
    );
    preview.textContent = days.size
      ? `Najbliższe: ${nextOccurrences([...days], today())
          .map(formatDate)
          .join(', ')}`
      : '';
  }
  drawDays();
  const m = openModal({ title: t ? 'Edytuj szablon' : 'Nowy szablon', body: null });
  const save = button('Zapisz', { type: 'submit', size: 'lg', block: true });
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    title.el,
    desc.el,
    h('div', { class: 'field' }, h('label', null, 'Dni tygodnia'), daysHost, daysErr, preview),
    h('label', { class: 'check', for: 't_active' }, activeBox, h('span', null, 'Szablon aktywny')),
    save,
    t
      ? button('Usuń szablon', {
          variant: 'ghost',
          block: true,
          onClick: async () => {
            if (
              !(await confirmDialog({
                title: 'Usunąć szablon?',
                message: `„${t.title}” przestanie tworzyć nowe zadania. Dotychczasowe zadania zostają.`,
                confirmLabel: 'Usuń',
                danger: true,
              }))
            )
              return;
            await remove('task_templates', { id: eq(t.id) });
            m.close();
            toast('Szablon usunięty.', 'ok');
            onSaved();
          },
        })
      : null,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const n = validateText((title.input as HTMLInputElement).value, 'nazwę zadania', 1, 120);
      title.setError(n.ok ? null : n.error);
      daysErr.textContent = days.size ? '' : 'Zaznacz co najmniej jeden dzień.';
      if (!n.ok || !days.size) return;
      const row = {
        title: n.value,
        description: (desc.input as HTMLInputElement).value.trim() || null,
        days_of_week: [...days].sort(),
        active: (activeBox as HTMLInputElement).checked,
      };
      if (t) await update('task_templates', { id: eq(t.id) }, row);
      else await insert('task_templates', row);
      m.close();
      toast('Zapisano szablon.', 'ok');
      onSaved();
    });
  });
  m.el.querySelector('.modal-body')?.replaceChildren(form);
  title.input.focus();
}

// ------------------------------------------------------------------ ustawienia
export async function settingsPage(c: PageCtx): Promise<void> {
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
  const emailsInput = h(
    'textarea',
    { class: 'input', rows: 3, placeholder: 'wlasciciel@example.com' },
    (r.summary_emails ?? []).join('\n'),
  );
  const emails = field('Odbiorcy e-maila z listą zakupów', emailsInput, { hint: 'Jeden adres w linii (max 10).' });
  const save = button('Zapisz ustawienia', { type: 'submit', size: 'lg', block: true });
  const form = h('form', { class: 'form card', novalidate: true }, name.el, zone.el, time.el, emails.el, save);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const n = validateText((name.input as HTMLInputElement).value, 'nazwę lokalu', 1, 100);
      name.setError(n.ok ? null : n.error);
      const z = validateTimeZone((zone.input as HTMLInputElement).value.trim());
      zone.setError(z.ok ? null : z.error);
      const t = validateTime((time.input as HTMLInputElement).value);
      time.setError(t.ok ? null : t.error);
      const em = parseEmailList((emailsInput as HTMLTextAreaElement).value);
      emails.setError(em.ok ? null : em.error);
      if (!n.ok || !z.ok || !t.ok || !em.ok) return;
      await update(
        'restaurants',
        { id: eq(r.id) },
        { name: n.value, timezone: z.value, summary_time: `${t.value}:00`, summary_emails: em.value },
      );
      Object.assign(r, { name: n.value, timezone: z.value, summary_time: `${t.value}:00`, summary_emails: em.value });
      toast('Ustawienia zapisane.', 'ok');
    });
  });
  const test = button('Wyślij testowy e-mail', {
    variant: 'soft',
    icon: 'mail',
    block: true,
    onClick: async () => {
      const res = await callFunction<{ sent_to: number }>('daily-shopping-summary', { test: true });
      toast(`Wysłano wiadomość testową na ${res.sent_to} ${plural(res.sent_to, 'adres', 'adresy', 'adresów')}.`, 'ok');
    },
  });
  mount(
    c.el,
    h(
      'div',
      { class: 'page' },
      form,
      h(
        'div',
        { class: 'card form' },
        h('strong', null, 'Test wysyłki'),
        h('p', { class: 'muted small' }, 'Zapisz ustawienia, a potem wyślij wiadomość testową na podane adresy.'),
        test,
      ),
    ),
  );
}

// ------------------------------------------------------------------ historia zmian (audit log)
export async function auditPage(c: PageCtx): Promise<void> {
  c.setTitle('Historia zmian');
  const host = h('div', { class: 'page' }, skeleton(5));
  mount(c.el, host);
  let tableFilter = '';
  let actorFilter = '';
  let period: '1' | '7' | '30' = '7';
  let limit = 100;

  const catalog = await loadCatalog().catch(() => ({ products: [], categories: [] }));
  const prod = new Map(catalog.products.map((p) => [p.id, p]));
  const lookups = {
    productName: (id: string) => prod.get(id)?.name ?? 'produkt',
    productUnit: (id: string) => prod.get(id)?.unit ?? '',
    userName: (id: string) => nameOf(id),
  };
  const tableSel = selectInput(
    [{ value: '', label: 'Wszystko' }, ...AUDIT_TABLES.map((t) => ({ value: t.value, label: t.label }))],
    '',
  );
  const actors = [
    ...new Set([
      ...(await list<{ id: string; full_name: string }>('profiles', {
        select: 'id,full_name',
        order: 'full_name.asc',
      }).catch(() => [])),
    ]),
  ];
  const actorSel = selectInput(
    [{ value: '', label: 'Wszyscy' }, ...actors.map((a) => ({ value: a.id, label: a.full_name }))],
    '',
  );
  const periodSel = selectInput(
    [
      { value: '1', label: 'Ostatnie 24 godziny' },
      { value: '7', label: 'Ostatnie 7 dni' },
      { value: '30', label: 'Ostatnie 30 dni' },
    ],
    '7',
  );
  const listHost = h('div', null, skeleton(4));
  const apply = () => {
    tableFilter = (tableSel as HTMLSelectElement).value;
    actorFilter = (actorSel as HTMLSelectElement).value;
    period = (periodSel as HTMLSelectElement).value as typeof period;
    limit = 100;
    void load();
  };
  for (const s of [tableSel, actorSel, periodSel]) s.addEventListener('change', apply);

  mount(
    host,
    h(
      'div',
      { class: 'grid grid-3' },
      field('Co', tableSel).el,
      field('Kto', actorSel).el,
      field('Kiedy', periodSel).el,
    ),
    listHost,
  );

  async function load() {
    mount(listHost, skeleton(4));
    try {
      const since = new Date(Date.now() - Number(period) * 86400000).toISOString();
      const params: Record<string, string> = { created_at: gte(since) };
      if (tableFilter) params.table_name = eq(tableFilter);
      if (actorFilter) params.actor_id = eq(actorFilter);
      const rows = await list<AuditLog>('audit_logs', {
        select: 'id,actor_id,action,table_name,record_id,old_data,new_data,created_at',
        params,
        order: 'id.desc',
        limit,
        cache: false,
      });
      if (!c.isAlive()) return;
      mount(
        listHost,
        rows.length
          ? [
              h(
                'div',
                { class: 'card card-flush' },
                rows.map((a) =>
                  h(
                    'div',
                    { class: 'item' },
                    h(
                      'div',
                      { class: 'item-main' },
                      h('div', { class: 'item-title' }, describeAudit(a, lookups)),
                      h(
                        'div',
                        { class: 'item-sub' },
                        `${a.actor_id ? nameOf(a.actor_id) : 'System'} · ${formatDateTime(a.created_at, tz())}`,
                      ),
                    ),
                  ),
                ),
              ),
              rows.length >= limit
                ? h(
                    'div',
                    { style: 'margin-top:12px' },
                    button('Pokaż starsze', {
                      variant: 'soft',
                      block: true,
                      onClick: () => {
                        limit += 100;
                        return load();
                      },
                    }),
                  )
                : null,
            ]
          : emptyState('Brak zmian w wybranym okresie'),
      );
    } catch (e) {
      if (c.isAlive())
        mount(
          listHost,
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
}
