import type { Caller, Env, FetchFn } from './types.ts';

export function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = env.ALLOWED_ORIGIN ? (origin === env.ALLOWED_ORIGIN ? origin : '') : '*';
  const h: Record<string, string> = {
    'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
  if (allowed) h['access-control-allow-origin'] = allowed;
  return h;
}

export function json(req: Request, env: Env, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(req, env) },
  });
}

export function bearer(req: Request): string {
  const h = req.headers.get('authorization') ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}

/** Porównanie w stałym czasie (długość sekretu nie jest tajna). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function serviceHeaders(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

/** Sprawdza JWT użytkownika w GoTrue i wczytuje jego profil (service role). Zwraca null, jeśli niepoprawny/nieaktywny. */
export async function authenticate(req: Request, env: Env, fetchFn: FetchFn): Promise<Caller | null> {
  const token = bearer(req);
  if (!token) return null;
  const u = await fetchFn(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` },
  });
  if (!u.ok) return null;
  const user = (await u.json()) as { id?: string };
  if (!user.id) return null;
  const p = await fetchFn(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,restaurant_id,role,active`,
    { headers: serviceHeaders(env) },
  );
  if (!p.ok) return null;
  const rows = (await p.json()) as Caller[];
  const caller = rows[0];
  return caller && caller.active ? caller : null;
}
