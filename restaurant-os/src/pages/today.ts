import { h, icon, mount } from '../dom.js';
import { errorMessage } from '../lib/errors.js';
import { formatLongDate, relativeTime } from '../lib/format.js';
import type { PageCtx } from '../router.js';
import { loadCatalog, nameOf, profile, today, tz } from '../state.js';
import { loadOpenShortages, loadTodayTasks } from '../data.js';
import { createTaskBoard, progressCard, visibleTask } from './tasks.js';
import { button, emptyState, errorState, qtyText, sectionHeader, skeleton } from '../ui/components.js';
import type { Product, Shortage } from '../types.js';

export function shortageItem(s: Shortage, names: Map<string, string>): HTMLElement {
  return h(
    'div',
    { class: 'item' },
    h(
      'div',
      { class: 'item-main' },
      h('div', { class: 'item-title' }, names.get(s.product_id) ?? 'Produkt'),
      h(
        'div',
        { class: 'item-sub' },
        `${nameOf(s.reported_by)} · ${relativeTime(s.created_at, new Date(), tz())}${s.note ? ` · ${s.note}` : ''}`,
      ),
    ),
    s.urgent ? h('span', { class: 'badge badge-urgent' }, icon('alert', 14), 'PILNE') : null,
    h('div', { class: 'item-end' }, qtyText(s.quantity, s.unit)),
  );
}

export async function todayPage(c: PageCtx): Promise<void> {
  c.setTitle('Dzisiaj');
  const date = today();
  const first = (profile()?.full_name ?? '').split(' ')[0] ?? '';
  const progressHost = h('div');
  const board = createTaskBoard({
    limitUndone: 3,
    filter: visibleTask,
    onChange: () =>
      mount(progressHost, progressCard(board.tasks.filter((t) => t.status === 'done').length, board.tasks.length)),
  });
  const shortagesHost = h('div', null, skeleton(2));
  mount(
    c.el,
    h(
      'div',
      { class: 'page' },
      h(
        'div',
        null,
        h('h2', { style: 'font-size:22px;font-weight:800' }, `Cześć, ${first}!`),
        h('p', { class: 'muted' }, formatLongDate(date)),
      ),
      h(
        'a',
        { class: 'btn btn-danger btn-lg btn-block', href: '#/braki/nowy' },
        icon('plus', 24),
        h('span', null, 'ZGŁOŚ BRAK'),
      ),
      h(
        'div',
        { class: 'row-actions' },
        h(
          'a',
          { class: 'btn btn-soft', href: '#/produkty' },
          icon('box', 20),
          h('span', null, 'Produkty: dodaj / odejmij / zamów'),
        ),
        h('a', { class: 'btn btn-soft', href: '#/godziny' }, icon('clock', 20), h('span', null, 'Moje godziny')),
      ),
      progressHost,
      board.el,
      sectionHeader('Ostatnio zgłoszone braki', h('a', { href: '#/braki', class: 'muted small' }, 'Wszystkie')),
      shortagesHost,
    ),
  );
  mount(board.el, skeleton(3));

  async function loadShortages() {
    let products: Product[] = [];
    try {
      products = (await loadCatalog()).products;
    } catch {
      /* nazwy z cache lub „Produkt” */
    }
    const names = new Map(products.map((p) => [p.id, p.name]));
    const rows = (await loadOpenShortages(5)).slice(0, 5);
    if (!c.isAlive()) return;
    mount(
      shortagesHost,
      rows.length
        ? h(
            'div',
            { class: 'card card-flush' },
            rows.map((s) => shortageItem(s, names)),
          )
        : emptyState(
            'Brak otwartych braków',
            'Zgłoś brak, gdy czegoś zabraknie.',
            button('Zgłoś brak', { variant: 'soft', onClick: () => void (location.hash = '#/braki/nowy') }),
          ),
    );
  }

  const results = await Promise.allSettled([loadTodayTasks(date).then((t) => board.set(t)), loadShortages()]);
  const failed = results.find((r) => r.status === 'rejected');
  if (failed && failed.status === 'rejected' && c.isAlive()) {
    if (board.tasks.length === 0)
      mount(
        board.el,
        errorState(errorMessage(failed.reason), () => c.refresh()),
      );
  }
  c.poll(() => board.reload(date), 8000);
}
