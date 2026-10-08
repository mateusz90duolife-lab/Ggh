// Obliczenia godzin pracy: czas trwania zmian, sumy w okresie i przeliczanie godziny lokalu na czas UTC.
import { todayIn } from './format.js';

export interface ShiftLike {
  started_at: string;
  ended_at: string | null;
}

/** Minuty zmiany; trwająca zmiana liczy się do teraz. */
export function shiftMinutes(s: ShiftLike, now: Date = new Date()): number {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.round((end - new Date(s.started_at).getTime()) / 60000));
}

/** „7 h 05 min”, „45 min”, „0 min”. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh === 0) return `${mm} min`;
  return mm ? `${hh} h ${String(mm).padStart(2, '0')} min` : `${hh} h`;
}

/** Lokalna data (YYYY-MM-DD) rozpoczęcia zmiany w strefie lokalu. */
export function shiftDate(s: ShiftLike, timeZone: string): string {
  return todayIn(timeZone, new Date(s.started_at));
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Period = 'week' | 'month' | 'prev_month';

/** Zakres dat [od, do) dla okresu, liczony od dzisiejszej daty lokalu. */
export function periodRange(period: Period, today: string): { from: string; to: string; label: string } {
  if (period === 'week') {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay() || 7; // pn = 1
    const from = addDays(today, 1 - dow);
    return { from, to: addDays(from, 7), label: 'Ten tydzień' };
  }
  const [y, m] = today.split('-').map(Number) as [number, number];
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  if (period === 'month') {
    return { from: first(y, m), to: m === 12 ? first(y + 1, 1) : first(y, m + 1), label: 'Ten miesiąc' };
  }
  return { from: m === 1 ? first(y - 1, 12) : first(y, m - 1), to: first(y, m), label: 'Poprzedni miesiąc' };
}

/** Suma minut zmian rozpoczętych w zakresie dat [from, to) (daty lokalne). */
export function sumMinutes<T extends ShiftLike>(
  shifts: T[],
  range: { from: string; to: string },
  timeZone: string,
  now: Date = new Date(),
): number {
  return shifts
    .filter((s) => {
      const d = shiftDate(s, timeZone);
      return d >= range.from && d < range.to;
    })
    .reduce((sum, s) => sum + shiftMinutes(s, now), 0);
}

function offsetMinutes(instant: number, timeZone: string): number {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return Math.round((asUtc - instant) / 60000);
}

/** Data i godzina w strefie lokalu („2026-10-07”, „08:30”) → chwila w UTC (ISO). */
export function localToIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const naive = Date.UTC(y, mo - 1, d, hh, mm);
  let t = naive - offsetMinutes(naive, timeZone) * 60000;
  t = naive - offsetMinutes(t, timeZone) * 60000; // druga iteracja: poprawne przy zmianie czasu
  return new Date(t).toISOString();
}

/** Godzina „HH:MM” w strefie lokalu. */
export function localTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pl-PL', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
}
