export const UNITS = ['kg', 'g', 'l', 'ml', 'szt', 'opak', 'but'];
const LABELS = { kg: 'kg', g: 'g', l: 'L', ml: 'ml', szt: 'szt.', opak: 'opak.', but: 'but.' };
export function unitLabel(u) {
    return LABELS[u] ?? u;
}
export function isUnit(u) {
    return UNITS.includes(u);
}
/** Jednostki, w których ilość ma sens ułamkowy (np. 2,5 kg); dla sztuk podpowiadamy całkowite. */
export function allowsFraction(u) {
    return u !== 'szt' && u !== 'opak' && u !== 'but';
}
