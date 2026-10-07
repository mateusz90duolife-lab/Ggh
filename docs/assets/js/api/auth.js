import { getConfig } from '../lib/config.js';
import { ApiError, NetworkError } from '../lib/errors.js';
import { decodeJwt } from '../lib/jwt.js';
import { storage } from '../lib/storage.js';
import { markOffline, markOnline } from './net.js';
const KEY = 'ros.session';
const nowSec = () => Math.floor(Date.now() / 1000);
let session = storage.getJson(KEY, null);
const listeners = new Set();
let refreshing = null;
export function getSession() {
    return session;
}
export function onSessionChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
function setSession(s) {
    session = s;
    if (s)
        storage.setJson(KEY, s);
    else
        storage.remove(KEY);
    for (const l of listeners)
        l(s);
}
function toSession(r) {
    const payload = decodeJwt(r.access_token);
    const id = r.user?.id ?? payload?.sub;
    if (!id)
        throw new ApiError(500, 'AUTH', 'Nieprawidłowa odpowiedź serwera logowania.');
    return {
        access_token: r.access_token,
        refresh_token: r.refresh_token,
        expires_at: r.expires_at ?? payload?.exp ?? nowSec() + (r.expires_in ?? 3600),
        user: { id, email: r.user?.email ?? payload?.email },
    };
}
async function authFetch(path, init = {}) {
    const cfg = getConfig();
    if (!cfg)
        throw new ApiError(500, 'CONFIG', 'Aplikacja nie jest skonfigurowana (brak adresu Supabase).');
    const { token, ...rest } = init;
    try {
        const res = await fetch(`${cfg.SUPABASE_URL}/auth/v1${path}`, {
            ...rest,
            headers: {
                apikey: cfg.SUPABASE_ANON_KEY,
                'content-type': 'application/json',
                ...(token ? { authorization: `Bearer ${token}` } : {}),
                ...rest.headers,
            },
        });
        markOnline();
        return res;
    }
    catch {
        markOffline();
        throw new NetworkError();
    }
}
async function readError(res) {
    try {
        const b = (await res.json());
        return {
            code: String(b.error_code ?? b.code ?? b.error ?? res.status),
            msg: String(b.msg ?? b.error_description ?? b.message ?? ''),
        };
    }
    catch {
        return { code: String(res.status), msg: '' };
    }
}
export async function signIn(email, password) {
    const res = await authFetch('/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const { code, msg } = await readError(res);
        if (res.status === 429)
            throw new ApiError(429, code, 'Zbyt wiele prób logowania. Spróbuj za chwilę.');
        if (/banned/i.test(code) || /banned/i.test(msg)) {
            throw new ApiError(res.status, code, 'To konto jest zablokowane. Skontaktuj się z właścicielem.');
        }
        if (res.status >= 500)
            throw new ApiError(res.status, code, 'Błąd serwera. Spróbuj ponownie za chwilę.');
        throw new ApiError(res.status, code, 'Nieprawidłowy e-mail lub hasło.');
    }
    const s = toSession((await res.json()));
    setSession(s);
    return s;
}
export function refreshSession() {
    if (refreshing)
        return refreshing;
    const current = session;
    if (!current)
        return Promise.reject(new ApiError(401, 'NO_SESSION', 'Brak sesji.'));
    refreshing = (async () => {
        try {
            const res = await authFetch('/token?grant_type=refresh_token', {
                method: 'POST',
                body: JSON.stringify({ refresh_token: current.refresh_token }),
            });
            if (!res.ok) {
                const { code } = await readError(res);
                if (res.status >= 500)
                    throw new ApiError(res.status, code, 'Błąd serwera.');
                setSession(null); // refresh token unieważniony (np. konto zablokowane) → wylogowanie
                throw new ApiError(401, code, 'Sesja wygasła. Zaloguj się ponownie.');
            }
            const s = toSession((await res.json()));
            setSession(s);
            return s;
        }
        finally {
            refreshing = null;
        }
    })();
    return refreshing;
}
/** Zwraca ważny token dostępu (odświeża, gdy zostało < 60 s). null = brak sesji. */
export async function getAccessToken() {
    if (!session)
        return null;
    if (session.expires_at - nowSec() > 60)
        return session.access_token;
    try {
        return (await refreshSession()).access_token;
    }
    catch (e) {
        if (e instanceof NetworkError && session && session.expires_at > nowSec())
            return session.access_token;
        if (e instanceof NetworkError)
            throw e;
        return null;
    }
}
export async function signOut() {
    const s = session;
    setSession(null);
    if (s) {
        try {
            await authFetch('/logout', { method: 'POST', token: s.access_token });
        }
        catch {
            /* wylogowanie lokalne i tak się udało */
        }
    }
}
/** Zawsze neutralny wynik — nie ujawniamy, czy konto istnieje. Zgłasza tylko brak sieci. */
export async function requestPasswordReset(email) {
    const redirect = encodeURIComponent(`${location.origin}${location.pathname}`);
    const res = await authFetch(`/recover?redirect_to=${redirect}`, { method: 'POST', body: JSON.stringify({ email }) });
    if (res.status === 429)
        throw new ApiError(429, 'RATE', 'Zbyt wiele prób. Spróbuj za chwilę.');
}
export async function updatePassword(password) {
    const token = await getAccessToken();
    if (!token)
        throw new ApiError(401, 'NO_SESSION', 'Sesja wygasła. Poproś o nowy link do zmiany hasła.');
    const res = await authFetch('/user', { method: 'PUT', token, body: JSON.stringify({ password }) });
    if (!res.ok) {
        const { msg } = await readError(res);
        if (/different from the old password|same_password/i.test(msg)) {
            throw new ApiError(422, 'SAME', 'Nowe hasło musi różnić się od poprzedniego.');
        }
        if (/weak|short|at least/i.test(msg))
            throw new ApiError(422, 'WEAK', 'Hasło jest zbyt słabe. Użyj co najmniej 8 znaków.');
        throw new ApiError(res.status, 'AUTH', 'Nie udało się zmienić hasła.');
    }
}
/**
 * Link z maila (reset hasła) wraca na stronę z tokenami w fragmencie URL (#access_token=…&type=recovery).
 * Wczytujemy sesję i czyścimy adres, żeby tokeny nie zostały w historii przeglądarki.
 */
export function consumeAuthHash(hash = location.hash) {
    if (!hash || hash.startsWith('#/'))
        return null;
    const p = new URLSearchParams(hash.replace(/^#/, ''));
    if (p.get('error') || p.get('error_code')) {
        const code = p.get('error_code') ?? '';
        return {
            type: 'error',
            error: /expired|otp/i.test(code)
                ? 'Link wygasł lub został już użyty. Poproś o nowy link do zmiany hasła.'
                : 'Nie udało się zweryfikować linku. Spróbuj ponownie.',
        };
    }
    const access = p.get('access_token');
    const refresh = p.get('refresh_token');
    if (!access || !refresh)
        return null;
    try {
        setSession(toSession({
            access_token: access,
            refresh_token: refresh,
            expires_in: Number(p.get('expires_in') ?? 3600),
            expires_at: p.get('expires_at') ? Number(p.get('expires_at')) : undefined,
        }));
    }
    catch {
        return { type: 'error', error: 'Nie udało się zweryfikować linku.' };
    }
    return { type: p.get('type') === 'recovery' ? 'recovery' : 'other' };
}
