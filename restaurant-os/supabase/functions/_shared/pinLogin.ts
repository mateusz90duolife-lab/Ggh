import { corsHeaders, json, serviceHeaders } from './http.ts';
import { MAX_PIN_FAILS, PIN_LOCK_MINUTES, PIN_RE, normalizeNick, pinPassword } from './pin.ts';
import type { Env, FetchFn } from './types.ts';

interface PinProfile {
  id: string;
  active: boolean;
  pin_failed: number;
  pin_locked_until: string | null;
}

export interface PinLoginDeps {
  env: Env;
  fetchFn: FetchFn;
  now?: () => Date;
}

const BAD = 'Nieprawidłowy nick lub PIN.';

export const pinSecret = (env: Env): string => env.PIN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Logowanie pracownika nickiem i 4-cyfrowym PIN-em. Funkcja publiczna (bez tokenu).
 * Po 5 błędnych PIN-ach konto jest blokowane na 15 minut. Odpowiedź przy złym nicku i złym PIN-ie jest taka sama.
 * Sukces zwraca zwykłą sesję Supabase (access + refresh token), dokładnie jak logowanie hasłem.
 */
export async function handlePinLogin(req: Request, deps: PinLoginDeps): Promise<Response> {
  const { env, fetchFn } = deps;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
  if (req.method !== 'POST') return json(req, env, 405, { error: 'Metoda niedozwolona.' });
  const now = deps.now?.() ?? new Date();

  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json(req, env, 400, { error: 'Nieprawidłowe dane.' });
    }
    const nick = normalizeNick(body.nick);
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    if (!nick || nick.length > 24) return json(req, env, 400, { error: 'Podaj nick.' });
    if (!PIN_RE.test(pin)) return json(req, env, 400, { error: 'PIN to 4 cyfry.' });

    const pr = await fetchFn(
      `${env.SUPABASE_URL}/rest/v1/profiles?nick=eq.${encodeURIComponent(nick)}&select=id,active,pin_failed,pin_locked_until`,
      { headers: serviceHeaders(env) },
    );
    if (!pr.ok) throw new Error(`profiles: ${pr.status}`);
    const profile = ((await pr.json()) as PinProfile[])[0];
    if (!profile) return json(req, env, 401, { error: BAD });
    if (!profile.active) return json(req, env, 403, { error: 'To konto jest nieaktywne. Skontaktuj się z szefem.' });

    const lockedUntil = profile.pin_locked_until ? new Date(profile.pin_locked_until) : null;
    if (lockedUntil && lockedUntil > now) {
      const min = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000));
      return json(req, env, 429, {
        error: `Za dużo błędnych prób. Spróbuj za ${min} min albo poproś szefa o nowy PIN.`,
      });
    }

    const ur = await fetchFn(`${env.SUPABASE_URL}/auth/v1/admin/users/${profile.id}`, {
      headers: serviceHeaders(env),
    });
    if (!ur.ok) return json(req, env, 401, { error: BAD });
    const email = ((await ur.json()) as { email?: string }).email ?? '';

    const tr = await fetchFn(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: await pinPassword(pinSecret(env), profile.id, pin) }),
    });

    const patch = (p: Record<string, unknown>) =>
      fetchFn(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
        method: 'PATCH',
        headers: serviceHeaders(env),
        body: JSON.stringify(p),
      });

    if (!tr.ok) {
      if (tr.status >= 500) return json(req, env, 503, { error: 'Logowanie chwilowo niedostępne. Spróbuj za chwilę.' });
      // limit logowań po stronie Supabase Auth — nie liczymy tego jako błędnego PIN-u
      if (tr.status === 429) return json(req, env, 503, { error: 'Za dużo logowań naraz. Spróbuj za minutę.' });
      const fails = (profile.pin_failed ?? 0) + 1;
      if (fails >= MAX_PIN_FAILS) {
        await patch({
          pin_failed: 0,
          pin_locked_until: new Date(now.getTime() + PIN_LOCK_MINUTES * 60000).toISOString(),
        });
        return json(req, env, 429, {
          error: `Za dużo błędnych prób. Konto zablokowane na ${PIN_LOCK_MINUTES} min.`,
        });
      }
      await patch({ pin_failed: fails });
      const left = MAX_PIN_FAILS - fails;
      return json(req, env, 401, { error: `${BAD} Pozostało prób: ${left}.` });
    }
    if (profile.pin_failed || profile.pin_locked_until) await patch({ pin_failed: 0, pin_locked_until: null });
    const t = (await tr.json()) as Record<string, unknown>;
    return json(req, env, 200, {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_in: t.expires_in,
      expires_at: t.expires_at,
      user: t.user ? { id: (t.user as { id: string }).id } : { id: profile.id },
    });
  } catch (e) {
    console.error('pin-login', e instanceof Error ? e.message : 'błąd');
    return json(req, env, 500, { error: 'Błąd serwera. Spróbuj ponownie.' });
  }
}
