import { callFunction, eq, insert, list, one, rpc, update } from '../api/db.js';
import { h, icon, mount } from '../dom.js';
import { guessIcon, productIcon } from '../lib/catalog.js';
import { ApiError, errorMessage } from '../lib/errors.js';
import { formatDate, formatDateTime, formatPLN, formatQty, normalize, plural } from '../lib/format.js';
import {
  aliasKey,
  matchProduct,
  receiptRows,
  toCsv,
  toPurchaseLine,
  toTsv,
  unitForNewProduct,
} from '../lib/receipt.js';
import type { ReceiptItem, ScanResult } from '../lib/receipt.js';
import { UNITS, unitLabel } from '../lib/units.js';
import { parseMoney, parseQuantity } from '../lib/validate.js';
import { navigate } from '../router.js';
import type { PageCtx } from '../router.js';
import { loadCatalog, today, tz } from '../state.js';
import type { Category, Product, Supplier } from '../types.js';
import {
  backLink,
  button,
  emptyState,
  errorState,
  field,
  sectionHeader,
  selectInput,
  skeleton,
  textInput,
} from '../ui/components.js';
import { toast } from '../ui/toast.js';

const MAX_PHOTOS = 4;
const MAX_SIDE = 2000;
const NEW = '__new';

interface Photo {
  media_type: 'image/jpeg';
  data: string;
  preview: string;
}
interface ScanRow {
  id: string;
  store: string | null;
  receipt_date: string | null;
  total: number | string | null;
  items: ReceiptItem[];
  purchase_id: string | null;
  created_at: string;
}

/** Zdjęcie → JPEG o dłuższym boku ≤ 2000 px (mniej danych do wysłania, nadal czytelny paragon). */
async function preparePhoto(file: File): Promise<Photo> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Nie można odczytać tego zdjęcia. Zrób zdjęcie aparatem albo wybierz plik JPG/PNG.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Przeglądarka nie obsługuje obróbki zdjęć.');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1), preview: url };
}

function download(name: string, content: string, type: string) {
  const a = h('a', { href: URL.createObjectURL(new Blob([content], { type })), download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export async function scannerPage(c: PageCtx): Promise<void> {
  c.setTitle('Skaner paragonów');
  const host = h('div', { class: 'page' }, backLink('#/zakupy', 'Zakupy'), skeleton(4));
  mount(c.el, host);

  let products: Product[] = [];
  let categories: Category[] = [];
  let suppliers: Supplier[] = [];
  let aliases = new Map<string, string>();
  let recent: ScanRow[] = [];
  const photos: Photo[] = [];

  try {
    const [cat, sup, al, rec] = await Promise.all([
      loadCatalog(),
      list<Supplier>('suppliers', { select: 'id,name,active', params: { active: eq(true) }, order: 'name.asc' }),
      list<{ alias: string; product_id: string }>('product_aliases', { select: 'alias,product_id', limit: 2000 }),
      loadRecent(),
    ]);
    products = cat.products;
    categories = cat.categories;
    suppliers = sup;
    aliases = new Map(al.map((a) => [a.alias, a.product_id]));
    recent = rec;
  } catch (e) {
    mount(
      host,
      backLink('#/zakupy', 'Zakupy'),
      errorState(errorMessage(e), () => c.refresh()),
    );
    return;
  }
  if (!c.isAlive()) return;

  function loadRecent() {
    return list<ScanRow>('receipt_scans', {
      select: 'id,store,receipt_date,total,items,purchase_id,created_at',
      order: 'created_at.desc',
      limit: 10,
    });
  }

  const catName = new Map(categories.map((x) => [x.id, x.name]));
  const productName = (id: string | null | undefined) => products.find((p) => p.id === id)?.name ?? '';

  // ---------------------------------------------------------------- zdjęcia
  const thumbs = h('div', { class: 'thumbs' });
  const camera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Zrób zdjęcie' });
  const gallery = h('input', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': 'Wybierz zdjęcia' });
  const scanBtn = button('Odczytaj paragon', { size: 'lg', block: true, icon: 'search', onClick: () => scan() });
  const status = h('div', { class: 'muted', 'aria-live': 'polite' });
  const resultHost = h('div');
  const recentHost = h('div');

  async function addFiles(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      if (photos.length >= MAX_PHOTOS) {
        toast(`Maksymalnie ${MAX_PHOTOS} zdjęcia jednego paragonu.`, 'info');
        break;
      }
      try {
        photos.push(await preparePhoto(f));
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    }
    drawThumbs();
  }
  camera.addEventListener('change', () => {
    void addFiles((camera as HTMLInputElement).files).then(() => ((camera as HTMLInputElement).value = ''));
  });
  gallery.addEventListener('change', () => {
    void addFiles((gallery as HTMLInputElement).files).then(() => ((gallery as HTMLInputElement).value = ''));
  });

  function drawThumbs() {
    thumbs.replaceChildren(
      ...photos.map((p, i) =>
        h(
          'div',
          { class: 'thumb' },
          h('img', { src: p.preview, alt: `Zdjęcie ${i + 1}` }),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn',
              'aria-label': `Usuń zdjęcie ${i + 1}`,
              onclick: () => {
                photos.splice(i, 1);
                drawThumbs();
              },
            },
            icon('x', 18),
          ),
        ),
      ),
    );
    scanBtn.hidden = photos.length === 0;
  }

  async function scan() {
    if (!photos.length) return;
    status.textContent = 'Czytam paragon… To trwa zwykle 10–40 sekund.';
    mount(resultHost);
    try {
      const res = await callFunction<ScanResult>('scan-receipt', {
        images: photos.map((p) => ({ media_type: p.media_type, data: p.data })),
      });
      status.textContent = '';
      if (!res.readable || !res.items.length) {
        mount(
          resultHost,
          h(
            'div',
            { class: 'notice notice-error', role: 'alert' },
            res.notes ||
              'Nie znalazłem pozycji na zdjęciu. Zrób wyraźne zdjęcie całego paragonu, na płasko i w dobrym świetle.',
          ),
        );
        return;
      }
      photos.length = 0;
      drawThumbs();
      showResult(res.scan_id, res, null);
      recent = await loadRecent().catch(() => recent);
      drawRecent();
    } catch (e) {
      status.textContent = '';
      throw e;
    }
  }

  // ---------------------------------------------------------------- wynik: edytowalna tabela
  function showResult(scanId: string | null, res: Omit<ScanResult, 'scan_id'>, purchaseId: string | null) {
    const items: ReceiptItem[] = res.items.map((it) => {
      const known = it.product_id && products.some((p) => p.id === it.product_id && p.active);
      return {
        ...it,
        product_id: known ? it.product_id : (matchProduct(it, products, aliases).product?.id ?? null),
        skip: it.skip ?? false,
      };
    });
    const saved = !!purchaseId;
    const tbody = h('tbody');
    const tfoot = h('tfoot');
    const checkEl = h('div');

    const dateIn = textInput({ type: 'date', value: res.date ?? today() });
    const docIn = textInput({ value: res.document_number, maxLength: 60, placeholder: 'np. numer paragonu' });
    const guessSupplier = suppliers.find(
      (s) => res.store && normalize(res.store).includes(normalize(s.name).split(' ')[0] ?? '\u0000'),
    );
    const supplierSel = selectInput(
      [{ value: '', label: 'Bez dostawcy' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
      guessSupplier?.id ?? '',
    );
    const confirmBox = h('input', { type: 'checkbox', id: 'rc_confirm', checked: true });

    function productOptions(it: ReceiptItem): HTMLSelectElement {
      const sel = h(
        'select',
        { class: 'input', 'aria-label': `Produkt dla: ${it.name}` },
        h('option', { value: '' }, '— wybierz produkt —'),
        h('option', { value: NEW }, `➕ Nowy produkt: ${it.name_guess}`),
        products
          .filter((p) => p.active)
          .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
          .map((p) =>
            h(
              'option',
              { value: p.id },
              `${productIcon(p, catName.get(p.category_id ?? ''))} ${p.name} (${unitLabel(p.unit)})`,
            ),
          ),
      );
      sel.value = it.product_id ?? '';
      sel.disabled = saved;
      return sel;
    }

    async function createProduct(it: ReceiptItem): Promise<string | null> {
      const name = (it.name_guess || it.name).slice(0, 80);
      const row = { name, unit: unitForNewProduct(it), icon: guessIcon(name), minimum_stock: 0 };
      try {
        const [p] = await insert<Product>('products', row);
        if (p) {
          products.push({ ...p, icon: row.icon });
          return p.id;
        }
      } catch (e) {
        if (!(e instanceof ApiError && e.code === '23505')) throw e;
      }
      const fresh = (await loadCatalog()).products;
      products = fresh;
      return fresh.find((p) => normalize(p.name) === normalize(name))?.id ?? null;
    }

    function numIn(value: number, onSet: (n: number) => void, label: string, digits = 2): HTMLInputElement {
      const el = h('input', {
        class: 'input num',
        type: 'text',
        inputMode: 'decimal',
        value: digits === 3 ? formatQty(value) : value.toFixed(2).replace('.', ','),
        'aria-label': label,
        disabled: saved,
      });
      el.addEventListener('change', () => {
        const r = digits === 3 ? parseQuantity(el.value) : parseMoney(el.value);
        if (!r.ok) {
          toast(r.error, 'error');
          return;
        }
        onSet(r.value);
        drawRows();
      });
      return el;
    }

    function drawRows() {
      tbody.replaceChildren(
        ...items.map((it, idx) => {
          const sel = productOptions(it);
          sel.addEventListener('change', () => {
            if (sel.value === NEW) {
              sel.disabled = true;
              void createProduct(it)
                .then((id) => {
                  it.product_id = id;
                  if (id) toast(`Dodano produkt: ${productName(id)}`, 'ok');
                })
                .catch((e) => toast(errorMessage(e), 'error'))
                .finally(drawRows);
              return;
            }
            it.product_id = sel.value || null;
            drawRows();
          });
          const p = products.find((x) => x.id === it.product_id);
          const line = p ? toPurchaseLine(it, p.unit) : null;
          const skip = h('input', {
            type: 'checkbox',
            checked: !!it.skip,
            disabled: saved,
            'aria-label': `Pomiń: ${it.name}`,
          });
          skip.addEventListener('change', () => {
            it.skip = (skip as HTMLInputElement).checked;
            drawRows();
          });
          const unitSel = selectInput(
            UNITS.map((u) => ({ value: u, label: unitLabel(u) })),
            it.unit,
          );
          unitSel.classList.add('num');
          unitSel.disabled = saved;
          unitSel.setAttribute('aria-label', `Jednostka: ${it.name}`);
          unitSel.addEventListener('change', () => {
            it.unit = (unitSel as HTMLSelectElement).value as ReceiptItem['unit'];
            drawRows();
          });
          return h(
            'tr',
            { class: it.skip ? 'row-skip' : '' },
            h('td', { class: 'cell-lp' }, String(idx + 1)),
            h(
              'td',
              { class: 'cell-product', style: 'min-width:220px' },
              sel,
              h(
                'div',
                { class: 'raw-name' },
                `Paragon: ${it.name}`,
                it.uncertain ? h('span', { class: 'badge badge-low', style: 'margin-left:6px' }, 'sprawdź') : null,
              ),
              line && (line.warning || p?.unit !== it.unit)
                ? h(
                    'div',
                    { class: line.warning ? 'field-error' : 'raw-name' },
                    line.warning ?? `Do magazynu: ${formatQty(line.quantity)} ${unitLabel(p?.unit ?? '')}`,
                  )
                : null,
            ),
            h(
              'td',
              { 'data-label': 'Ilość' },
              numIn(
                it.quantity,
                (n) => {
                  it.quantity = n;
                  it.total = Math.round(n * it.unit_price * 100) / 100;
                },
                `Ilość: ${it.name}`,
                3,
              ),
            ),
            h('td', { 'data-label': 'J.m.' }, unitSel),
            h(
              'td',
              { 'data-label': 'Cena jedn.' },
              numIn(
                it.unit_price,
                (n) => {
                  it.unit_price = n;
                  it.total = Math.round(n * it.quantity * 100) / 100;
                },
                `Cena: ${it.name}`,
              ),
            ),
            h(
              'td',
              { 'data-label': 'Wartość' },
              numIn(
                it.total,
                (n) => {
                  it.total = n;
                  it.unit_price = it.quantity > 0 ? Math.round((n / it.quantity) * 10000) / 10000 : n;
                },
                `Wartość: ${it.name}`,
              ),
            ),
            h('td', { 'data-label': 'VAT' }, it.vat_rate === null ? '—' : `${it.vat_rate}%`),
            h('td', { 'data-label': 'Pomiń' }, skip),
          );
        }),
      );
      const sum = Math.round(items.filter((i) => !i.skip).reduce((s, i) => s + i.total, 0) * 100) / 100;
      tfoot.replaceChildren(
        h(
          'tr',
          null,
          h('td', { colspan: '5' }, 'Razem pozycje'),
          h('td', null, formatPLN(sum)),
          h('td', { colspan: '2' }),
        ),
      );
      const diff = res.total !== null ? Math.round((res.total - sum) * 100) / 100 : 0;
      mount(
        checkEl,
        res.total !== null && Math.abs(diff) > 0.05 && !items.some((i) => i.skip)
          ? h(
              'div',
              { class: 'notice notice-error' },
              `Suma pozycji (${formatPLN(sum)}) różni się od sumy na paragonie (${formatPLN(res.total)}) o ${formatPLN(diff)}. Sprawdź ilości i ceny.`,
            )
          : res.total !== null
            ? h('div', { class: 'notice notice-ok' }, `Suma na paragonie: ${formatPLN(res.total)}`)
            : null,
      );
    }

    const table = h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'receipt-table' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', null, 'Lp.'),
            h('th', null, 'Produkt'),
            h('th', null, 'Ilość'),
            h('th', null, 'J.m.'),
            h('th', null, 'Cena jedn.'),
            h('th', null, 'Wartość'),
            h('th', null, 'VAT'),
            h('th', null, 'Pomiń'),
          ),
        ),
        tbody,
        tfoot,
      ),
    );

    const rows = () => receiptRows(items, productName);
    const fileBase = `paragon-${(res.date ?? today()).replace(/-/g, '')}${
      res.store
        ? `-${normalize(res.store)
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 30)}`
        : ''
    }`;

    async function save() {
      const active = items.filter((i) => !i.skip);
      if (!active.length) {
        toast('Wszystkie pozycje są pominięte.', 'error');
        return;
      }
      const missing = items.map((i, n) => (!i.skip && !i.product_id ? n + 1 : 0)).filter(Boolean);
      if (missing.length) {
        toast(
          `Przypisz produkt w ${plural(missing.length, 'wierszu', 'wierszach', 'wierszach')}: ${missing.join(', ')} — albo zaznacz „Pomiń”.`,
          'error',
        );
        return;
      }
      const lines = active.map((it) => {
        const p = products.find((x) => x.id === it.product_id) as Product;
        const l = toPurchaseLine(it, p.unit);
        return { product_id: p.id, quantity: l.quantity, unit_price_net: l.unit_price_net, vat_rate: l.vat_rate };
      });
      const bad = lines.find((l) => !(l.quantity > 0));
      if (bad) {
        toast('Ilość w każdej pozycji musi być większa od zera.', 'error');
        return;
      }
      if (scanId) await update('receipt_scans', { id: eq(scanId) }, { items });
      const pid = await rpc<string>(scanId ? 'create_purchase_from_receipt' : 'create_purchase', {
        p_supplier_id: (supplierSel as HTMLSelectElement).value || null,
        p_purchase_date: (dateIn as HTMLInputElement).value || today(),
        p_document_number: (docIn as HTMLInputElement).value || (res.store ? `Paragon ${res.store}` : 'Paragon'),
        p_note: res.store ? `Ze skanu paragonu: ${res.store}` : 'Ze skanu paragonu',
        p_items: lines,
        p_confirm: (confirmBox as HTMLInputElement).checked,
        ...(scanId ? { p_receipt_id: scanId } : {}),
      });
      const pairs = active
        .filter((it) => it.product_id)
        .map((it) => ({ alias: aliasKey(it.name), product_id: it.product_id }));
      if (pairs.length) await rpc('save_receipt_aliases', { p_pairs: pairs }).catch(() => undefined);
      toast(
        (confirmBox as HTMLInputElement).checked
          ? 'Zapisano zakup i dodano towar do magazynu.'
          : 'Zapisano zakup jako szkic.',
        'ok',
      );
      navigate(`/zakupy/${pid}`);
    }

    const saveBtn = button('Zapisz jako zakup', { size: 'lg', block: true, icon: 'cart', onClick: () => save() });
    drawRows();
    mount(
      resultHost,
      h(
        'section',
        { class: 'card', 'aria-label': 'Odczytany paragon' },
        h(
          'div',
          { class: 'section-head', style: 'margin:0' },
          h('h2', null, res.store || 'Paragon'),
          h(
            'span',
            { class: 'muted' },
            `${res.date ? formatDate(res.date) : 'data nieznana'} · ${items.length} ${plural(items.length, 'pozycja', 'pozycje', 'pozycji')}`,
          ),
        ),
        res.notes ? h('div', { class: 'notice notice-info' }, res.notes) : null,
        h(
          'p',
          { class: 'muted small', style: 'margin:4px 0' },
          'Sprawdź tabelę: możesz poprawić ilość, cenę i przypisany produkt. Ceny z paragonu są brutto.',
        ),
        table,
        checkEl,
        h(
          'div',
          { class: 'row-actions' },
          button('Kopiuj tabelę', {
            size: 'sm',
            variant: 'soft',
            icon: 'copy',
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(toTsv(rows()));
                toast('Skopiowano — wklej do arkusza (Excel, Google Sheets).', 'ok');
              } catch {
                toast('Nie udało się skopiować. Użyj „Pobierz CSV”.', 'error');
              }
            },
          }),
          button('Pobierz CSV', {
            size: 'sm',
            variant: 'soft',
            icon: 'download',
            onClick: () => download(`${fileBase}.csv`, toCsv(rows()), 'text/csv;charset=utf-8'),
          }),
        ),
        saved
          ? h(
              'div',
              { class: 'notice notice-ok' },
              'Ten paragon jest już zapisany jako zakup. ',
              h('a', { href: `#/zakupy/${purchaseId}` }, 'Zobacz zakup'),
            )
          : scanId
            ? h(
                'div',
                { class: 'form' },
                h('div', { class: 'form-row' }, field('Data zakupu', dateIn).el, field('Dostawca', supplierSel).el),
                field('Numer dokumentu', docIn).el,
                h(
                  'label',
                  { class: 'check check-neutral', for: 'rc_confirm' },
                  confirmBox,
                  h('span', null, 'Od razu dodaj towar do magazynu'),
                ),
                saveBtn,
              )
            : null,
      ),
    );
    resultHost.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------------------------------------------------------------- ostatnie skany
  function openScan(r: ScanRow) {
    showResult(
      r.id,
      {
        readable: true,
        store: r.store ?? '',
        date: r.receipt_date,
        document_number: '',
        total: r.total === null ? null : Number(r.total),
        items: r.items,
        items_total: 0,
        notes: '',
      },
      r.purchase_id,
    );
  }

  function drawRecent() {
    mount(
      recentHost,
      sectionHeader('Ostatnie paragony'),
      recent.length === 0
        ? emptyState('Brak zeskanowanych paragonów', 'Zrób zdjęcie paragonu, a aplikacja zrobi z niego tabelę.')
        : h(
            'div',
            { class: 'card card-flush' },
            recent.map((r) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'item item-btn',
                  onclick: () => openScan(r),
                },
                h('span', { class: 'prod-icon', 'aria-hidden': 'true' }, '🧾'),
                h(
                  'div',
                  { class: 'item-main' },
                  h('div', { class: 'item-title' }, r.store || 'Paragon'),
                  h(
                    'div',
                    { class: 'item-sub' },
                    `${r.receipt_date ? formatDate(r.receipt_date) : formatDateTime(r.created_at, tz())} · ${r.items.length} ${plural(r.items.length, 'pozycja', 'pozycje', 'pozycji')}${r.total !== null ? ` · ${formatPLN(r.total)}` : ''}`,
                  ),
                ),
                r.purchase_id
                  ? h('span', { class: 'badge badge-ok' }, icon('check', 14), 'zapisany')
                  : h('span', { class: 'badge badge-low' }, 'do zapisu'),
              ),
            ),
          ),
    );
  }

  mount(
    host,
    backLink('#/zakupy', 'Zakupy'),
    h(
      'section',
      { class: 'card', 'aria-label': 'Zdjęcie paragonu' },
      h(
        'p',
        { style: 'margin:0' },
        'Zrób zdjęcie paragonu — aplikacja odczyta, co kupiono, w jakiej ilości i za ile, i zrobi z tego tabelę. ',
        h('span', { class: 'muted' }, 'Długi paragon sfotografuj w częściach (do 4 zdjęć).'),
      ),
      h(
        'div',
        { class: 'row-actions' },
        h('label', { class: 'btn btn-primary file-btn' }, icon('plus', 20), h('span', null, 'Zrób zdjęcie'), camera),
        h('label', { class: 'btn btn-soft file-btn' }, icon('download', 20), h('span', null, 'Z galerii'), gallery),
      ),
      thumbs,
      scanBtn,
      status,
    ),
    resultHost,
    recentHost,
  );
  drawThumbs();
  drawRecent();

  const open = c.query.get('skan');
  if (open) {
    const r = recent.find((x) => x.id === open) ?? (await one<ScanRow>('receipt_scans', { params: { id: eq(open) } }));
    if (r && c.isAlive()) openScan(r);
  }
}
