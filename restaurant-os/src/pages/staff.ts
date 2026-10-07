import { eq, gte, list, remove, rpc } from '../api/db.js';
import { h, icon, mount } from '../dom.js';
import type { Child } from '../dom.js';
import { productIcon } from '../lib/catalog.js';
import { errorMessage } from '../lib/errors.js';
import { formatDate, formatLongDate, relativeTime } from '../lib/format.js';
import {
  formatDuration,
  localTime,
  localToIso,
  periodRange,
  shiftDate,
  shiftMinutes,
  sumMinutes,
  type Period,
} from '../lib/hours.js';
import type { PageCtx } from '../router.js';
import { isManager, isOwner, loadCatalog, nameOf, profile, reloadTeam, team, today, tz } from '../state.js';
import type { TeamMember } from '../state.js';
import type { Shortage, StockMove, Task, WorkShift } from '../types.js';
import { ROLE_LABEL } from '../layout.js';
import {
  backLink,
  button,
  chip,
  emptyState,
  errorState,
  field,
  guarded,
  qtyText,
  sectionHeader,
  skeleton,
  tabs,
  textInput,
} from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { openNewTask } from './tasks.js';

const SHIFT_COLS = 'id,profile_id,started_at,ended_at,note,source';
const HISTORY_DAYS = 70;

function since(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function loadShifts(profileId?: string): Promise<WorkShift[]> {
  return list<WorkShift>('work_shifts', {
    select: SHIFT_COLS,
    params: { started_at: gte(since(HISTORY_DAYS)), ...(profileId ? { profile_id: eq(profileId) } : {}) },
    order: 'started_at.desc',
    limit: 1000,
  });
}

function canDelete(s: WorkShift): boolean {
  if (isManager()) return true;
  return s.profile_id === profile()?.id && Date.now() - new Date(s.started_at).getTime() < 2 * 86400000;
}

/** Lista zmian pogrupowana po dniach, z sumą dnia. */
function shiftList(shifts: WorkShift[], onChange: () => void, showWho = false): HTMLElement {
  if (!shifts.length)
    return emptyState('Brak wpisów', 'Godziny pojawią się tu po rozpoczęciu pracy albo ręcznym wpisie.');
  const zone = tz();
  const byDay = new Map<string, WorkShift[]>();
  for (const s of shifts) byDay.set(shiftDate(s, zone), [...(byDay.get(shiftDate(s, zone)) ?? []), s]);
  const parts: Child[] = [];
  for (const [day, rows] of byDay) {
    const total = rows.reduce((a, s) => a + shiftMinutes(s), 0);
    parts.push(
      h(
        'div',
        { class: 'group-title', style: 'display:flex;justify-content:space-between' },
        h('span', null, formatLongDate(day)),
        h('span', null, formatDuration(total)),
      ),
      ...rows.map((s) =>
        h(
          'div',
          { class: 'item' },
          h(
            'div',
            { class: 'item-main' },
            h(
              'div',
              { class: 'item-title' },
              `${localTime(s.started_at, zone)} – ${s.ended_at ? localTime(s.ended_at, zone) : 'trwa'}`,
              s.ended_at ? null : h('span', { class: 'badge badge-ok', style: 'margin-left:8px' }, 'w pracy'),
            ),
            h(
              'div',
              { class: 'item-sub' },
              [showWho ? nameOf(s.profile_id) : '', s.source === 'manual' ? 'wpis ręczny' : '', s.note ?? '']
                .filter(Boolean)
                .join(' · '),
            ),
          ),
          h('div', { class: 'item-end' }, formatDuration(shiftMinutes(s))),
          canDelete(s)
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'icon-btn',
                  'aria-label': `Usuń wpis ${localTime(s.started_at, zone)}`,
                  onclick: async () => {
                    if (
                      !(await confirmDialog({
                        title: 'Usunąć wpis godzin?',
                        message: `${formatDate(day)}, ${localTime(s.started_at, zone)} – ${s.ended_at ? localTime(s.ended_at, zone) : 'trwa'}`,
                        confirmLabel: 'Usuń',
                        danger: true,
                      }))
                    )
                      return;
                    try {
                      await remove('work_shifts', { id: eq(s.id) });
                      toast('Wpis usunięty.', 'ok');
                      onChange();
                    } catch (e) {
                      toast(errorMessage(e), 'error');
                    }
                  },
                },
                icon('trash', 20),
              )
            : null,
        ),
      ),
    );
  }
  return h('div', { class: 'card card-flush' }, parts);
}

function totals(shifts: WorkShift[]): HTMLElement {
  const zone = tz();
  const t = today();
  const box = (label: string, period: Period) =>
    h('div', null, h('strong', null, formatDuration(sumMinutes(shifts, periodRange(period, t), zone))), label);
  return h(
    'div',
    { class: 'hours-total' },
    box('ten tydzień', 'week'),
    box('ten miesiąc', 'month'),
    box('poprzedni miesiąc', 'prev_month'),
  );
}

/** Ręczny wpis godzin (pracownik — dla siebie; manager — także dla innych). */
export function openAddShift(onSaved: () => void, forProfile?: TeamMember): void {
  const dateIn = textInput({ type: 'date', value: today() });
  const fromIn = textInput({ type: 'time', value: '08:00' });
  const toIn = textInput({ type: 'time', value: '16:00' });
  const noteIn = textInput({ maxLength: 200, placeholder: 'np. zmiana poranna' });
  const m = openModal({ title: forProfile ? `Godziny: ${forProfile.full_name}` : 'Dodaj godziny', body: null });
  const save = button('Zapisz godziny', { type: 'submit', size: 'lg', block: true });
  const date = field('Dzień', dateIn);
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    date.el,
    h('div', { class: 'form-row' }, field('Od', fromIn).el, field('Do', toIn).el),
    h(
      'p',
      { class: 'muted small', style: 'margin:0' },
      'Jeśli „Do” jest wcześniej niż „Od”, liczymy zmianę do następnego dnia.',
    ),
    field('Uwaga (opcjonalnie)', noteIn).el,
    save,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const d = (dateIn as HTMLInputElement).value;
      const f = (fromIn as HTMLInputElement).value;
      const t = (toIn as HTMLInputElement).value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        date.setError('Podaj dzień.');
        return;
      }
      if (!/^\d{2}:\d{2}$/.test(f) || !/^\d{2}:\d{2}$/.test(t)) {
        toast('Podaj godziny od i do.', 'error');
        return;
      }
      const start = localToIso(d, f, tz());
      let end = localToIso(d, t, tz());
      if (end <= start) end = new Date(new Date(end).getTime() + 86400000).toISOString();
      await rpc('add_shift', {
        p_started_at: start,
        p_ended_at: end,
        p_note: (noteIn as HTMLInputElement).value.trim() || null,
        p_profile_id: forProfile?.id ?? null,
      });
      m.close();
      toast(`Zapisano: ${formatDuration((new Date(end).getTime() - new Date(start).getTime()) / 60000)}`, 'ok');
      onSaved();
    });
  });
  m.el.querySelector('.modal-body')?.replaceChildren(form);
}

// ------------------------------------------------------------------ moje godziny
export async function hoursPage(c: PageCtx): Promise<void> {
  c.setTitle('Godziny pracy');
  const host = h('div', { class: 'page' }, skeleton(4));
  mount(c.el, host);
  const clockHost = h('div');
  const listHost = h('div');
  const totalsHost = h('div');
  let shifts: WorkShift[] = [];

  function drawClock() {
    const open = shifts.find((s) => !s.ended_at);
    const zone = tz();
    mount(
      clockHost,
      h(
        'div',
        { class: 'card clock-card' },
        open
          ? [
              h(
                'div',
                { class: 'muted' },
                h('span', { class: 'status-dot' }),
                `Pracujesz od ${localTime(open.started_at, zone)}`,
              ),
              h('div', { class: 'clock-time', 'aria-live': 'off' }, formatDuration(shiftMinutes(open))),
              button('Kończę pracę', {
                size: 'lg',
                block: true,
                variant: 'danger',
                icon: 'clock',
                onClick: async () => {
                  const s = await rpc<WorkShift>('clock_out');
                  toast(`Koniec pracy. Dziś: ${formatDuration(shiftMinutes(s))}.`, 'ok');
                  await load();
                },
              }),
            ]
          : [
              h('div', { class: 'muted' }, 'Nie jesteś teraz w pracy.'),
              button('Zaczynam pracę', {
                size: 'lg',
                block: true,
                icon: 'clock',
                onClick: async () => {
                  await rpc('clock_in');
                  toast('Rozpoczęto pracę. Miłej zmiany!', 'ok');
                  await load();
                },
              }),
            ],
        button('Dodaj godziny ręcznie', {
          variant: 'ghost',
          icon: 'plus',
          onClick: () => openAddShift(() => void load()),
        }),
      ),
    );
  }

  async function load() {
    try {
      const me = profile()?.id;
      shifts = await loadShifts(me);
      if (!c.isAlive()) return;
      if (!host.contains(clockHost)) mount(host, clockHost, totalsHost, sectionHeader('Moje godziny'), listHost);
      drawClock();
      mount(totalsHost, totals(shifts));
      mount(
        listHost,
        shiftList(shifts, () => void load()),
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
  // licznik trwającej zmiany (co minutę), bez zapytań do serwera
  c.poll(async () => {
    if (shifts.some((s) => !s.ended_at)) {
      drawClock();
      mount(totalsHost, totals(shifts));
    }
  }, 60000);
}

// ------------------------------------------------------------------ zespół (szef)
export async function teamPage(c: PageCtx): Promise<void> {
  c.setTitle('Zespół');
  const host = h('div', { class: 'page' }, skeleton(5));
  mount(c.el, host);

  async function load() {
    try {
      const [people, shifts, shortages] = await Promise.all([
        reloadTeam(),
        loadShifts(),
        list<Shortage>('shortages', {
          select: 'id,reported_by,created_at',
          params: { created_at: gte(since(31)) },
          limit: 2000,
        }),
      ]);
      if (!c.isAlive()) return;
      const zone = tz();
      const t = today();
      const week = periodRange('week', t);
      const month = periodRange('month', t);
      const active = people.filter((p) => p.active);
      mount(
        host,
        h(
          'p',
          { class: 'muted', style: 'margin:0' },
          'Kto jest w pracy, ile godzin przepracował i co zamawiał. Dotknij osoby, aby przydzielić zadanie lub poprawić godziny.',
        ),
        h(
          'div',
          { class: 'card card-flush' },
          active.map((p) => {
            const mine = shifts.filter((s) => s.profile_id === p.id);
            const open = mine.find((s) => !s.ended_at);
            const orders = shortages.filter((s) => s.reported_by === p.id).length;
            return h(
              'a',
              { class: 'item', href: `#/zespol/${p.id}` },
              h(
                'div',
                { class: 'item-main' },
                h(
                  'div',
                  { class: 'item-title' },
                  open ? h('span', { class: 'status-dot', 'aria-hidden': 'true' }) : null,
                  p.full_name,
                ),
                h(
                  'div',
                  { class: 'item-sub' },
                  [
                    open ? `w pracy od ${localTime(open.started_at, zone)}` : '',
                    `tydzień: ${formatDuration(sumMinutes(mine, week, zone))}`,
                    `miesiąc: ${formatDuration(sumMinutes(mine, month, zone))}`,
                    `zamówienia (30 dni): ${orders}`,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                ),
              ),
              h('span', { class: 'badge badge-neutral' }, ROLE_LABEL[p.role]),
              icon('chevron', 18),
            );
          }),
        ),
        isOwner()
          ? h(
              'a',
              { class: 'btn btn-soft', href: '#/pracownicy' },
              icon('user', 20),
              h('span', null, 'Konta pracowników (nick i PIN)'),
            )
          : null,
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
  c.poll(load, 30000);
}

const SHORTAGE_STATUS: Record<Shortage['status'], [string, string]> = {
  open: ['otwarte', 'badge-low'],
  resolved: ['kupione', 'badge-ok'],
  cancelled: ['anulowane', 'badge-neutral'],
};

export async function memberPage(c: PageCtx): Promise<void> {
  const id = c.params.id ?? '';
  c.setTitle('Pracownik');
  const host = h('div', { class: 'page' }, backLink('#/zespol', 'Zespół'), skeleton(4));
  mount(c.el, host);
  let tab = c.query.get('tab') ?? 'godziny';
  let period: Period = 'week';

  async function load() {
    try {
      const people = team().length ? team() : await reloadTeam();
      const p = people.find((x) => x.id === id);
      if (!p) {
        mount(host, backLink('#/zespol', 'Zespół'), emptyState('Nie znaleziono pracownika'));
        return;
      }
      c.setTitle(p.full_name);
      const zone = tz();
      const [shifts, shortages, moves, tasks, cat] = await Promise.all([
        loadShifts(p.id),
        list<Shortage>('shortages', {
          select: 'id,product_id,quantity,unit,urgent,note,status,reported_by,created_at',
          params: { reported_by: eq(p.id) },
          order: 'created_at.desc',
          limit: 50,
        }),
        list<StockMove>('inventory_movements', {
          select: 'id,product_id,type,quantity_delta,note,created_by,created_at',
          params: { created_by: eq(p.id) },
          order: 'created_at.desc',
          limit: 50,
        }),
        list<Task>('tasks', {
          select: 'id,title,description,due_date,status,assigned_to,done_by,done_at,template_id,created_at',
          params: { assigned_to: eq(p.id) },
          order: 'due_date.desc,created_at.desc',
          limit: 40,
        }),
        loadCatalog(),
      ]);
      if (!c.isAlive()) return;
      const products = new Map(cat.products.map((x) => [x.id, x]));
      const open = shifts.find((s) => !s.ended_at);

      const body = h('div', { class: 'page', style: 'padding:0' });
      const draw = () => {
        if (tab === 'godziny') {
          const range = periodRange(period, today());
          const inRange = shifts.filter((s) => {
            const d = shiftDate(s, zone);
            return d >= range.from && d < range.to;
          });
          mount(
            body,
            h(
              'div',
              { class: 'chips' },
              (['week', 'month', 'prev_month'] as Period[]).map((pp) =>
                chip(periodRange(pp, today()).label, {
                  active: pp === period,
                  onClick: () => {
                    period = pp;
                    draw();
                  },
                }),
              ),
            ),
            h(
              'div',
              { class: 'total' },
              h('span', null, `Razem (${range.label.toLowerCase()})`),
              h('span', null, formatDuration(sumMinutes(inRange, range, zone))),
            ),
            shiftList(inRange, () => void load()),
          );
        } else if (tab === 'zamowienia') {
          mount(
            body,
            shortages.length
              ? h(
                  'div',
                  { class: 'card card-flush' },
                  shortages.map((s) => {
                    const pr = products.get(s.product_id);
                    const [label, cls] = SHORTAGE_STATUS[s.status];
                    return h(
                      'div',
                      { class: 'item' },
                      h('span', { class: 'prod-icon', 'aria-hidden': 'true' }, pr ? productIcon(pr) : '📦'),
                      h(
                        'div',
                        { class: 'item-main' },
                        h('div', { class: 'item-title' }, pr?.name ?? 'Produkt'),
                        h(
                          'div',
                          { class: 'item-sub' },
                          `${relativeTime(s.created_at, new Date(), zone)}${s.urgent ? ' · PILNE' : ''}${s.note ? ` · ${s.note}` : ''}`,
                        ),
                      ),
                      h('span', { class: `badge ${cls}` }, label),
                      h('div', { class: 'item-end' }, qtyText(s.quantity, s.unit)),
                    );
                  }),
                )
              : emptyState('Brak zamówień', 'Tu pojawią się produkty, które ta osoba dopisała do listy potrzebnych.'),
          );
        } else if (tab === 'stan') {
          mount(
            body,
            moves.length
              ? h(
                  'div',
                  { class: 'card card-flush' },
                  moves.map((m) => {
                    const pr = products.get(m.product_id);
                    const d = Number(m.quantity_delta);
                    return h(
                      'div',
                      { class: 'item' },
                      h('span', { class: 'prod-icon', 'aria-hidden': 'true' }, pr ? productIcon(pr) : '📦'),
                      h(
                        'div',
                        { class: 'item-main' },
                        h('div', { class: 'item-title' }, pr?.name ?? 'Produkt'),
                        h(
                          'div',
                          { class: 'item-sub' },
                          `${relativeTime(m.created_at, new Date(), zone)}${m.note ? ` · ${m.note}` : ''}`,
                        ),
                      ),
                      h(
                        'div',
                        { class: `item-end ${d > 0 ? 'pos' : 'neg'}` },
                        `${d > 0 ? '+' : '−'}${qtyText(Math.abs(d), pr?.unit ?? '')}`,
                      ),
                    );
                  }),
                )
              : emptyState('Brak zmian stanu', 'Tu pojawi się, co ta osoba dodała lub odjęła z magazynu.'),
          );
        } else {
          mount(
            body,
            h(
              'div',
              { class: 'row-actions' },
              button('Przydziel zadanie', {
                icon: 'plus',
                onClick: () => openNewTask(today(), () => void load(), { assignee: p.id }),
              }),
            ),
            tasks.length
              ? h(
                  'div',
                  { class: 'card card-flush' },
                  tasks.map((t) =>
                    h(
                      'div',
                      { class: 'item' },
                      h(
                        'div',
                        { class: 'item-main' },
                        h('div', { class: 'item-title' }, t.title),
                        h(
                          'div',
                          { class: 'item-sub' },
                          `termin: ${formatDate(t.due_date)}${t.status === 'done' && t.done_at ? ` · zrobione ${relativeTime(t.done_at, new Date(), zone)}` : ''}`,
                        ),
                      ),
                      h(
                        'span',
                        { class: `badge ${t.status === 'done' ? 'badge-ok' : 'badge-low'}` },
                        t.status === 'done' ? 'zrobione' : 'do zrobienia',
                      ),
                    ),
                  ),
                )
              : emptyState('Brak przydzielonych zadań', 'Przydziel pierwsze zadanie przyciskiem powyżej.'),
          );
        }
      };

      mount(
        host,
        backLink('#/zespol', 'Zespół'),
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'item-title', style: 'font-size:20px' }, p.full_name),
          h(
            'div',
            { class: 'item-sub' },
            [
              ROLE_LABEL[p.role],
              p.nick ? `nick: ${p.nick}` : '',
              open ? `w pracy od ${localTime(open.started_at, zone)}` : 'poza pracą',
            ]
              .filter(Boolean)
              .join(' · '),
          ),
          totals(shifts),
          h(
            'div',
            { class: 'row-actions' },
            button('Przydziel zadanie', {
              icon: 'plus',
              size: 'sm',
              onClick: () => openNewTask(today(), () => void load(), { assignee: p.id }),
            }),
            button('Dodaj godziny', {
              icon: 'clock',
              size: 'sm',
              variant: 'soft',
              onClick: () => openAddShift(() => void load(), p),
            }),
          ),
        ),
        tabs(
          [
            { id: 'godziny', label: 'Godziny' },
            { id: 'zamowienia', label: `Zamówienia (${shortages.length})` },
            { id: 'stan', label: 'Stan' },
            { id: 'zadania', label: 'Zadania' },
          ],
          tab,
          (next) => {
            tab = next;
            void load();
          },
        ),
        body,
      );
      draw();
    } catch (e) {
      if (c.isAlive())
        mount(
          host,
          backLink('#/zespol', 'Zespół'),
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
}
