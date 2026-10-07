import { unitLabel } from './units.js';

/** 10 → „10”, 2.5 → „2,5”, „0.125” → „0,125”. */
export function formatQty(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n * 1000) / 1000).replace('.', ',');
}

export function formatQtyUnit(value: number | string | null | undefined, unit: string): string {
  return `${formatQty(value)} ${unitLabel(unit)}`;
}

const PLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', useGrouping: 'always' });
export function formatPLN(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? PLN.format(n).replace(/ /g, ' ') : '—';
}

/** „2026-10-08” → „08.10.2026”. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Czas w strefie lokalu: „07.10.2026 19:42”. */
export function formatDateTime(iso: string | null | undefined, timeZone = 'Europe/Warsaw'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = parts(d, timeZone);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export function formatTime(iso: string | null | undefined, timeZone = 'Europe/Warsaw'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = parts(d, timeZone);
  return `${p.hour}:${p.minute}`;
}

function parts(d: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value])) as Record<string, string>;
}

/** Dzisiejsza data (YYYY-MM-DD) w strefie lokalu. */
export function todayIn(timeZone = 'Europe/Warsaw', now: Date = new Date()): string {
  const p = parts(now, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MONTHS = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

/** „środa, 7 października” */
export function formatLongDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const WEEKDAY_SHORT = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd']; // ISO 1..7

/** „przed chwilą”, „5 min temu”, „2 godz. temu”, „wczoraj”, albo data. */
export function relativeTime(iso: string, now: Date = new Date(), timeZone = 'Europe/Warsaw'): string {
  const d = new Date(iso);
  const diff = Math.round((now.getTime() - d.getTime()) / 1000);
  if (!Number.isFinite(diff)) return '—';
  if (diff < 45) return 'przed chwilą';
  if (diff < 3600) return `${Math.round(diff / 60)} min temu`;
  if (diff < 86400) return `${Math.round(diff / 3600)} godz. temu`;
  return formatDateTime(iso, timeZone);
}

/** Polskie liczebniki: pl(1,'produkt','produkty','produktów'). */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (a === 1) return one;
  const last = a % 10;
  const last2 = a % 100;
  if (last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14)) return few;
  return many;
}

/** Normalizacja do wyszukiwania: małe litery, bez polskich znaków diakrytycznych. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function isoWeekday(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
export function nextOccurrences(days: number[], from: string, count = 4): string[] {
  const out: string[] = [];
  let t = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < 28 && out.length < count; i++, t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    if (days.includes(isoWeekday(iso))) out.push(iso);
  }
  return out;
}
