import { authenticate, corsHeaders, json, serviceHeaders } from './http.ts';
import type { Caller, Env, FetchFn } from './types.ts';

/**
 * Skaner paragonów: zdjęcie(a) paragonu -> model Claude (obraz + odpowiedź w schemacie JSON) -> tabela pozycji.
 * Moduł nie importuje SDK — klienta wstrzykuje index.ts (w Deno: oficjalne @anthropic-ai/sdk), dzięki czemu
 * logikę testujemy w Node z atrapą klienta, bez sieci i bez klucza.
 */

export const MODEL = 'claude-opus-5-5';
export const MAX_IMAGES = 4;
const MAX_IMAGE_B64 = 5 * 1024 * 1024; // limit API na jeden obraz
export const DAILY_LIMIT = 60; // skanów na lokal w ciągu 24 h (ochrona przed nadużyciem i kosztami)
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];
const UNITS = ['szt', 'kg', 'g', 'l', 'ml', 'opak', 'but'] as const;
type Unit = (typeof UNITS)[number];

export interface ClaudeBlock {
  type: string;
  text?: string;
}
export interface ClaudeMessage {
  stop_reason: string | null;
  content: ClaudeBlock[];
  model?: string;
}
/** Minimalny interfejs `client.beta.messages` z oficjalnego SDK. */
export interface ClaudeMessages {
  create(params: Record<string, unknown>): Promise<ClaudeMessage>;
}
export type ClaudeErrorKind = 'auth' | 'rate_limit' | 'bad_request' | 'other';

export interface ScanDeps {
  env: Env & { ANTHROPIC_API_KEY?: string };
  fetchFn: FetchFn;
  claude: ClaudeMessages | null;
  classifyError?: (e: unknown) => ClaudeErrorKind;
  now?: () => Date;
}

export interface ReceiptItem {
  name: string;
  name_guess: string;
  quantity: number;
  unit: Unit;
  unit_price: number;
  total: number;
  vat_rate: number | null;
  package_size: number | null;
  package_unit: Unit | null;
  match: string;
  uncertain: boolean;
}
export interface ReceiptResult {
  readable: boolean;
  store: string;
  date: string | null;
  document_number: string;
  total: number | null;
  items: ReceiptItem[];
  notes: string;
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

export const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'store', 'date', 'document_number', 'total', 'items', 'notes'],
  properties: {
    readable: { type: 'boolean', description: 'false, gdy zdjęcie nie jest paragonem/fakturą albo jest nieczytelne' },
    store: { type: 'string', description: 'nazwa sklepu/sprzedawcy, pusty tekst gdy nieznana' },
    date: { type: 'string', description: 'data zakupu YYYY-MM-DD albo pusty tekst' },
    document_number: { type: 'string', description: 'numer paragonu/faktury albo pusty tekst' },
    total: nullable({ type: 'number' }),
    notes: {
      type: 'string',
      description: 'krótka uwaga po polsku dla użytkownika (np. co było nieczytelne), może być pusta',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'name_guess',
          'quantity',
          'unit',
          'unit_price',
          'total',
          'vat_rate',
          'package_size',
          'package_unit',
          'match',
          'uncertain',
        ],
        properties: {
          name: { type: 'string' },
          name_guess: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string', enum: [...UNITS] },
          unit_price: { type: 'number' },
          total: { type: 'number' },
          vat_rate: nullable({ type: 'number' }),
          package_size: nullable({ type: 'number' }),
          package_unit: nullable({ type: 'string', enum: [...UNITS] }),
          match: { type: 'string' },
          uncertain: { type: 'boolean' },
        },
      },
    },
  },
} as const;

export const SYSTEM_PROMPT = `You read photos of shop receipts and invoices (mostly Polish "paragon fiskalny" and "faktura") for a restaurant's purchase records, and return every purchased line item as structured data.

How to read the document:
- Return one item per purchased product line. Skip everything else: headers, NIP, "SPRZEDAŻ OPODATKOWANA", "SUMA PTU", totals, payment, card, change ("RESZTA"), deposits summary, loyalty and marketing lines.
- Polish receipts usually print the quantity and unit price before the line value, e.g. "2 x 4,10 8,20A" or "0,456 x 23,99 10,94C". Here 2 or 0,456 is the quantity, 4,10 or 23,99 the unit price and 8,20 or 10,94 the line total. A fractional quantity on a weighed line means kilograms.
- Discount lines ("RABAT", "OPUST", "PROMOCJA", a negative amount) belong to the product line directly above them: subtract the discount from that item's total, set unit_price = total / quantity, and do not output the discount as its own item.
- The letter after a line value is the VAT group. Map it with the receipt's PTU table (e.g. "PTU A 23,00%"); without a table use the Polish standard A=23, B=8, C=5, D=0. Use null when you cannot tell (e.g. invoices without a rate).
- All amounts are gross prices as printed, in the receipt's currency. Use a dot as the decimal separator in JSON numbers.
- unit: "kg" for weighed goods, otherwise "szt" for pieces, or "l", "opak", "but" when the line clearly sells in that unit. When a piece has a stated size in its name (e.g. "MLEKO 3,2% 1L", "MĄKA 1KG", "SMIETANA 18% 500G") keep the piece count as quantity with unit "szt", and put the size in package_size and package_unit (1 and "l", 1 and "kg", 500 and "g"). Otherwise package_size and package_unit are null.
- name: the line text exactly as printed. name_guess: a short, readable Polish product name with abbreviations expanded and without codes or pack sizes (e.g. "SER GOUDA PLASTRY 150G" -> "Ser gouda w plastrach").
- match: when one of the restaurant's products listed in the message is clearly the same product, copy its name exactly; otherwise an empty string. Do not force a match.
- When the photos show several parts of one long receipt, read them in order and do not repeat lines that appear on two photos.
- Never invent lines you cannot see. If a value is hard to read, give your best reading and set uncertain to true. If the image is not a receipt or invoice, or is unreadable, return readable=false with no items and explain why in notes (in Polish).
- notes: one or two short sentences in Polish for the restaurant manager, only when something needs their attention; otherwise an empty string.`;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ImageIn {
  media_type: MediaType;
  data: string;
}

function parseImages(body: unknown): ImageIn[] {
  const imgs = (body as { images?: unknown } | null)?.images;
  if (!Array.isArray(imgs) || imgs.length === 0) throw new HttpError(400, 'Dodaj zdjęcie paragonu.');
  if (imgs.length > MAX_IMAGES) throw new HttpError(400, `Maksymalnie ${MAX_IMAGES} zdjęcia jednego paragonu.`);
  return imgs.map((raw) => {
    const im = raw as { media_type?: unknown; data?: unknown };
    if (typeof im.media_type !== 'string' || !(MEDIA_TYPES as readonly string[]).includes(im.media_type))
      throw new HttpError(400, 'Nieobsługiwany format zdjęcia (dozwolone: JPG, PNG, WEBP).');
    if (typeof im.data !== 'string' || im.data.length < 100 || !/^[A-Za-z0-9+/]+=*$/.test(im.data))
      throw new HttpError(400, 'Uszkodzone zdjęcie.');
    if (im.data.length > MAX_IMAGE_B64) throw new HttpError(413, 'Zdjęcie jest za duże (maks. 5 MB).');
    return { media_type: im.media_type as MediaType, data: im.data };
  });
}

const num = (v: unknown, digits: number, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const unit = (v: unknown): Unit | null => ((UNITS as readonly string[]).includes(v as string) ? (v as Unit) : null);

/** Data z paragonu: poprawna, nie z przyszłości (tolerancja 1 dzień), nie starsza niż 2 lata. */
export function cleanDate(v: unknown, now: Date): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  const diffDays = (d.getTime() - now.getTime()) / 86_400_000;
  return diffDays > 1 || diffDays < -730 ? null : v;
}

/** Walidacja i porządkowanie odpowiedzi modelu (nigdy nie ufamy jej bez sprawdzenia). */
export function sanitizeResult(raw: unknown, productNames: string[], now: Date): ReceiptResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const known = new Map(productNames.map((n) => [n.toLowerCase(), n]));
  const items: ReceiptItem[] = [];
  for (const it of Array.isArray(r.items) ? r.items.slice(0, 150) : []) {
    const x = (it ?? {}) as Record<string, unknown>;
    const name = text(x.name, 120);
    const quantity = num(x.quantity, 3, 0.001, 100000);
    let total = num(x.total, 2, 0, 1000000);
    let unitPrice = num(x.unit_price, 4, 0, 100000);
    if (!name || quantity === null) continue;
    if (unitPrice === null && total !== null) unitPrice = Math.round((total / quantity) * 10000) / 10000;
    if (total === null && unitPrice !== null) total = Math.round(unitPrice * quantity * 100) / 100;
    if (unitPrice === null || total === null) continue;
    const pkgSize = num(x.package_size, 3, 0.001, 100000);
    const pkgUnit = unit(x.package_unit);
    const match = known.get(text(x.match, 120).toLowerCase()) ?? '';
    items.push({
      name,
      name_guess: text(x.name_guess, 80) || name.slice(0, 80),
      quantity,
      unit: unit(x.unit) ?? 'szt',
      unit_price: unitPrice,
      total,
      vat_rate: num(x.vat_rate, 2, 0, 100),
      package_size: pkgSize !== null && pkgUnit ? pkgSize : null,
      package_unit: pkgSize !== null && pkgUnit ? pkgUnit : null,
      match,
      uncertain: x.uncertain === true,
    });
  }
  return {
    readable: r.readable !== false && items.length > 0,
    store: text(r.store, 120),
    date: cleanDate(r.date, now),
    document_number: text(r.document_number, 60),
    total: num(r.total, 2, 0, 10000000),
    items,
    notes: text(r.notes, 400),
  };
}

export function buildRequest(images: ImageIn[], productNames: string[], withFallbacks = true): Record<string, unknown> {
  const list = productNames.length
    ? productNames.join('\n')
    : '(restauracja nie ma jeszcze produktów — pole match zostaw puste)';
  return {
    model: MODEL,
    max_tokens: 16000,
    ...(withFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((im) => ({
            type: 'image',
            source: { type: 'base64', media_type: im.media_type, data: im.data },
          })),
          {
            type: 'text',
            text:
              `Produkty w magazynie restauracji (do pola match):\n${list}\n\n` +
              (images.length > 1
                ? `To ${images.length} zdjęcia jednego paragonu, w kolejności od góry. Odczytaj wszystkie pozycje.`
                : 'Odczytaj wszystkie pozycje z tego paragonu.'),
          },
        ],
      },
    ],
  };
}

async function countRecentScans(caller: Caller, deps: ScanDeps, now: Date): Promise<number> {
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const r = await deps.fetchFn(
    `${deps.env.SUPABASE_URL}/rest/v1/receipt_scans?restaurant_id=eq.${caller.restaurant_id}` +
      `&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${DAILY_LIMIT + 1}`,
    { headers: serviceHeaders(deps.env) },
  );
  if (!r.ok) throw new Error(`receipt_scans: ${r.status}`);
  return ((await r.json()) as unknown[]).length;
}

async function productNamesOf(caller: Caller, deps: ScanDeps): Promise<string[]> {
  const r = await deps.fetchFn(
    `${deps.env.SUPABASE_URL}/rest/v1/products?restaurant_id=eq.${caller.restaurant_id}&active=is.true` +
      `&select=name&order=name.asc&limit=600`,
    { headers: serviceHeaders(deps.env) },
  );
  if (!r.ok) throw new Error(`products: ${r.status}`);
  return ((await r.json()) as { name: string }[]).map((p) => p.name);
}

async function callClaude(deps: ScanDeps, images: ImageIn[], names: string[]): Promise<ClaudeMessage> {
  const claude = deps.claude as ClaudeMessages;
  const kind = (e: unknown) => deps.classifyError?.(e) ?? 'other';
  try {
    return await claude.create(buildRequest(images, names));
  } catch (e) {
    // Gdyby konto nie miało dostępu do funkcji beta (fallbacks), ponów raz bez niej.
    if (kind(e) === 'bad_request') return await claude.create(buildRequest(images, names, false));
    throw e;
  }
}

export async function handleScanReceipt(req: Request, deps: ScanDeps): Promise<Response> {
  const { env } = deps;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
  if (req.method !== 'POST') return json(req, env, 405, { error: 'Metoda niedozwolona.' });

  try {
    const caller = await authenticate(req, env, deps.fetchFn);
    if (!caller) return json(req, env, 401, { error: 'Brak autoryzacji.' });
    if (caller.role !== 'owner' && caller.role !== 'manager')
      return json(req, env, 403, { error: 'Skaner paragonów jest dostępny dla managera i właściciela.' });
    if (!deps.claude)
      return json(req, env, 503, {
        error:
          'Skaner nie jest jeszcze włączony: właściciel musi dodać klucz ANTHROPIC_API_KEY w ustawieniach Supabase.',
      });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(req, env, 400, { error: 'Nieprawidłowe dane.' });
    }
    const images = parseImages(body);
    const now = deps.now?.() ?? new Date();
    if ((await countRecentScans(caller, deps, now)) >= DAILY_LIMIT)
      return json(req, env, 429, { error: `Osiągnięto limit ${DAILY_LIMIT} skanów na dobę. Spróbuj jutro.` });
    const names = await productNamesOf(caller, deps);

    let msg: ClaudeMessage;
    try {
      msg = await callClaude(deps, images, names);
    } catch (e) {
      const k = deps.classifyError?.(e) ?? 'other';
      console.error('scan-receipt: Claude API', k, e instanceof Error ? e.message : 'błąd');
      if (k === 'auth') return json(req, env, 503, { error: 'Klucz ANTHROPIC_API_KEY jest nieprawidłowy.' });
      if (k === 'rate_limit')
        return json(req, env, 503, { error: 'Usługa odczytu jest chwilowo przeciążona. Spróbuj za minutę.' });
      return json(req, env, 502, { error: 'Nie udało się połączyć z usługą odczytu paragonów. Spróbuj ponownie.' });
    }
    if (msg.stop_reason === 'refusal')
      return json(req, env, 422, { error: 'Nie udało się odczytać tego zdjęcia. Zrób nowe zdjęcie samego paragonu.' });
    if (msg.stop_reason === 'max_tokens')
      return json(req, env, 422, { error: 'Paragon jest za długi na jeden odczyt. Zeskanuj go w dwóch częściach.' });
    const out = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(out);
    } catch {
      return json(req, env, 502, { error: 'Odczyt paragonu się nie powiódł. Spróbuj ponownie.' });
    }
    const result = sanitizeResult(parsed, names, now);

    const ins = await deps.fetchFn(`${env.SUPABASE_URL}/rest/v1/receipt_scans`, {
      method: 'POST',
      headers: serviceHeaders(env, { prefer: 'return=representation' }),
      body: JSON.stringify({
        restaurant_id: caller.restaurant_id,
        created_by: caller.id,
        store: result.store || null,
        receipt_date: result.date,
        total: result.total,
        items: result.items,
        model: msg.model ?? MODEL,
      }),
    });
    if (!ins.ok) throw new Error(`zapis skanu: ${ins.status}`);
    const [row] = (await ins.json()) as { id: string }[];
    const itemsTotal = Math.round(result.items.reduce((s, it) => s + it.total, 0) * 100) / 100;
    return json(req, env, 200, { scan_id: row?.id ?? null, ...result, items_total: itemsTotal });
  } catch (e) {
    if (e instanceof HttpError) return json(req, env, e.status, { error: e.message });
    console.error('scan-receipt', e instanceof Error ? e.message : 'błąd');
    return json(req, env, 500, { error: 'Błąd serwera. Spróbuj ponownie.' });
  }
}
