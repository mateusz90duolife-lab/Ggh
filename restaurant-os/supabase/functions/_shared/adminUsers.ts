import { authenticate, json, corsHeaders, serviceHeaders } from './http.ts';
import type { Caller, Env, FetchFn } from './types.ts';

const ROLES = ['owner', 'manager', 'employee'] as const;
type Role = (typeof ROLES)[number];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAN_FOREVER = '876000h'; // ~100 lat

interface ProfileRow {
  id: string;
  restaurant_id: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}
interface AuthUser {
  id: string;
  email?: string;
  last_sign_in_at?: string | null;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function validPassword(p: unknown): string {
  if (typeof p !== 'string' || p.length < 8 || p.length > 72) {
    throw new HttpError(400, 'Hasło musi mieć od 8 do 72 znaków.');
  }
  return p;
}

/**
 * Zarządzanie kontami (tylko właściciel). Operacje na auth.users wymagają klucza service role,
 * dlatego wykonujemy je wyłącznie tutaj — nigdy z frontendu.
 * Akcje: list | create | update | reset_password
 */
export async function handleAdminUsers(req: Request, env: Env, fetchFn: FetchFn): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
  if (req.method !== 'POST') return json(req, env, 405, { error: 'Metoda niedozwolona.' });

  try {
    const caller = await authenticate(req, env, fetchFn);
    if (!caller) return json(req, env, 401, { error: 'Brak autoryzacji.' });
    if (caller.role !== 'owner') return json(req, env, 403, { error: 'Tylko właściciel może zarządzać kontami.' });

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json(req, env, 400, { error: 'Nieprawidłowe dane.' });
    }

    switch (body.action) {
      case 'list':
        return json(req, env, 200, { users: await listUsers(env, fetchFn, caller) });
      case 'create':
        return json(req, env, 200, { user: await createUser(env, fetchFn, caller, body) });
      case 'update':
        return json(req, env, 200, { user: await updateUser(env, fetchFn, caller, body) });
      case 'reset_password':
        await resetPassword(env, fetchFn, caller, body);
        return json(req, env, 200, { ok: true });
      default:
        return json(req, env, 400, { error: 'Nieznana akcja.' });
    }
  } catch (e) {
    if (e instanceof HttpError) return json(req, env, e.status, { error: e.message });
    console.error('admin-users', e instanceof Error ? e.message : 'błąd');
    return json(req, env, 500, { error: 'Wystąpił błąd serwera.' });
  }
}

async function rest<T>(env: Env, fetchFn: FetchFn, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetchFn(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders(env, { prefer: 'return=representation', ...(init.headers as Record<string, string>) }),
  });
  if (!r.ok) throw new HttpError(500, 'Błąd bazy danych.');
  return (await r.json()) as T;
}

async function authAdmin(env: Env, fetchFn: FetchFn, path: string, init: RequestInit = {}): Promise<Response> {
  return fetchFn(`${env.SUPABASE_URL}/auth/v1/admin/${path}`, { ...init, headers: serviceHeaders(env) });
}

async function listUsers(env: Env, fetchFn: FetchFn, caller: Caller) {
  const profiles = await rest<ProfileRow[]>(
    env,
    fetchFn,
    `profiles?restaurant_id=eq.${caller.restaurant_id}&select=id,restaurant_id,full_name,role,active,created_at&order=created_at.asc`,
    { method: 'GET' },
  );
  const r = await authAdmin(env, fetchFn, 'users?per_page=1000');
  if (!r.ok) throw new HttpError(500, 'Nie udało się pobrać kont.');
  const payload = (await r.json()) as { users?: AuthUser[] } | AuthUser[];
  const users = Array.isArray(payload) ? payload : (payload.users ?? []);
  const byId = new Map(users.map((u) => [u.id, u]));
  return profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    active: p.active,
    created_at: p.created_at,
    email: byId.get(p.id)?.email ?? null,
    last_sign_in_at: byId.get(p.id)?.last_sign_in_at ?? null,
  }));
}

async function createUser(env: Env, fetchFn: FetchFn, caller: Caller, body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const role = body.role as Role;
  if (!EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, 'Podaj poprawny adres e-mail.');
  if (fullName.length < 2 || fullName.length > 80) throw new HttpError(400, 'Imię i nazwisko: od 2 do 80 znaków.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Nieprawidłowa rola.');
  const password = validPassword(body.password);

  const created = await authAdmin(env, fetchFn, 'users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) {
    const txt = (await created.text()).toLowerCase();
    if (created.status === 422 || txt.includes('already') || txt.includes('exists')) {
      throw new HttpError(409, 'Konto z tym adresem e-mail już istnieje.');
    }
    throw new HttpError(500, 'Nie udało się utworzyć konta.');
  }
  const user = (await created.json()) as AuthUser;

  const ins = await fetchFn(`${env.SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: serviceHeaders(env, { prefer: 'return=representation' }),
    body: JSON.stringify({ id: user.id, restaurant_id: caller.restaurant_id, full_name: fullName, role }),
  });
  if (!ins.ok) {
    await authAdmin(env, fetchFn, `users/${user.id}`, { method: 'DELETE' }); // wycofanie, brak „sierot”
    throw new HttpError(500, 'Nie udało się zapisać profilu użytkownika.');
  }
  const [profile] = (await ins.json()) as ProfileRow[];
  return { id: user.id, email, full_name: profile?.full_name ?? fullName, role, active: true };
}

async function loadTarget(env: Env, fetchFn: FetchFn, caller: Caller, id: unknown): Promise<ProfileRow> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(400, 'Nieprawidłowy identyfikator.');
  const rows = await rest<ProfileRow[]>(
    env,
    fetchFn,
    `profiles?id=eq.${id}&restaurant_id=eq.${caller.restaurant_id}&select=id,restaurant_id,full_name,role,active,created_at`,
    { method: 'GET' },
  );
  const t = rows[0];
  if (!t) throw new HttpError(404, 'Użytkownik nie istnieje.');
  return t;
}

async function updateUser(env: Env, fetchFn: FetchFn, caller: Caller, body: Record<string, unknown>) {
  const target = await loadTarget(env, fetchFn, caller, body.id);
  const patch: Record<string, unknown> = {};

  if (body.full_name !== undefined) {
    const n = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    if (n.length < 2 || n.length > 80) throw new HttpError(400, 'Imię i nazwisko: od 2 do 80 znaków.');
    patch.full_name = n;
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role as Role)) throw new HttpError(400, 'Nieprawidłowa rola.');
    if (target.id === caller.id && body.role !== target.role) {
      throw new HttpError(400, 'Nie możesz zmienić własnej roli.');
    }
    patch.role = body.role;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'Nieprawidłowy status.');
    if (target.id === caller.id && body.active === false) {
      throw new HttpError(400, 'Nie możesz dezaktywować własnego konta.');
    }
    patch.active = body.active;
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Brak zmian do zapisania.');

  const [updated] = await rest<ProfileRow[]>(env, fetchFn, `profiles?id=eq.${target.id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!updated) throw new HttpError(500, 'Nie udało się zapisać zmian.');

  if (patch.active !== undefined) {
    // zablokowanie/odblokowanie logowania w Auth (sesje wygasną, a RLS i tak odetnie dostęp od razu)
    const r = await authAdmin(env, fetchFn, `users/${target.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ban_duration: patch.active ? 'none' : BAN_FOREVER }),
    });
    if (!r.ok) throw new HttpError(500, 'Zapisano profil, ale nie udało się zmienić blokady logowania.');
  }
  return { id: updated.id, full_name: updated.full_name, role: updated.role, active: updated.active };
}

async function resetPassword(env: Env, fetchFn: FetchFn, caller: Caller, body: Record<string, unknown>) {
  const target = await loadTarget(env, fetchFn, caller, body.id);
  const password = validPassword(body.password);
  const r = await authAdmin(env, fetchFn, `users/${target.id}`, { method: 'PUT', body: JSON.stringify({ password }) });
  if (!r.ok) throw new HttpError(500, 'Nie udało się zmienić hasła.');
}
