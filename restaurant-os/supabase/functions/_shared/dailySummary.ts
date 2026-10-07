import { addDays, buildSummary, type ShoppingRow } from './summaryMail.ts';
import { authenticate, bearer, corsHeaders, json, safeEqual, serviceHeaders } from './http.ts';
import type { Env, FetchFn } from './types.ts';

interface Restaurant {
  id: string;
  name: string;
  timezone: string;
  summary_time: string; // „21:00:00”
  summary_emails: string[];
}

const KIND = 'shopping_summary';
const STUCK_MINUTES = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lokalna data (YYYY-MM-DD) i godzina (HH:MM) w strefie lokalu. */
export function localParts(now: Date, timeZone: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export interface SummaryDeps {
  env: Env;
  fetchFn: FetchFn;
  now?: () => Date;
}

/**
 * Wysyłka listy zakupów e-mailem.
 *  - Wywołanie crona (nagłówek Bearer = CRON_SECRET): dla każdej restauracji, gdy lokalna godzina >= summary_time
 *    i brak wpisu w email_log na dziś. Idempotentne: najwyżej 1 mail dziennie (przejęcie wpisu w email_log).
 *  - Wywołanie przez użytkownika (manager/właściciel): wysyłka ręczna własnej restauracji, body {test?: boolean}.
 */
export async function handleDailySummary(req: Request, deps: SummaryDeps): Promise<Response> {
  const { env, fetchFn } = deps;
  const now = deps.now ?? (() => new Date());
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
  if (req.method !== 'POST') return json(req, env, 405, { error: 'Metoda niedozwolona.' });
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    console.error('daily-shopping-summary: brak konfiguracji RESEND_API_KEY/MAIL_FROM');
    return json(req, env, 500, { error: 'Wysyłka e-mail nie jest skonfigurowana na serwerze.' });
  }

  try {
    const token = bearer(req);
    if (env.CRON_SECRET && safeEqual(token, env.CRON_SECRET)) {
      const restaurants = await get<Restaurant[]>(
        env,
        fetchFn,
        'restaurants?select=id,name,timezone,summary_time,summary_emails',
      );
      const results: Record<string, string>[] = [];
      for (const r of restaurants) {
        const lp = localParts(now(), r.timezone);
        if (lp.time < r.summary_time.slice(0, 5)) {
          results.push({ restaurant: r.id, result: 'za wcześnie' });
          continue;
        }
        results.push({ restaurant: r.id, result: await runScheduled(deps, r, lp.date) });
      }
      return json(req, env, 200, { results });
    }

    const caller = await authenticate(req, env, fetchFn);
    if (!caller) return json(req, env, 401, { error: 'Brak autoryzacji.' });
    if (caller.role === 'employee') return json(req, env, 403, { error: 'Brak uprawnień.' });
    let body: { test?: boolean } = {};
    try {
      body = (await req.json()) as { test?: boolean };
    } catch {
      /* puste body jest dozwolone */
    }
    const [r] = await get<Restaurant[]>(
      env,
      fetchFn,
      `restaurants?id=eq.${caller.restaurant_id}&select=id,name,timezone,summary_time,summary_emails`,
    );
    if (!r) return json(req, env, 404, { error: 'Nie znaleziono restauracji.' });
    const to = recipients(r);
    if (to.length === 0) {
      return json(req, env, 400, { error: 'Brak odbiorców. Dodaj adres e-mail w Ustawieniach.' });
    }
    const rows = await loadRows(deps, r.id);
    const lp = localParts(now(), r.timezone);
    const mail = buildSummary({ rows, forDate: lp.date, restaurantName: r.name, forTomorrow: false });
    if (body.test) mail.subject = `[TEST] ${mail.subject}`;
    await sendMail(deps, to, mail);
    return json(req, env, 200, { ok: true, sent_to: to.length, items: rows.length });
  } catch (e) {
    console.error('daily-shopping-summary', e instanceof Error ? e.message : 'błąd');
    return json(req, env, 500, { error: e instanceof Error ? e.message : 'Wystąpił błąd serwera.' });
  }
}

function recipients(r: Restaurant): string[] {
  return (r.summary_emails ?? []).filter((e) => EMAIL_RE.test(e));
}

async function get<T>(env: Env, fetchFn: FetchFn, path: string): Promise<T> {
  const r = await fetchFn(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: serviceHeaders(env) });
  if (!r.ok) throw new Error('Błąd bazy danych.');
  return (await r.json()) as T;
}

async function loadRows(deps: SummaryDeps, restaurantId: string): Promise<ShoppingRow[]> {
  return get<ShoppingRow[]>(deps.env, deps.fetchFn, `shopping_list?restaurant_id=eq.${restaurantId}&select=*`);
}

async function sendMail(deps: SummaryDeps, to: string[], mail: { subject: string; html: string; text: string }) {
  const r = await deps.fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${deps.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: deps.env.MAIL_FROM, to, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 200);
    throw new Error(`Resend odrzucił wiadomość (${r.status}): ${txt}`);
  }
  const data = (await r.json().catch(() => ({}))) as { id?: string };
  return data.id ?? null;
}

async function patchLog(deps: SummaryDeps, r: Restaurant, date: string, patch: Record<string, unknown>) {
  await deps.fetchFn(
    `${deps.env.SUPABASE_URL}/rest/v1/email_log?restaurant_id=eq.${r.id}&kind=eq.${KIND}&local_date=eq.${date}`,
    { method: 'PATCH', headers: serviceHeaders(deps.env), body: JSON.stringify(patch) },
  );
}

/** Przejęcie wpisu w email_log: tylko jedno wywołanie dziennie dostaje „zielone światło”. */
async function claim(deps: SummaryDeps, r: Restaurant, date: string): Promise<boolean> {
  const { env, fetchFn } = deps;
  const ins = await fetchFn(`${env.SUPABASE_URL}/rest/v1/email_log?on_conflict=restaurant_id,kind,local_date`, {
    method: 'POST',
    headers: serviceHeaders(env, { prefer: 'resolution=ignore-duplicates,return=representation' }),
    body: JSON.stringify({ restaurant_id: r.id, kind: KIND, local_date: date, status: 'sending' }),
  });
  if (!ins.ok) throw new Error('Nie udało się zapisać wpisu w email_log.');
  if (((await ins.json()) as unknown[]).length > 0) return true;

  // wpis już jest: ponawiamy tylko po błędzie albo po „zawieszonym” wysyłaniu
  const stuckBefore = new Date((deps.now ?? (() => new Date()))().getTime() - STUCK_MINUTES * 60_000).toISOString();
  const upd = await fetchFn(
    `${env.SUPABASE_URL}/rest/v1/email_log?restaurant_id=eq.${r.id}&kind=eq.${KIND}&local_date=eq.${date}` +
      `&or=(status.eq.failed,and(status.eq.sending,claimed_at.lt.${stuckBefore}))`,
    {
      method: 'PATCH',
      headers: serviceHeaders(env, { prefer: 'return=representation' }),
      body: JSON.stringify({ status: 'sending', claimed_at: (deps.now ?? (() => new Date()))().toISOString(), error: null }),
    },
  );
  if (!upd.ok) throw new Error('Nie udało się przejąć wpisu w email_log.');
  return ((await upd.json()) as unknown[]).length > 0;
}

async function runScheduled(deps: SummaryDeps, r: Restaurant, localDate: string): Promise<string> {
  if (!(await claim(deps, r, localDate))) return 'już obsłużone dzisiaj';
  try {
    const to = recipients(r);
    if (to.length === 0) {
      await patchLog(deps, r, localDate, { status: 'skipped', error: 'Brak odbiorców' });
      return 'pominięto: brak odbiorców';
    }
    const rows = await loadRows(deps, r.id);
    if (rows.length === 0) {
      await patchLog(deps, r, localDate, { status: 'skipped', error: 'Lista zakupów jest pusta' });
      return 'pominięto: pusta lista';
    }
    const mail = buildSummary({ rows, forDate: addDays(localDate, 1), restaurantName: r.name, forTomorrow: true });
    const providerId = await sendMail(deps, to, mail);
    await patchLog(deps, r, localDate, { status: 'sent', provider_id: providerId, error: null });
    return 'wysłano';
  } catch (e) {
    await patchLog(deps, r, localDate, { status: 'failed', error: e instanceof Error ? e.message.slice(0, 300) : 'błąd' });
    return 'błąd wysyłki';
  }
}
