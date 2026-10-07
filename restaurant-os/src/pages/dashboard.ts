import { list, rpc, gte } from '../api/db.js';
import { h, mount } from '../dom.js';
import { errorMessage } from '../lib/errors.js';
import { formatLongDate, formatPLN, plural, relativeTime } from '../lib/format.js';
import type { PageCtx } from '../router.js';
import { isOwner, profile, tz } from '../state.js';
import type { DashboardSummary, Notification } from '../types.js';
import { errorState, sectionHeader, skeleton, statCard, emptyState } from '../ui/components.js';

export async function dashboardPage(c: PageCtx): Promise<void> {
  c.setTitle('Dashboard');
  const host = h('div', { class: 'page' }, skeleton(5));
  mount(c.el, host);
  const first = (profile()?.full_name ?? '').split(' ')[0] ?? '';

  async function load() {
    try {
      const [s, notes, rises] = await Promise.all([
        rpc<DashboardSummary>('dashboard_summary'),
        list<Notification>('notifications', {
          select: 'id,type,title,body,read_at,created_at',
          order: 'created_at.desc',
          limit: 5,
        }),
        isOwner()
          ? list<{ product_id: string; change_pct: number | string }>('price_trend', {
              select: 'product_id,change_pct',
              params: { change_pct: gte(10) },
              limit: 50,
            })
          : Promise.resolve([]),
      ]);
      if (!c.isAlive()) return;
      const problems = Number(s.low_stock) + Number(s.out_of_stock);
      const cards = [
        statCard({
          icon: 'box',
          label: 'Magazyn',
          value: problems ? `${problems} ${plural(problems, 'produkt', 'produkty', 'produktów')}` : 'Wszystko OK',
          sub: problems
            ? `poniżej minimum${s.out_of_stock ? ` (w tym ${s.out_of_stock} bez stanu)` : ''}`
            : 'brak produktów poniżej minimum',
          tone: s.out_of_stock ? 'danger' : problems ? 'warn' : 'ok',
          href: '#/magazyn?filtr=braki',
        }),
        statCard({
          icon: 'cart',
          label: 'Lista zakupów',
          value: `${s.shopping_items} ${plural(Number(s.shopping_items), 'pozycja', 'pozycje', 'pozycji')}`,
          sub: 'do kupienia',
          tone: 'neutral',
          href: '#/zakupy',
        }),
        isOwner()
          ? statCard({
              icon: 'tag',
              label: 'Zakupy dzisiaj',
              value: formatPLN(s.purchases_today_gross ?? 0),
              sub: 'brutto, zatwierdzone',
              tone: 'neutral',
              href: '#/zakupy?tab=historia',
            })
          : null,
        isOwner()
          ? statCard({
              icon: 'alert',
              label: 'Wzrost cen',
              value: `${rises.length} ${plural(rises.length, 'produkt', 'produkty', 'produktów')}`,
              sub: 'podrożało o 10% lub więcej',
              tone: rises.length ? 'warn' : 'ok',
              href: '#/magazyn',
            })
          : null,
        statCard({
          icon: 'check',
          label: 'Zadania',
          value: `${s.tasks_done} / ${s.tasks_total}`,
          sub: 'wykonane dzisiaj',
          tone: Number(s.tasks_total) > 0 && s.tasks_done === s.tasks_total ? 'ok' : 'neutral',
          href: '#/zadania',
        }),
        statCard({
          icon: 'alert',
          label: 'Pilne braki',
          value: String(s.urgent_items),
          sub: s.urgent_items ? 'wymaga szybkiego zakupu' : 'brak pilnych zgłoszeń',
          tone: Number(s.urgent_items) ? 'danger' : 'ok',
          href: '#/zakupy',
        }),
      ];
      mount(
        host,
        h(
          'div',
          null,
          h('h2', { style: 'font-size:22px;font-weight:800' }, `Cześć, ${first}!`),
          h('p', { class: 'muted' }, formatLongDate(s.today)),
        ),
        h('div', { class: 'grid grid-auto' }, cards),
        sectionHeader(
          `Powiadomienia${Number(s.unread_notifications) ? ` (${s.unread_notifications} nowe)` : ''}`,
          h('a', { href: '#/powiadomienia', class: 'muted small' }, 'Wszystkie'),
        ),
        notes.length
          ? h(
              'div',
              { class: 'card card-flush' },
              notes.map((n) =>
                h(
                  'div',
                  { class: 'item' },
                  h(
                    'div',
                    { class: 'item-main' },
                    h('div', { class: 'item-title' }, n.read_at ? n.title : `● ${n.title}`),
                    h(
                      'div',
                      { class: 'item-sub' },
                      `${n.body ?? ''} · ${relativeTime(n.created_at, new Date(), tz())}`,
                    ),
                  ),
                ),
              ),
            )
          : emptyState('Brak powiadomień'),
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
  c.poll(load, 15000);
}
