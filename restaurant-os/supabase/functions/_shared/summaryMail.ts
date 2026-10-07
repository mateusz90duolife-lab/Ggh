// Budowanie treści e-maila z listą zakupów (czysta funkcja — łatwa do testów).

export interface ShoppingRow {
  product_name: string;
  category_name: string;
  category_order: number | null;
  unit: string;
  total_quantity: number | string;
  urgent: boolean;
  reports_count: number;
}

const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  l: 'L',
  ml: 'ml',
  szt: 'szt.',
  opak: 'opak.',
  but: 'but.',
};

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}

/** 10 → „10”, 2.5 → „2,5”, 0.125 → „0,125”. */
export function formatQty(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '?';
  return String(Math.round(n * 1000) / 1000).replace('.', ',');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** „2026-10-08” → „08.10.2026”. */
export function formatDatePl(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Dodaje dni do daty ISO (YYYY-MM-DD) bez udziału stref czasu. */
export function addDays(iso: string, days: number): string {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, mo - 1, d + days));
  return t.toISOString().slice(0, 10);
}

interface Group {
  name: string;
  order: number;
  items: ShoppingRow[];
}

function groupByCategory(rows: ShoppingRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const g = map.get(r.category_name) ?? {
      name: r.category_name,
      order: r.category_order ?? Number.MAX_SAFE_INTEGER,
      items: [],
    };
    g.items.push(r);
    map.set(r.category_name, g);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pl'));
  for (const g of groups) g.items.sort((a, b) => a.product_name.localeCompare(b.product_name, 'pl'));
  return groups;
}

export interface SummaryInput {
  rows: ShoppingRow[];
  /** Data, na którą jest lista (YYYY-MM-DD). */
  forDate: string;
  restaurantName: string;
  /** true = „na jutro”, false = „aktualna lista” (wysyłka ręczna). */
  forTomorrow: boolean;
}

export interface BuiltMail {
  subject: string;
  html: string;
  text: string;
}

const line = (r: ShoppingRow) => `${r.product_name} — ${formatQty(r.total_quantity)} ${unitLabel(r.unit)}`;

export function buildSummary(input: SummaryInput): BuiltMail {
  const date = formatDatePl(input.forDate);
  const subject = `Lista zakupów restauracji — ${date}`;
  const intro = input.forTomorrow
    ? `poniżej lista zakupów na jutro (${date}):`
    : `poniżej aktualna lista zakupów (${date}):`;

  const urgent = input.rows.filter((r) => r.urgent);
  const normal = input.rows.filter((r) => !r.urgent);
  const sections: { title: string; items: ShoppingRow[]; urgent: boolean }[] = [];
  if (urgent.length) {
    sections.push({
      title: 'PILNE',
      items: [...urgent].sort((a, b) => a.product_name.localeCompare(b.product_name, 'pl')),
      urgent: true,
    });
  }
  for (const g of groupByCategory(normal))
    sections.push({ title: g.name.toUpperCase(), items: g.items, urgent: false });

  const text = [
    'Dzień dobry,',
    '',
    intro,
    '',
    ...(sections.length
      ? sections.flatMap((s) => [s.title, ...s.items.map((r) => `• ${line(r)}`), ''])
      : ['(lista jest pusta)', '']),
    'Pozdrawiam',
    'System magazynowy',
  ].join('\n');

  const htmlSections = sections
    .map(
      (s) =>
        `<h3 style="margin:18px 0 6px;font-size:14px;letter-spacing:.04em;color:${s.urgent ? '#DC2626' : '#1F2937'}">` +
        `${s.urgent ? '⚠️ ' : ''}${escapeHtml(s.title)}</h3><ul style="margin:0;padding-left:20px">` +
        s.items.map((r) => `<li style="margin:3px 0">${escapeHtml(line(r))}</li>`).join('') +
        '</ul>',
    )
    .join('');

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1F2937;max-width:560px">` +
    `<p>Dzień dobry,</p><p>${escapeHtml(intro)}</p>` +
    (htmlSections || '<p><em>Lista jest pusta.</em></p>') +
    `<p style="margin-top:24px">Pozdrawiam<br>System magazynowy</p>` +
    `<p style="color:#6B7280;font-size:12px">${escapeHtml(input.restaurantName)}</p></div>`;

  return { subject, html, text };
}
