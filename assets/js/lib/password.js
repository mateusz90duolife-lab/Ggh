/** Hasło tymczasowe: 12 znaków bez mylących (0/O, 1/l/I), zawsze z cyfrą i wielką literą. */
export function generatePassword(length = 12) {
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const all = lower + upper + digits;
    const pick = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
    const chars = [pick(upper), pick(digits), pick(lower)];
    while (chars.length < length)
        chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}
