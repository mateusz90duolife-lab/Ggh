export const UNITS = ['kg', 'g', 'l', 'ml', 'szt', 'opak', 'but'] as const;
export type Unit = (typeof UNITS)[number];

const LABELS: Record<Unit, string> = { kg: 'kg', g: 'g', l: 'L', ml: 'ml', szt: 'szt.', opak: 'opak.', but: 'but.' };

export function unitLabel(u: string): string {
  return (LABELS as Record<string, string>)[u] ?? u;
}

export function isUnit(u: string): u is Unit {
  return (UNITS as readonly string[]).includes(u);
}

/** Jednostki, w których ilość ma sens ułamkowy (np. 2,5 kg); dla sztuk podpowiadamy całkowite. */
export function allowsFraction(u: string): boolean {
  return u !== 'szt' && u !== 'opak' && u !== 'but';
}
