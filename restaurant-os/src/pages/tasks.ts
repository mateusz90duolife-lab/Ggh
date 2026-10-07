import { insert, remove } from '../api/db.js';
import { h, icon, mount } from '../dom.js';
import type { Child } from '../dom.js';
import { formatDate, formatTime } from '../lib/format.js';
import { validateText, validatePurchaseDate } from '../lib/validate.js';
import type { PageCtx } from '../router.js';
import { isManager, nameOf, today, tz } from '../state.js';
import { loadTodayTasks, pendingTaskIds, setTaskDone, TASK_COLUMNS } from '../data.js';
import type { Task } from '../types.js';
import {
  button,
  emptyState,
  errorState,
  fab,
  field,
  guarded,
  sectionHeader,
  skeleton,
  textInput,
} from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { errorMessage } from '../lib/errors.js';

export function taskRow(t: Task, opts: { pending: boolean; onToggle: () => void; onDelete?: () => void }): HTMLElement {
  const done = t.status === 'done';
  const sub = done ? `Zrobione: ${nameOf(t.done_by)}, ${formatTime(t.done_at, tz())}` : (t.description ?? '');
  const row = h(
    'div',
    {
      class: `task${done ? ' done' : ''}${opts.pending ? ' pending-sync' : ''}`,
      role: 'checkbox',
      'aria-checked': String(done),
      tabindex: '0',
    },
    h('div', { class: 'task-box' }, done ? icon('check', 18) : null),
    h(
      'div',
      { class: 'item-main' },
      h('div', { class: 'item-title' }, t.title),
      sub || opts.pending
        ? h('div', { class: 'item-sub' }, opts.pending ? `${sub ? sub + ' · ' : ''}oczekuje na wysłanie` : sub)
        : null,
    ),
    opts.onDelete
      ? h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            'aria-label': `Usuń zadanie: ${t.title}`,
            onclick: (e: Event) => {
              e.stopPropagation();
              opts.onDelete?.();
            },
          },
          icon('trash', 20),
        )
      : null,
  );
  row.addEventListener('click', opts.onToggle);
  row.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      opts.onToggle();
    }
  });
  return row;
}

/** Wspólna logika listy zadań dnia (ekran „Dzisiaj” i „Zadania”): optymistyczne odhaczanie + kolejka offline. */
export function createTaskBoard(opts: { limitUndone?: number; canDelete?: boolean; onChange?: () => void }) {
  let tasks: Task[] = [];
  let busy = 0;
  const el = h('div');

  function sorted(): Task[] {
    return [...tasks].sort((a, b) =>
      a.status === b.status ? a.created_at.localeCompare(b.created_at) : a.status === 'todo' ? -1 : 1,
    );
  }

  function render() {
    const pend = pendingTaskIds();
    const all = sorted();
    const todo = all.filter((t) => t.status === 'todo');
    const done = all.filter((t) => t.status === 'done');
    const rows = (list: Task[]) =>
      list.map((t) =>
        taskRow(t, {
          pending: pend.has(t.id),
          onToggle: () => void toggle(t),
          onDelete: opts.canDelete ? () => void del(t) : undefined,
        }),
      );
    const parts: Child[] = [];
    if (tasks.length === 0)
      parts.push(emptyState('Brak zadań na dziś', 'Gdy ktoś doda zadanie lub zadziała szablon, pojawi się tutaj.'));
    else {
      const shownTodo = opts.limitUndone ? todo.slice(0, opts.limitUndone) : todo;
      if (todo.length) {
        parts.push(h('div', { class: 'card card-flush' }, rows(shownTodo)));
        if (opts.limitUndone && todo.length > shownTodo.length) {
          parts.push(
            h(
              'a',
              { href: '#/zadania', class: 'muted small', style: 'text-align:center;padding:8px' },
              `Zobacz wszystkie zadania (${todo.length})`,
            ),
          );
        }
      } else parts.push(h('div', { class: 'notice notice-ok' }, 'Wszystkie zadania na dziś wykonane. Dobra robota!'));
      if (done.length && !opts.limitUndone)
        parts.push(sectionHeader('Zrobione'), h('div', { class: 'card card-flush' }, rows(done)));
    }
    mount(el, parts);
    opts.onChange?.();
  }

  async function toggle(t: Task) {
    const wanted: 'done' | 'todo' = t.status === 'done' ? 'todo' : 'done';
    const before = { ...t };
    t.status = wanted;
    t.done_at = wanted === 'done' ? new Date().toISOString() : null;
    t.done_by = wanted === 'done' ? (before.done_by ?? null) : null;
    render();
    busy++;
    try {
      const updated = await setTaskDone(before, wanted === 'done');
      if (updated) Object.assign(t, updated);
      else toast('Brak internetu — zapisano na telefonie, wyślemy automatycznie.', 'info');
    } catch (e) {
      Object.assign(t, before);
      toast(errorMessage(e), 'error');
    } finally {
      busy--;
      render();
    }
  }

  async function del(t: Task) {
    if (
      !(await confirmDialog({
        title: 'Usunąć zadanie?',
        message: `„${t.title}” zostanie usunięte.`,
        confirmLabel: 'Usuń',
        danger: true,
      }))
    )
      return;
    try {
      await remove('tasks', { id: `eq.${t.id}` });
      tasks = tasks.filter((x) => x.id !== t.id);
      render();
      toast('Zadanie usunięte.', 'ok');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return {
    el,
    get tasks() {
      return tasks;
    },
    set(next: Task[]) {
      tasks = next;
      render();
    },
    /** Odświeżenie z serwera bez przerywania trwającego odhaczania. */
    async reload(date: string) {
      if (busy > 0) return;
      const fresh = await loadTodayTasks(date);
      if (busy > 0) return;
      tasks = fresh;
      render();
    },
    render,
  };
}

export function progressCard(done: number, total: number): HTMLElement {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'section-head', style: 'margin:0 0 10px' },
      h('h2', null, 'Zadania na dziś'),
      h('strong', { id: 'task-progress-text' }, `${done}/${total}`),
    ),
    h(
      'div',
      {
        class: 'progress',
        role: 'progressbar',
        'aria-valuenow': String(pct),
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      },
      h('div', { style: `width:${pct}%` }),
    ),
  );
}

export async function tasksPage(c: PageCtx): Promise<void> {
  c.setTitle('Zadania');
  const date = today();
  const progressHost = h('div');
  const board = createTaskBoard({
    canDelete: isManager(),
    onChange: () =>
      mount(progressHost, progressCard(board.tasks.filter((t) => t.status === 'done').length, board.tasks.length)),
  });
  const head = h(
    'div',
    { class: 'section-head', style: 'margin:0' },
    h('p', { class: 'muted' }, formatDate(date)),
    isManager()
      ? button('Zadanie', {
          icon: 'plus',
          size: 'sm',
          variant: 'soft',
          onClick: () => openNewTask(date, () => void load()),
        })
      : null,
  );
  mount(c.el, h('div', { class: 'page' }, head, progressHost, board.el), fab('ZGŁOŚ BRAK', '#/braki/nowy'));
  mount(board.el, skeleton(4));

  async function load() {
    try {
      board.set(await loadTodayTasks(date));
    } catch (e) {
      if (c.isAlive())
        mount(
          board.el,
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
  c.poll(() => board.reload(date), 8000);
}

export function openNewTask(defaultDate: string, onSaved: () => void): void {
  const title = field('Co trzeba zrobić?', textInput({ maxLength: 120, required: true, placeholder: 'np. Umyć okap' }));
  const desc = field('Opis (opcjonalnie)', textInput({ maxLength: 500 }));
  const dueInput = textInput({ type: 'date', value: defaultDate });
  const due = field('Termin', dueInput);
  const m = openModal({ title: 'Nowe zadanie', body: null });
  const save = button('Dodaj zadanie', {
    type: 'submit',
    size: 'lg',
    block: true,
  });
  const form = h('form', { class: 'form', novalidate: true }, title.el, desc.el, due.el, save);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const t = validateText((title.input as HTMLInputElement).value, 'tytuł zadania', 1, 120);
      title.setError(t.ok ? null : t.error);
      const d = validatePurchaseDate(dueInput.value, today());
      due.setError(d.ok ? null : d.error);
      const dsc = (desc.input as HTMLInputElement).value.trim();
      if (!t.ok || !d.ok) return;
      await insert('tasks', { title: t.value, description: dsc || null, due_date: d.value });
      m.close();
      toast('Dodano zadanie.', 'ok');
      onSaved();
    });
  });
  m.el.querySelector('.modal-body')?.replaceChildren(form);
  title.input.focus();
}

export { TASK_COLUMNS };
