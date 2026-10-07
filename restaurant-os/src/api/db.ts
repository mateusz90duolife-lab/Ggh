import { getConfig } from '../lib/config.js';
import { ApiError, NetworkError, fromPostgrest } from '../lib/errors.js';
import { storage } from '../lib/storage.js';
import { getAccessToken, getSession, refreshSession } from './auth.js';
import { markOffline, markOnline, markStale } from './net.js';

type Primitive = string | number | boolean;

export const eq = (v: Primitive) => `eq.${v}`;
export const neq = (v: Primitive) => `neq.${v}`;
export const gt = (v: Primitive) => `gt.${v}`;
export const gte = (v: Primitive) => `gte.${v}`;
export const lt = (v: Primitive) => `lt.${v}`;
export const lte = (v: Primitive) => `lte.${v}`;
export const isNull = 'is.null';
export const notNull = 'not.is.null';
export function inList(values: Primitive[]): string {
  const q = (v: Primitive) => {
    const s = String(v);
    return /[,()"\s]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
  };
  return `in.(${values.map(q).join(',')})`;
}

interface RawResult {
  data: unknown;
  status: number;
}

async function raw(path: string, init: RequestInit = {}, retried = false): Promise<RawResult> {
  const cfg = getConfig();
  if (!cfg) throw new ApiError(500, 'CONFIG', 'Aplikacja nie jest skonfigurowana (brak adresu Supabase).');
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, 'NO_SESSION', 'Sesja wygasła. Zaloguj się ponownie.');
  let res: Response;
  try {
    res = await fetch(`${cfg.SUPABASE_URL}${path}`, {
      ...init,
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    markOffline();
    throw new NetworkError();
  }
  markOnline();
  if (res.status === 401 && !retried && getSession()) {
    try {
      await refreshSession();
      return raw(path, init, true);
    } catch (e) {
      if (e instanceof NetworkError) throw e;
    }
  }
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    if (path.startsWith('/functions/')) {
      const msg = (data as { error?: string } | null)?.error;
      throw new ApiError(res.status, 'FN', msg ?? 'Nie udało się wykonać operacji.');
    }
    throw fromPostgrest(res.status, data as { code?: string; message?: string } | null);
  }
  return { data, status: res.status };
}

export interface ListOpts {
  select?: string;
  params?: Record<string, string>;
  order?: string;
  limit?: number;
  /** Domyślnie true: odpowiedź jest zapamiętywana i używana, gdy brak internetu. */
  cache?: boolean;
}

function queryString(opts: ListOpts): string {
  const q = new URLSearchParams();
  q.set('select', opts.select ?? '*');
  for (const [k, v] of Object.entries(opts.params ?? {})) q.set(k, v);
  if (opts.order) q.set('order', opts.order);
  if (opts.limit !== undefined) q.set('limit', String(opts.limit));
  return q.toString();
}

const CACHE_PREFIX = 'ros.cache.';
const MAX_CACHED_BYTES = 400_000;

function cacheKey(path: string): string | null {
  const s = getSession();
  return s ? `${CACHE_PREFIX}${s.user.id}.${path}` : null;
}

export function clearCache(): void {
  for (const k of storage.keys()) if (k.startsWith(CACHE_PREFIX)) storage.remove(k);
}

export async function list<T>(table: string, opts: ListOpts = {}): Promise<T[]> {
  const path = `/rest/v1/${table}?${queryString(opts)}`;
  const key = opts.cache === false ? null : cacheKey(path);
  try {
    const { data } = await raw(path);
    const rows = Array.isArray(data) ? (data as T[]) : [];
    if (key) {
      const body = JSON.stringify({ t: Date.now(), data: rows });
      if (body.length <= MAX_CACHED_BYTES) storage.set(key, body);
    }
    return rows;
  } catch (e) {
    if (e instanceof NetworkError && key) {
      const cached = storage.getJson<{ t: number; data: T[] } | null>(key, null);
      if (cached) {
        markStale(cached.t);
        return cached.data;
      }
    }
    throw e;
  }
}

export async function one<T>(table: string, opts: ListOpts = {}): Promise<T | null> {
  const rows = await list<T>(table, { ...opts, limit: 1 });
  return rows[0] ?? null;
}

export async function insert<T = unknown>(table: string, rows: object | object[]): Promise<T[]> {
  const { data } = await raw(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function update<T = unknown>(table: string, params: Record<string, string>, patch: object): Promise<T[]> {
  if (Object.keys(params).length === 0) throw new ApiError(400, 'GUARD', 'Aktualizacja bez filtra jest niedozwolona.');
  const q = new URLSearchParams(params).toString();
  const { data } = await raw(`/rest/v1/${table}?${q}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function remove(table: string, params: Record<string, string>): Promise<void> {
  if (Object.keys(params).length === 0) throw new ApiError(400, 'GUARD', 'Usuwanie bez filtra jest niedozwolone.');
  const q = new URLSearchParams(params).toString();
  await raw(`/rest/v1/${table}?${q}`, { method: 'DELETE' });
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data } = await raw(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  return data as T;
}

export async function callFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  const { data } = await raw(`/functions/v1/${name}`, { method: 'POST', body: JSON.stringify(body) });
  return data as T;
}
