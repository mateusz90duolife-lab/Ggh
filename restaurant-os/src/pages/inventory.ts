import { eq, insert, list, one, rpc, update } from '../api/db.js';
import { getSession } from '../api/auth.js';
import { h, icon, mount } from '../dom.js';
import { ApiError, errorMessage } from '../lib/errors.js';
import { formatDateTime, formatPLN, formatQty, normalize, plural } from '../lib/format.js';
import { storage } from '../lib/storage.js';
import { ART_KEYS, artIcon } from '../lib/catalog.js';
import { artEl, artImg } from '../ui/art.js';
import { UNITS, unitLabel } from '../lib/units.js';
import { parseQuantity, parseSignedQuantity, validateText } from '../lib/validate.js';
import { navigate } from '../router.js';
import type { PageCtx } from '../router.js';
import { isManager, loadCatalog, nameOf, tz } from '../state.js';
import type { Category, Movement, Product, ProductStock, StockStatus } from '../types.js';
import {
  backLink,
  button,
  chip,
  emptyState,
  errorState,
  fab,
  field,
  guarded,
  numberInput,
  qtyText,
  sectionHeader,
  selectInput,
  skeleton,
  stockBadge,
  stockBar,
  textInput,
} from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

const STOCK_COLS = 'product_id,name,unit,category_id,minimum_stock,active,stock,status,icon';
const num = (v: number | string) => Number(v);

function groupByCategory<T extends { category_id: string | null }>(rows: T[], categories: Category[]) {
  const names = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string, { name: string; order: number; rows: T[] }>();
  for (const r of rows) {
    const cat = r.category_id ? names.get(r.category_id) : undefined;
    const key = cat?.id ?? '_other';
    const g = groups.get(key) ?? { name: cat?.name ?? 'Inne', order: cat?.sort_order ?? 9999, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pl'));
}

// ---------------------------------------------------------------- lista magazynu
export async function inventoryPage(c: PageCtx): Promise<void> {
  c.setTitle('Magazyn');
  let filter: 'all' | 'problems' = c.query.get('filtr') === 'braki' ? 'problems' : 'all';
  let query = '';
  let showInactive = false;
  let stock: ProductStock[] = [];
  let categories: Category[] = [];

  const search = h('input', {
    class: 'input',
    type: 'search',
    placeholder: 'Szukaj produktu…',
    'aria-label': 'Szukaj produktu',
    autocomplete: 'off',
  });
  const chipsHost = h('div', { class: 'chips' });
  const listHost = h('div');
  const head = h(
    'div',
    { class: 'page' },
    h(
      'div',
      { class: 'row-actions' },
      h('div', { style: 'flex:1;min-width:200px' }, search),
      isManager()
        ? button('Produkt', {
            icon: 'plus',
            variant: 'soft',
            onClick: () => openProductForm(null, categories, () => void load()),
          })
        : null,
      isManager()
        ? h('a', { class: 'btn btn-soft', href: '#/katalog' }, icon('list', 20), h('span', null, 'Katalog'))
        : null,
    ),
    chipsHost,
    listHost,
  );
  mount(c.el, head, fab('ZGŁOŚ BRAK', '#/braki/nowy'));
  mount(listHost, skeleton(6));

  search.addEventListener('input', () => {
    query = (search as HTMLInputElement).value;
    drawList();
  });

  function drawChips() {
    mount(
      chipsHost,
      chip('Wszystkie', {
        active: filter === 'all',
        onClick: () => {
          filter = 'all';
          drawChips();
          drawList();
        },
      }),
      chip('Niski stan i braki', {
        active: filter === 'problems',
        onClick: () => {
          filter = 'problems';
          drawChips();
          drawList();
        },
      }),
      isManager()
        ? chip('Pokaż nieaktywne', {
            active: showInactive,
            onClick: () => {
              showInactive = !showInactive;
              drawChips();
              drawList();
            },
          })
        : null,
    );
  }

  function drawList() {
    const n = normalize(query);
    let rows = stock.filter((s) => (showInactive ? true : s.active));
    if (n) rows = rows.filter((s) => normalize(s.name).includes(n));
    if (filter === 'problems') rows = rows.filter((s) => s.status === 'low' || s.status === 'out');
    if (rows.length === 0) {
      mount(
        listHost,
        stock.length === 0
          ? emptyState(
              'Magazyn jest pusty',
              isManager()
                ? 'Dodaj produkty z gotowego katalogu (przycisk „Katalog”) albo pojedynczo przyciskiem „Produkt”.'
                : 'Manager musi najpierw dodać produkty.',
            )
          : emptyState(
              'Nic nie znaleziono',
              filter === 'problems' ? 'Brak produktów poniżej minimum.' : 'Zmień wyszukiwanie.',
            ),
      );
      return;
    }
    mount(
      listHost,
      h(
        'div',
        { class: 'card card-flush' },
        groupByCategory(rows, categories).flatMap((g) => [
          h('div', { class: 'group-title' }, g.name),
          ...g.rows
            .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
            .map((s) =>
              h(
                'a',
                { class: 'item', href: `#/magazyn/${s.product_id}` },
                artEl(s, g.name),
                h(
                  'div',
                  { class: 'item-main stock-row' },
                  h(
                    'div',
                    null,
                    h(
                      'div',
                      { class: 'item-title' },
                      s.name,
                      s.active
                        ? null
                        : h('span', { class: 'badge badge-neutral', style: 'margin-left:8px' }, 'nieaktywny'),
                    ),
                    h('div', { class: 'item-sub' }, `minimum: ${qtyText(s.minimum_stock, s.unit)}`),
                  ),
                  h('div', { class: 'stock-qty' }, qtyText(s.stock, s.unit)),
                  stockBar(num(s.stock), num(s.minimum_stock), s.status),
                ),
                stockBadge(s.status),
              ),
            ),
        ]),
      ),
    );
  }

  async function load() {
    try {
      const [st, cat] = await Promise.all([
        list<ProductStock>('product_stock', { select: STOCK_COLS, order: 'name.asc' }),
        loadCatalog().then((x) => x.categories),
      ]);
      if (!c.isAlive()) return;
      stock = st;
      categories = cat;
      drawChips();
      drawList();
    } catch (e) {
      if (c.isAlive())
        mount(
          listHost,
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
  c.poll(load, 20000);
}

// ---------------------------------------------------------------- formularz produktu
export function openProductForm(existing: Product | null, categories: Category[], onSaved: () => void): void {
  const name = field(
    'Nazwa',
    textInput({ value: existing?.name ?? '', maxLength: 80, required: true, placeholder: 'np. Mleko 3,2%' }),
  );
  const category = field(
    'Kategoria',
    selectInput(
      [{ value: '', label: 'Bez kategorii' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
      existing?.category_id ?? '',
    ),
  );
  const unitSel = selectInput(
    UNITS.map((u) => ({ value: u, label: unitLabel(u) })),
    existing?.unit ?? 'kg',
  );
  if (existing) unitSel.disabled = true;
  const unit = field('Jednostka', unitSel, {
    hint: existing ? 'Jednostki nie można zmienić po utworzeniu produktu.' : undefined,
  });
  const min = field(
    'Minimalny stan (alert poniżej)',
    numberInput({ value: existing ? formatQty(existing.minimum_stock) : '0' }),
  );
  // ręczny wybór ilustracji („@klucz”); null = dobierz automatycznie po nazwie
  let chosenIcon: string | null = existing?.icon ?? null;
  const iconHost = h('div', { class: 'icon-choices', role: 'radiogroup', 'aria-label': 'Ilustracja' });
  function drawIcons() {
    const nameNow = (name.input as HTMLInputElement).value;
    iconHost.replaceChildren(
      h(
        'button',
        {
          type: 'button',
          class: `icon-choice icon-auto${chosenIcon ? '' : ' tile-selected'}`,
          role: 'radio',
          'aria-checked': String(!chosenIcon),
          'aria-label': 'Ilustracja automatyczna (po nazwie)',
          onclick: () => {
            chosenIcon = null;
            drawIcons();
          },
        },
        artEl({ name: nameNow || '?' }),
        h('span', null, 'Auto'),
      ),
      ...ART_KEYS.map((key) =>
        h(
          'button',
          {
            type: 'button',
            class: `icon-choice${chosenIcon === artIcon(key) ? ' tile-selected' : ''}`,
            role: 'radio',
            'aria-checked': String(chosenIcon === artIcon(key)),
            'aria-label': `Ilustracja ${key}`,
            onclick: () => {
              chosenIcon = artIcon(key);
              drawIcons();
            },
          },
          artImg(key),
        ),
      ),
    );
  }
  drawIcons();
  name.input.addEventListener('change', drawIcons);
  const activeBox = h('input', { type: 'checkbox', id: 'p_active', checked: existing?.active ?? true });
  const m = openModal({ title: existing ? 'Edytuj produkt' : 'Nowy produkt', body: null });
  const save = button(existing ? 'Zapisz zmiany' : 'Dodaj produkt', { type: 'submit', size: 'lg', block: true });
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    name.el,
    category.el,
    h('div', { class: 'form-row' }, unit.el, min.el),
    h(
      'details',
      { class: 'field' },
      h('summary', { class: 'muted', style: 'cursor:pointer;padding:6px 0' }, 'Ilustracja (obrazek produktu)'),
      iconHost,
    ),
    existing
      ? h(
          'label',
          { class: 'check', for: 'p_active', style: '--x:1' },
          activeBox,
          h('span', null, 'Produkt aktywny (widoczny w zgłoszeniach)'),
        )
      : null,
    save,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const n = validateText((name.input as HTMLInputElement).value, 'nazwę', 1, 80);
      name.setError(n.ok ? null : n.error);
      const q = parseQuantity((min.input as HTMLInputElement).value, { allowZero: true });
      min.setError(q.ok ? null : q.error);
      if (!n.ok || !q.ok) return;
      const row = {
        name: n.value,
        category_id: (category.input as HTMLSelectElement).value || null,
        minimum_stock: q.value,
        icon: chosenIcon,
        ...(existing
          ? { active: (activeBox as HTMLInputElement).checked }
          : { unit: (unitSel as HTMLSelectElement).value }),
      };
      try {
        if (existing) await update('products', { id: eq(existing.id) }, row);
        else await insert('products', row);
      } catch (err) {
        if (err instanceof ApiError && err.code === '23505') {
          name.setError('Produkt o tej nazwie już istnieje.');
          return;
        }
        throw err;
      }
      m.close();
      toast(existing ? 'Zapisano zmiany.' : `Dodano produkt: ${n.value}`, 'ok');
      onSaved();
    });
  });
  m.el.querySelector('.modal-body')?.replaceChildren(form);
  name.input.focus();
}

// ---------------------------------------------------------------- karta produktu
const MOVE_LABEL: Record<Movement['type'], string> = {
  purchase: 'Zakup',
  consumption: 'Zużycie',
  waste: 'Odpad',
  adjustment: 'Korekta',
  count_correction: 'Inwentaryzacja',
};

export async function productPage(c: PageCtx): Promise<void> {
  const id = c.params.id ?? '';
  c.setTitle('Produkt');
  const host = h('div', { class: 'page' }, backLink('#/magazyn', 'Magazyn'), skeleton(4));
  mount(c.el, host);
  let typeFilter: Movement['type'] | 'all' = 'all';

  async function load() {
    try {
      const mgr = isManager();
      const [stock, cat] = await Promise.all([
        one<ProductStock>('product_stock', { select: STOCK_COLS, params: { product_id: eq(id) } }),
        loadCatalog(),
      ]);
      if (!c.isAlive()) return;
      if (!stock) {
        mount(host, backLink('#/magazyn', 'Magazyn'), emptyState('Nie znaleziono produktu', 'Mógł zostać usunięty.'));
        return;
      }
      c.setTitle(stock.name);
      const product = cat.products.find((p) => p.id === id) ?? null;
      const [moves, price] = mgr
        ? await Promise.all([
            list<Movement>('inventory_movements', {
              select: 'id,product_id,type,quantity_delta,note,created_by,created_at',
              params: { product_id: eq(id) },
              order: 'created_at.desc',
              limit: 100,
            }),
            one<{ last_price: number | string; last_date: string; change_pct: number | string | null }>('price_trend', {
              select: 'last_price,last_date,change_pct',
              params: { product_id: eq(id) },
            }),
          ])
        : [[], null];
      if (!c.isAlive()) return;
      draw(stock, product, cat.categories, moves, price);
    } catch (e) {
      if (c.isAlive())
        mount(
          host,
          backLink('#/magazyn', 'Magazyn'),
          errorState(errorMessage(e), () => void load()),
        );
    }
  }

  function draw(
    stock: ProductStock,
    product: Product | null,
    categories: Category[],
    moves: Movement[],
    price: { last_price: number | string; last_date: string; change_pct: number | string | null } | null,
  ) {
    const catName = categories.find((x) => x.id === stock.category_id)?.name ?? 'Bez kategorii';
    const shown = typeFilter === 'all' ? moves : moves.filter((m) => m.type === typeFilter);
    const st = stock.status as StockStatus;
    const actions = isManager()
      ? h(
          'div',
          { class: 'row-actions' },
          button('Zużycie', { variant: 'soft', onClick: () => openMovement(stock, 'consumption', () => void load()) }),
          button('Odpad', { variant: 'soft', onClick: () => openMovement(stock, 'waste', () => void load()) }),
          button('Korekta', { variant: 'soft', onClick: () => openMovement(stock, 'adjustment', () => void load()) }),
          product
            ? button('Edytuj', {
                variant: 'ghost',
                icon: 'edit',
                onClick: () => openProductForm(product, categories, () => void load()),
              })
            : null,
        )
      : null;
    mount(
      host,
      backLink('#/magazyn', 'Magazyn'),
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'section-head', style: 'margin:0 0 8px' },
          h('h2', { style: 'font-size:22px' }, stock.name),
          stockBadge(st),
        ),
        h('div', { style: 'font-size:34px;font-weight:850;margin:4px 0 10px' }, qtyText(stock.stock, stock.unit)),
        stockBar(num(stock.stock), num(stock.minimum_stock), st),
        h(
          'dl',
          { class: 'kv', style: 'margin:14px 0 0' },
          h('dt', null, 'Minimum'),
          h('dd', null, qtyText(stock.minimum_stock, stock.unit)),
          h('dt', null, 'Kategoria'),
          h('dd', null, catName),
          price ? h('dt', null, 'Ostatnia cena netto') : null,
          price
            ? h(
                'dd',
                null,
                `${formatPLN(price.last_price)} / ${unitLabel(stock.unit)}`,
                price.change_pct !== null && num(price.change_pct) !== 0
                  ? h(
                      'span',
                      { class: num(price.change_pct) > 0 ? 'neg' : 'pos', style: 'margin-left:6px' },
                      `${num(price.change_pct) > 0 ? '↑' : '↓'} ${formatQty(Math.abs(num(price.change_pct)))}%`,
                    )
                  : null,
              )
            : null,
        ),
      ),
      actions,
      h(
        'a',
        { class: 'btn btn-danger btn-block', href: `#/braki/nowy?produkt=${id}` },
        icon('plus', 20),
        h('span', null, 'Zgłoś brak tego produktu'),
      ),
      isManager()
        ? [
            sectionHeader('Historia ruchów'),
            h(
              'div',
              { class: 'chips' },
              chip('Wszystko', {
                active: typeFilter === 'all',
                onClick: () => {
                  typeFilter = 'all';
                  draw(stock, product, categories, moves, price);
                },
              }),
              ...(['purchase', 'consumption', 'waste', 'adjustment', 'count_correction'] as const).map((t) =>
                chip(MOVE_LABEL[t], {
                  active: typeFilter === t,
                  onClick: () => {
                    typeFilter = t;
                    draw(stock, product, categories, moves, price);
                  },
                }),
              ),
            ),
            shown.length
              ? h(
                  'div',
                  { class: 'card card-flush' },
                  shown.map((m) =>
                    h(
                      'div',
                      { class: 'item' },
                      h(
                        'div',
                        { class: 'item-main' },
                        h('div', { class: 'item-title' }, MOVE_LABEL[m.type]),
                        h(
                          'div',
                          { class: 'item-sub' },
                          `${nameOf(m.created_by)} · ${formatDateTime(m.created_at, tz())}${m.note ? ` · ${m.note}` : ''}`,
                        ),
                      ),
                      h(
                        'div',
                        { class: `item-end ${num(m.quantity_delta) >= 0 ? 'pos' : 'neg'}` },
                        `${num(m.quantity_delta) > 0 ? '+' : ''}${formatQty(m.quantity_delta)} ${unitLabel(stock.unit)}`,
                      ),
                    ),
                  ),
                )
              : emptyState('Brak ruchów', 'Ruchy pojawią się po zakupie, zużyciu, odpadzie lub korekcie.'),
          ]
        : null,
    );
  }
  await load();
}

// ---------------------------------------------------------------- ruch magazynowy
export function openMovement(
  stock: ProductStock,
  type: 'consumption' | 'waste' | 'adjustment',
  onSaved: () => void,
): void {
  const titles = { consumption: 'Zużycie', waste: 'Odpad', adjustment: 'Korekta stanu' } as const;
  const qty = field(
    type === 'adjustment'
      ? `Ilość ze znakiem (np. -2 lub +3), ${unitLabel(stock.unit)}`
      : `Ilość (${unitLabel(stock.unit)})`,
    numberInput({ placeholder: type === 'adjustment' ? '-2' : '1' }),
  );
  const note = field(
    type === 'adjustment' ? 'Powód korekty (wymagany)' : 'Uwaga (opcjonalnie)',
    textInput({ maxLength: 500 }),
  );
  const preview = h(
    'div',
    { class: 'notice notice-info', 'aria-live': 'polite' },
    `Stan obecnie: ${qtyText(stock.stock, stock.unit)}`,
  );
  const m = openModal({ title: `${titles[type]} — ${stock.name}`, body: null });
  const save = button('Zapisz', { type: 'submit', size: 'lg', block: true });

  function delta(): number | null {
    const raw = (qty.input as HTMLInputElement).value;
    if (type === 'adjustment') {
      const r = parseSignedQuantity(raw);
      return r.ok ? r.value : null;
    }
    const r = parseQuantity(raw);
    return r.ok ? -r.value : null;
  }
  qty.input.addEventListener('input', () => {
    const d = delta();
    preview.textContent =
      d === null
        ? `Stan obecnie: ${qtyText(stock.stock, stock.unit)}`
        : `Stan po zapisaniu: ${qtyText(Math.round((num(stock.stock) + d) * 1000) / 1000, stock.unit)}`;
  });

  const form = h('form', { class: 'form', novalidate: true }, qty.el, note.el, preview, save);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void guarded(save, async () => {
      const raw = (qty.input as HTMLInputElement).value;
      const r = type === 'adjustment' ? parseSignedQuantity(raw) : parseQuantity(raw);
      qty.setError(r.ok ? null : r.error);
      const nt = validateText((note.input as HTMLInputElement).value, 'powód', type === 'adjustment' ? 3 : 0, 500);
      note.setError(
        nt.ok
          ? null
          : type === 'adjustment' && !(note.input as HTMLInputElement).value.trim()
            ? 'Podaj powód korekty.'
            : nt.error,
      );
      if (!r.ok || !nt.ok) return;
      const d = type === 'adjustment' ? r.value : -r.value;
      const after = Math.round((num(stock.stock) + d) * 1000) / 1000;
      if (
        after < 0 &&
        !(await confirmDialog({
          title: 'Stan spadnie poniżej zera',
          message: `Po zapisaniu stan wyniesie ${qtyText(after, stock.unit)}. To zwykle oznacza błąd w danych. Zapisać mimo to?`,
          confirmLabel: 'Zapisz mimo to',
          danger: true,
        }))
      )
        return;
      await rpc('record_movement', {
        p_product_id: stock.product_id,
        p_type: type,
        p_quantity_delta: d,
        p_note: nt.value || null,
      });
      m.close();
      toast(
        `Zapisano: ${titles[type].toLowerCase()} ${d > 0 ? '+' : ''}${formatQty(d)} ${unitLabel(stock.unit)}`,
        'ok',
      );
      onSaved();
    });
  });
  m.el.querySelector('.modal-body')?.replaceChildren(form);
  qty.input.focus();
}

// ---------------------------------------------------------------- inwentaryzacja
export async function countPage(c: PageCtx): Promise<void> {
  c.setTitle('Inwentaryzacja');
  const host = h('div', { class: 'page' }, skeleton(5));
  mount(c.el, host);
  let stock: ProductStock[];
  let categories: Category[];
  try {
    [stock, categories] = await Promise.all([
      list<ProductStock>('product_stock', {
        select: STOCK_COLS,
        params: { active: eq(true) },
        order: 'name.asc',
        cache: false,
      }),
      loadCatalog().then((x) => x.categories),
    ]);
  } catch (e) {
    mount(
      host,
      errorState(errorMessage(e), () => c.refresh()),
    );
    return;
  }
  if (!c.isAlive()) return;

  const draftKey = `ros.count.${getSession()?.user.id ?? 'x'}`;
  const draft = storage.getJson<Record<string, string>>(draftKey, {});
  const inputs = new Map<string, HTMLInputElement>();
  const diffEls = new Map<string, HTMLElement>();
  const progress = h('span', { class: 'muted small' });
  const search = h('input', {
    class: 'input',
    type: 'search',
    placeholder: 'Szukaj produktu…',
    'aria-label': 'Szukaj produktu',
    autocomplete: 'off',
  });

  function saveDraft() {
    const d: Record<string, string> = {};
    for (const [id, el] of inputs) if (el.value.trim()) d[id] = el.value;
    if (Object.keys(d).length) storage.setJson(draftKey, d);
    else storage.remove(draftKey);
  }
  function updateDiff(s: ProductStock) {
    const el = inputs.get(s.product_id);
    const out = diffEls.get(s.product_id);
    if (!el || !out) return;
    const r = el.value.trim() ? parseQuantity(el.value, { allowZero: true }) : null;
    if (!r) out.textContent = '';
    else if (!r.ok) {
      out.textContent = r.error;
      out.className = 'item-sub neg';
    } else {
      const d = Math.round((r.value - num(s.stock)) * 1000) / 1000;
      out.textContent = d === 0 ? 'zgodne' : `różnica ${d > 0 ? '+' : ''}${formatQty(d)} ${unitLabel(s.unit)}`;
      out.className = `item-sub ${d === 0 ? '' : d > 0 ? 'pos' : 'neg'}`;
    }
    const filled = [...inputs.values()].filter((i) => i.value.trim()).length;
    progress.textContent = `Policzono: ${filled} z ${stock.length}`;
  }

  const rows = h('div');
  function drawRows() {
    const n = normalize((search as HTMLInputElement).value);
    const shown = stock.filter((s) => !n || normalize(s.name).includes(n));
    mount(
      rows,
      h(
        'div',
        { class: 'card card-flush' },
        groupByCategory(shown, categories).flatMap((g) => [
          h('div', { class: 'group-title' }, g.name),
          ...g.rows.map((s) => {
            let el = inputs.get(s.product_id);
            if (!el) {
              el = numberInput({ placeholder: '—', value: draft[s.product_id] ?? '' });
              el.setAttribute('aria-label', `Stan rzeczywisty: ${s.name}`);
              el.style.maxWidth = '110px';
              el.addEventListener('input', () => {
                updateDiff(s);
                saveDraft();
              });
              inputs.set(s.product_id, el);
              diffEls.set(s.product_id, h('div', { class: 'item-sub' }));
            }
            queueMicrotask(() => updateDiff(s));
            return h(
              'div',
              { class: 'item' },
              h(
                'div',
                { class: 'item-main' },
                h('div', { class: 'item-title' }, s.name),
                h('div', { class: 'item-sub' }, `w systemie: ${qtyText(s.stock, s.unit)}`),
                diffEls.get(s.product_id),
              ),
              el,
              h('span', { class: 'muted', style: 'width:36px' }, unitLabel(s.unit)),
            );
          }),
        ]),
      ),
    );
  }
  search.addEventListener('input', drawRows);

  const submit = button('Zatwierdź inwentaryzację', { size: 'lg', block: true, onClick: () => review() });

  async function review() {
    const items: { product: ProductStock; counted: number }[] = [];
    for (const s of stock) {
      const el = inputs.get(s.product_id);
      if (!el || !el.value.trim()) continue;
      const r = parseQuantity(el.value, { allowZero: true });
      if (!r.ok) {
        toast(`${s.name}: ${r.error}`, 'error');
        el.focus();
        return;
      }
      items.push({ product: s, counted: r.value });
    }
    if (items.length === 0) {
      toast('Wpisz stan rzeczywisty przynajmniej jednego produktu.', 'error');
      return;
    }
    const diffs = items.filter((i) => Math.round((i.counted - num(i.product.stock)) * 1000) !== 0);
    const ok = await confirmDialog({
      title: 'Zatwierdzić inwentaryzację?',
      message: `Policzono ${items.length} ${plural(items.length, 'produkt', 'produkty', 'produktów')}, różnice w ${diffs.length}. ${diffs.length ? 'Stany zostaną skorygowane, a korekty zapisane w historii.' : 'Wszystko się zgadza.'} Produkty bez wpisu nie zostaną zmienione.`,
      confirmLabel: 'Zatwierdź',
    });
    if (!ok) return;
    await rpc('submit_inventory_count', {
      p_items: items.map((i) => ({ product_id: i.product.product_id, counted_qty: i.counted })),
    });
    storage.remove(draftKey);
    toast(`Inwentaryzacja zapisana. Skorygowano: ${diffs.length}.`, 'ok');
    navigate('/magazyn');
  }

  mount(
    host,
    h(
      'p',
      { class: 'muted' },
      'Wpisz stan rzeczywisty tylko tych produktów, które policzyłeś. Wpisy zapisują się na telefonie, więc możesz wrócić później.',
    ),
    search,
    progress,
    rows,
    h('div', { class: 'sticky-actions' }, submit),
  );
  drawRows();
}
