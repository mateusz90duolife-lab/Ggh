import { UNITS } from './units.js';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_QTY = 100000;

/** Akceptuje przecinek i kropkę, odrzuca NaN, ≤0, > 100000, zaokrągla do 3 miejsc. */
export function parseQuantity(input: string | number, opts: { allowZero?: boolean } = {}): Result<number> {
  const raw = typeof input === 'number' ? String(input) : input.trim().replace(/\s/g, '').replace(',', '.');
  if (raw === '') return { ok: false, error: 'Podaj ilość.' };
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return { ok: false, error: 'Ilość musi być liczbą.' };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, error: 'Ilość musi być liczbą.' };
  if (n < 0 || (n === 0 && !opts.allowZero)) return { ok: false, error: 'Ilość musi być większa od 0.' };
  if (n > MAX_QTY) return { ok: false, error: 'Ilość nie może przekraczać 100 000.' };
  const rounded = Math.round(n * 1000) / 1000;
  if (rounded === 0 && !opts.allowZero) return { ok: false, error: 'Ilość jest zbyt mała (minimum 0,001).' };
  return { ok: true, value: rounded };
}

/** Ilość ze znakiem (korekty): np. „-2,5”. Zero niedozwolone. */
export function parseSignedQuantity(input: string): Result<number> {
  const raw = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(raw)) return { ok: false, error: 'Ilość musi być liczbą.' };
  const n = Number(raw);
  if (n === 0) return { ok: false, error: 'Korekta nie może wynosić 0.' };
  if (Math.abs(n) > MAX_QTY) return { ok: false, error: 'Ilość nie może przekraczać 100 000.' };
  const rounded = Math.round(n * 1000) / 1000;
  if (rounded === 0) return { ok: false, error: 'Ilość jest zbyt mała (minimum 0,001).' };
  return { ok: true, value: rounded };
}

/** Cena/kwota ≥ 0, max 2 miejsca (cena jednostkowa do 4). */
export function parseMoney(input: string | number, maxDecimals = 4): Result<number> {
  const raw = typeof input === 'number' ? String(input) : input.trim().replace(/\s/g, '').replace(',', '.');
  if (raw === '') return { ok: false, error: 'Podaj cenę.' };
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: 'Cena musi być liczbą.' };
  const n = Number(raw);
  if (n > 100000) return { ok: false, error: 'Cena jest zbyt wysoka.' };
  const f = 10 ** maxDecimals;
  return { ok: true, value: Math.round(n * f) / f };
}

export function validateText(input: string, label: string, min: number, max: number): Result<string> {
  const v = input.trim().replace(/\s+/g, ' ');
  if (v.length < min) return { ok: false, error: min <= 1 ? `Podaj ${label}.` : `${cap(label)}: min. ${min} znaki.` };
  if (v.length > max) return { ok: false, error: `${cap(label)}: maks. ${max} znaków.` };
  return { ok: true, value: v };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function validateEmail(input: string): Result<string> {
  const v = input.trim().toLowerCase();
  if (!EMAIL_RE.test(v) || v.length > 200) return { ok: false, error: 'Podaj poprawny adres e-mail.' };
  return { ok: true, value: v };
}

export function validateNewPassword(pw: string, repeat?: string): Result<string> {
  if (pw.length < 8) return { ok: false, error: 'Hasło musi mieć co najmniej 8 znaków.' };
  if (pw.length > 72) return { ok: false, error: 'Hasło może mieć maksymalnie 72 znaki.' };
  if (repeat !== undefined && pw !== repeat) return { ok: false, error: 'Hasła nie są takie same.' };
  return { ok: true, value: pw };
}

export function validateUnit(u: string): Result<string> {
  return (UNITS as readonly string[]).includes(u) ? { ok: true, value: u } : { ok: false, error: 'Wybierz jednostkę.' };
}

/** Lista e-maili rozdzielona przecinkami / średnikami / nowymi liniami. */
export function parseEmailList(input: string): Result<string[]> {
  const items = input
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(items)];
  for (const e of unique) {
    const r = validateEmail(e);
    if (!r.ok) return { ok: false, error: `Niepoprawny adres e-mail: ${e}` };
  }
  if (unique.length > 10) return { ok: false, error: 'Maksymalnie 10 adresów e-mail.' };
  return { ok: true, value: unique };
}

export function validateTime(input: string): Result<string> {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(input) ? { ok: true, value: input } : { ok: false, error: 'Podaj godzinę w formacie GG:MM.' };
}

export function validateTimeZone(tz: string): Result<string> {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return { ok: true, value: tz };
  } catch {
    return { ok: false, error: 'Nieznana strefa czasu (np. Europe/Warsaw).' };
  }
}

/** Data (YYYY-MM-DD), niedalej niż 1 dzień w przyszłości względem podanego „dziś”. */
export function validatePurchaseDate(input: string, today: string): Result<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return { ok: false, error: 'Podaj poprawną datę.' };
  const d = Date.parse(input + 'T00:00:00Z');
  if (Number.isNaN(d)) return { ok: false, error: 'Podaj poprawną datę.' };
  if (d > Date.parse(today + 'T00:00:00Z') + 86400000) return { ok: false, error: 'Data nie może być z przyszłości.' };
  return { ok: true, value: input };
}
