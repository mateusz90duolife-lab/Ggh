// Konta pracowników na nick + 4-cyfrowy PIN.
// PIN nie jest hasłem w Auth: hasło konta to HMAC(sekret serwera, id + PIN), więc odgadnięcie PIN-u wymaga przejścia
// przez funkcję pin-login (blokada po kilku błędach), a nie bezpośrednio przez API logowania.

export const NICK_RE = /^[a-z0-9ąćęłńóśźż._-]{2,24}$/;
export const PIN_RE = /^\d{4}$/;
export const MAX_PIN_FAILS = 5;
export const PIN_LOCK_MINUTES = 15;

/** Nick w postaci zapisywanej w bazie: małe litery, bez spacji na brzegach. */
export function normalizeNick(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Adres e-mail konta w Auth dla osoby logującej się PIN-em (nie służy do wysyłki poczty). */
export function staffEmail(): string {
  return `pin-${crypto.randomUUID()}@staff.restaurant-os.invalid`;
}

function b64url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Hasło konta w Auth wyliczone z PIN-u (deterministyczne, znane tylko serwerowi). */
export async function pinPassword(secret: string, userId: string, pin: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`ros-pin:${userId}:${pin}`));
  return `P1.${b64url(sig)}`;
}
