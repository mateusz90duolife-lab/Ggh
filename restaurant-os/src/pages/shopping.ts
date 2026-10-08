import { callFunction, eq, insert, list, one, rpc, update } from '../api/db.js';
import { h, icon, mount } from '../dom.js';
import { ApiError, errorMessage } from '../lib/errors.js';
import { formatDate, formatDateTime, formatPLN, formatQty, plural } from '../lib/format.js';
import { buildShoppingText } from '../lib/shoppingText.js';
import { unitLabel } from '../lib/units.js';
import { parseMoney, parseQuantity, validatePurchaseDate, validateText } from '../lib/validate.js';
import { navigate } from '../router.js';
import type { PageCtx } from '../router.js';
import { loadCatalog, nameOf, today, tz } from '../state.js';
import { loadOpenShortages } from '../data.js';
import type { Category, Product, PurchaseItem, PurchaseOverview, ShoppingItem, Shortage, Supplier } from '../types.js';
import {
  backLink,
  button,
  emptyState,
  errorState,
  field,
  guarded,
  numberInput,
  qtyText,
  sectionHeader,
  selectInput,
  skeleton,
  tabs,
  textInput,
} from '../ui/components.js';
import { confirmDialog, openModal } from '../ui/modal.js';
import { productPicker } from '../ui/picker.js';
import type { PickerHandle } from '../ui/picker.js';
import { toast } from '../ui/toast.js';

const num = (v: number | string) => Number(v);
const STATUS_LABEL = { draft: 'Szkic', confirmed: 'Zatwierdzony', cancelled: 'Anulowany' } as const;

export async function shoppingPage(c: PageCtx): Promise<void> {
  c.setTitle('Zakupy');
  let tab = c.query.get('tab') === 'historia' ? 'historia' : 'lista';
  const host = h('div');
  const tabsHost = h('div');
  mount(c.el, h('div', { class: 'page' }, tabsHost, host));

  function drawTabs() {
    mount(
      tabsHost,
      tabs(
        [
          { id: 'lista', label: 'Lista zakupów' },
          { id: 'historia', label: 'Historia zakupów' },
        ],
        tab,
        (id) => {
          tab = id;
          drawTabs();
          void load();
        },
      ),
    );
  }
  drawTabs();

  async function load() {
    mount(host, skeleton(5));
    try {
      if (tab === 'lista') await drawList();
      else await drawHistory();
    } catch (e) {
      if (c.isAlive())
        mount(
          host,
          errorState(errorMessage(e), () => void load()),
        );
    }
  }

  async function drawList() {
    const [items, shortages, catalog] = await Promise.all([
      list<ShoppingItem>('shopping_list', { select: '*', order: 'category_order.asc.nullslast,product_name.asc' }),
      loadOpenShortages(500),
      loadCatalog(),
    ]);
    if (!c.isAlive()) return;
    const names = new Map(catalog.products.map((p) => [p.id, p.name]));
    const byProduct = new Map<string, Shortage[]>();
    for (const s of shortages) byProduct.set(s.product_id, [...(byProduct.get(s.product_id) ?? []), s]);
    const selected = new Set<string>();
    const expanded = new Set<string>();
    const area = h('div');
    const buyBar = h('div');

    function drawBuy() {
      mount(
        buyBar,
        selected.size
          ? h(
              'div',
              { class: 'sticky-actions' },
              button(`Zapisz zakup z zaznaczonych (${selected.size})`, {
                size: 'lg',
                block: true,
                icon: 'check',
                onClick: () => goBuy(),
              }),
            )
          : null,
      );
    }
    function goBuy() {
      const param = items
        .filter((i) => selected.has(i.product_id))
        .map((i) => `${i.product_id}:${formatQty(i.total_quantity).replace(',', '.')}`)
        .join(',');
      navigate(`/zakupy/nowy?items=${encodeURIComponent(param)}`);
    }

    function draw() {
      if (items.length === 0) {
        mount(
          area,
          emptyState(
            'Lista zakupów jest pusta',
            'Gdy ktoś zgłosi brak, pozycja pojawi się tutaj (zgłoszenia tego samego produktu są sumowane).',
          ),
        );
        return;
      }
      const groups = new Map<string, ShoppingItem[]>();
      for (const i of items) groups.set(i.category_name, [...(groups.get(i.category_name) ?? []), i]);
      mount(
        area,
        h(
          'div',
          { class: 'card card-flush' },
          [...groups.entries()].flatMap(([cat, rows]) => [
            h('div', { class: 'group-title' }, cat),
            ...rows.flatMap((i) => {
              const open = expanded.has(i.product_id);
              const reports = byProduct.get(i.product_id) ?? [];
              const box = h('input', {
                type: 'checkbox',
                checked: selected.has(i.product_id),
                'aria-label': `Zaznacz: ${i.product_name}`,
                style: 'width:24px;height:24px;flex-shrink:0',
              });
              box.addEventListener('change', () => {
                if ((box as HTMLInputElement).checked) selected.add(i.product_id);
                else selected.delete(i.product_id);
                drawBuy();
              });
              const row = h(
                'div',
                { class: 'item' },
                box,
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'item-main',
                    style: 'background:none;border:0;text-align:left;padding:0;cursor:pointer',
                    'aria-expanded': String(open),
                    onclick: () => {
                      if (open) expanded.delete(i.product_id);
                      else expanded.add(i.product_id);
                      draw();
                    },
                  },
                  h('div', { class: 'item-title' }, i.product_name),
                  h(
                    'div',
                    { class: 'item-sub' },
                    `${i.reports_count} ${plural(i.reports_count, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń')}`,
                  ),
                ),
                i.urgent ? h('span', { class: 'badge badge-urgent' }, icon('alert', 14), 'PILNE') : null,
                h('div', { class: 'item-end' }, qtyText(i.total_quantity, i.unit)),
              );
              const detail = open
                ? reports.map((s) =>
                    h(
                      'div',
                      { class: 'item', style: 'background:var(--bg);min-height:48px;padding-left:52px' },
                      h(
                        'div',
                        { class: 'item-main' },
                        h(
                          'div',
                          { class: 'item-sub' },
                          `${nameOf(s.reported_by)} · ${formatDateTime(s.created_at, tz())}${s.note ? ` · ${s.note}` : ''}`,
                        ),
                      ),
                      h('div', { class: 'item-end small' }, qtyText(s.quantity, s.unit)),
                      h(
                        'button',
                        {
                          type: 'button',
                          class: 'icon-btn',
                          'aria-label': `Anuluj zgłoszenie ${names.get(s.product_id) ?? ''}`,
                          onclick: () => void cancel(s),
                        },
                        icon('x', 18),
                      ),
                    ),
                  )
                : [];
              return [row, ...detail];
            }),
          ]),
        ),
      );
    }

    async function cancel(s: Shortage) {
      if (
        !(await confirmDialog({
          title: 'Anulować zgłoszenie?',
          message: `${names.get(s.product_id) ?? 'Produkt'} — ${qtyText(s.quantity, s.unit)} (zgłosił(a): ${nameOf(s.reported_by)}).`,
          confirmLabel: 'Anuluj zgłoszenie',
          cancelLabel: 'Zostaw',
          danger: true,
        }))
      )
        return;
      try {
        await update('shortages', { id: eq(s.id) }, { status: 'cancelled', resolved_at: new Date().toISOString() });
        toast('Zgłoszenie anulowane.', 'ok');
        await load();
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    }

    const text = () => buildShoppingText(items, today());
    const actions = h(
      'div',
      { class: 'row-actions' },
      button('Zaznacz wszystko', {
        size: 'sm',
        variant: 'soft',
        onClick: () => {
          if (selected.size === items.length) selected.clear();
          else items.forEach((i) => selected.add(i.product_id));
          draw();
          drawBuy();
        },
      }),
      button('Kopiuj listę', {
        size: 'sm',
        variant: 'soft',
        icon: 'copy',
        disabled: items.length === 0,
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(text());
            toast('Skopiowano listę zakupów.', 'ok');
          } catch {
            toast('Nie udało się skopiować. Użyj „Udostępnij”.', 'error');
          }
        },
      }),
      typeof navigator.share === 'function'
        ? button('Udostępnij', {
            size: 'sm',
            variant: 'soft',
            disabled: items.length === 0,
            onClick: async () => {
              try {
                await navigator.share({ title: 'Lista zakupów', text: text() });
              } catch {
                /* anulowano */
              }
            },
          })
        : null,
      button('Wyślij mailem', {
        size: 'sm',
        variant: 'soft',
        icon: 'mail',
        onClick: async () => {
          const r = await callFunction<{ sent_to: number }>('daily-shopping-summary', {});
          toast(`Wysłano listę na ${r.sent_to} ${plural(r.sent_to, 'adres', 'adresy', 'adresów')} e-mail.`, 'ok');
        },
      }),
    );
    mount(
      host,
      h(
        'div',
        { class: 'page' },
        actions,
        area,
        buyBar,
        h(
          'div',
          { class: 'row-actions' },
          h(
            'a',
            { class: 'btn btn-ghost', href: '#/zakupy/nowy' },
            icon('plus', 20),
            h('span', null, 'Nowy zakup bez listy'),
          ),
          h('a', { class: 'btn btn-soft', href: '#/skaner' }, icon('search', 20), h('span', null, 'Skanuj paragon')),
        ),
      ),
    );
    draw();
  }

  async function drawHistory() {
    const rows = await list<PurchaseOverview>('purchases_overview', {
      select: '*',
      order: 'purchase_date.desc,created_at.desc',
      limit: 100,
    });
    if (!c.isAlive()) return;
    mount(
      host,
      h(
        'div',
        { class: 'page' },
        h(
          'div',
          { class: 'row-actions' },
          h('a', { class: 'btn btn-primary', href: '#/zakupy/nowy' }, icon('plus', 20), h('span', null, 'Nowy zakup')),
          h('a', { class: 'btn btn-soft', href: '#/skaner' }, icon('search', 20), h('span', null, 'Skanuj paragon')),
        ),
        rows.length
          ? h(
              'div',
              { class: 'card card-flush' },
              rows.map((p) =>
                h(
                  'a',
                  { class: 'item', href: `#/zakupy/${p.id}` },
                  h(
                    'div',
                    { class: 'item-main' },
                    h('div', { class: 'item-title' }, p.supplier_name ?? 'Bez dostawcy'),
                    h(
                      'div',
                      { class: 'item-sub' },
                      `${formatDate(p.purchase_date)}${p.document_number ? ` · ${p.document_number}` : ''} · ${p.items_count} ${plural(p.items_count, 'pozycja', 'pozycje', 'pozycji')}`,
                    ),
                  ),
                  h(
                    'span',
                    {
                      class: `badge ${p.status === 'confirmed' ? 'badge-ok' : p.status === 'draft' ? 'badge-low' : 'badge-neutral'}`,
                    },
                    STATUS_LABEL[p.status],
                  ),
                  h('div', { class: 'item-end' }, formatPLN(p.total_gross)),
                ),
              ),
            )
          : emptyState('Brak zakupów', 'Zapisz pierwszy zakup — zwiększy stan magazynu i zapisze cenę.'),
      ),
    );
  }

  await load();
}

// ------------------------------------------------------------------ szczegóły zakupu
export async function purchasePage(c: PageCtx): Promise<void> {
  const id = c.params.id ?? '';
  c.setTitle('Zakup');
  const host = h('div', { class: 'page' }, backLink('#/zakupy?tab=historia', 'Historia zakupów'), skeleton(4));
  mount(c.el, host);

  async function load() {
    try {
      const [p, items, catalog] = await Promise.all([
        one<PurchaseOverview & { confirmed_by: string | null; confirmed_at: string | null; note: string | null }>(
          'purchases_overview',
          { select: '*', params: { id: eq(id) } },
        ),
        list<PurchaseItem>('purchase_items', {
          select: 'id,product_id,quantity,unit_price_net,vat_rate',
          params: { purchase_id: eq(id) },
        }),
        loadCatalog(),
      ]);
      if (!c.isAlive()) return;
      if (!p) {
        mount(host, backLink('#/zakupy?tab=historia', 'Historia zakupów'), emptyState('Nie znaleziono zakupu'));
        return;
      }
      const prod = new Map(catalog.products.map((x) => [x.id, x]));
      c.setTitle(`Zakup ${formatDate(p.purchase_date)}`);
      mount(
        host,
        backLink('#/zakupy?tab=historia', 'Historia zakupów'),
        h(
          'div',
          { class: 'card' },
          h(
            'div',
            { class: 'section-head', style: 'margin:0 0 8px' },
            h('h2', null, p.supplier_name ?? 'Bez dostawcy'),
            h(
              'span',
              {
                class: `badge ${p.status === 'confirmed' ? 'badge-ok' : p.status === 'draft' ? 'badge-low' : 'badge-neutral'}`,
              },
              STATUS_LABEL[p.status],
            ),
          ),
          h(
            'dl',
            { class: 'kv' },
            h('dt', null, 'Data zakupu'),
            h('dd', null, formatDate(p.purchase_date)),
            p.document_number ? h('dt', null, 'Numer dokumentu') : null,
            p.document_number ? h('dd', null, p.document_number) : null,
            h('dt', null, 'Razem netto'),
            h('dd', null, formatPLN(p.total_net)),
            h('dt', null, 'Razem brutto'),
            h('dd', null, formatPLN(p.total_gross)),
            p.confirmed_at ? h('dt', null, 'Zatwierdzono') : null,
            p.confirmed_at ? h('dd', null, `${nameOf(p.confirmed_by)}, ${formatDateTime(p.confirmed_at, tz())}`) : null,
          ),
        ),
        sectionHeader('Pozycje'),
        h(
          'div',
          { class: 'card card-flush' },
          items.map((it) => {
            const pr = prod.get(it.product_id);
            const gross = num(it.quantity) * num(it.unit_price_net) * (1 + num(it.vat_rate) / 100);
            return h(
              'div',
              { class: 'item' },
              h(
                'div',
                { class: 'item-main' },
                h('div', { class: 'item-title' }, pr?.name ?? 'Produkt'),
                h(
                  'div',
                  { class: 'item-sub' },
                  `${qtyText(it.quantity, pr?.unit ?? '')} × ${formatPLN(it.unit_price_net)} netto, VAT ${formatQty(it.vat_rate)}%`,
                ),
              ),
              h('div', { class: 'item-end' }, formatPLN(gross)),
            );
          }),
        ),
        p.status === 'draft'
          ? h(
              'div',
              { class: 'row-actions' },
              button('Zatwierdź zakup', {
                icon: 'check',
                onClick: async () => {
                  await rpc('confirm_purchase', { p_purchase_id: id });
                  toast('Zakup zatwierdzony. Stan magazynu zaktualizowany.', 'ok');
                  await load();
                },
              }),
              button('Anuluj szkic', {
                variant: 'ghost',
                onClick: async () => {
                  if (
                    !(await confirmDialog({
                      title: 'Anulować szkic?',
                      message: 'Szkic zostanie oznaczony jako anulowany. Stan magazynu się nie zmieni.',
                      confirmLabel: 'Anuluj szkic',
                      cancelLabel: 'Zostaw',
                      danger: true,
                    }))
                  )
                    return;
                  await update('purchases', { id: eq(id) }, { status: 'cancelled' });
                  toast('Szkic anulowany.', 'ok');
                  await load();
                },
              }),
            )
          : p.status === 'confirmed'
            ? h(
                'p',
                { class: 'muted small' },
                'Zatwierdzony zakup jest niezmienny. Pomyłkę popraw korektą stanu w karcie produktu.',
              )
            : null,
      );
    } catch (e) {
      if (c.isAlive())
        mount(
          host,
          backLink('#/zakupy?tab=historia', 'Historia zakupów'),
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
}

// ------------------------------------------------------------------ nowy zakup
interface Line {
  picker: PickerHandle;
  qty: HTMLInputElement;
  price: HTMLInputElement;
  vat: HTMLSelectElement;
  el: HTMLElement;
  unit: HTMLElement;
  total: HTMLElement;
}

export async function newPurchasePage(c: PageCtx): Promise<void> {
  c.setTitle('Nowy zakup');
  mount(c.el, h('div', { class: 'page' }, backLink('#/zakupy', 'Zakupy'), skeleton(4)));
  let products: Product[];
  let categories: Category[];
  let suppliers: Supplier[];
  try {
    const [cat, sup] = await Promise.all([
      loadCatalog(),
      list<Supplier>('suppliers', { select: 'id,name,active', params: { active: eq(true) }, order: 'name.asc' }),
    ]);
    products = cat.products;
    categories = cat.categories;
    suppliers = sup;
  } catch (e) {
    mount(
      c.el,
      h(
        'div',
        { class: 'page' },
        backLink('#/zakupy', 'Zakupy'),
        errorState(errorMessage(e), () => c.refresh()),
      ),
    );
    return;
  }
  if (!c.isAlive()) return;

  const supplierSel = selectInput(
    [{ value: '', label: 'Bez dostawcy' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
    '',
  );
  const supplier = field('Dostawca', supplierSel);
  const dateInput = textInput({ type: 'date', value: today() });
  const date = field('Data zakupu', dateInput);
  const doc = field('Numer dokumentu (opcjonalnie)', textInput({ maxLength: 60, placeholder: 'np. FV/123/2026' }));
  const linesHost = h('div', { class: 'form' });
  const totals = h('div', { class: 'card' });
  const lines: Line[] = [];

  function recalc() {
    let net = 0;
    let gross = 0;
    for (const l of lines) {
      const q = parseQuantity(l.qty.value);
      const p = parseMoney(l.price.value);
      if (q.ok && p.ok) {
        const n = q.value * p.value;
        const g = n * (1 + Number(l.vat.value) / 100);
        net += n;
        gross += g;
        l.total.textContent = `Pozycja: ${formatPLN(g)} brutto`;
      } else l.total.textContent = '';
    }
    mount(
      totals,
      h('div', { class: 'total' }, h('span', null, 'Razem brutto'), h('span', null, formatPLN(gross))),
      h('div', { class: 'muted small' }, `netto ${formatPLN(net)}`),
    );
  }

  function addLine(pre?: { product: Product; qty: number }) {
    const picker = productPicker({
      products,
      categories,
      label: 'Produkt',
      onChange: (p) => {
        unit.textContent = p ? unitLabel(p.unit) : '—';
        recalc();
      },
    });
    const qty = numberInput({ value: pre ? formatQty(pre.qty) : '' });
    const price = numberInput({ placeholder: '0,00' });
    const vat = selectInput(
      [0, 5, 8, 23].map((v) => ({ value: String(v), label: `${v}%` })),
      '5',
    );
    const unit = h('span', { class: 'muted' }, '—');
    const total = h('div', { class: 'item-sub' });
    const removeBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost btn-sm',
        onclick: () => {
          const i = lines.indexOf(line);
          if (i >= 0) lines.splice(i, 1);
          line.el.remove();
          recalc();
        },
      },
      icon('trash', 18),
      h('span', null, 'Usuń pozycję'),
    );
    const qf = field('Ilość', qty);
    const pf = field('Cena netto za jedn.', price);
    const vf = field('VAT', vat);
    const el = h(
      'div',
      { class: 'line-item' },
      picker.el,
      h('div', { class: 'line-grid' }, qf.el, pf.el, vf.el),
      h(
        'div',
        { class: 'section-head', style: 'margin:0' },
        h('span', { class: 'muted small' }, 'Jednostka: ', unit),
        total,
      ),
      removeBtn,
    );
    const line: Line = { picker, qty, price, vat, el, unit, total };
    for (const i of [qty, price, vat]) i.addEventListener('input', recalc);
    vat.addEventListener('change', recalc);
    lines.push(line);
    linesHost.appendChild(el);
    if (pre) {
      picker.set(pre.product);
      qf.setError(null);
    }
    recalc();
    return line;
  }

  // prefill z listy zakupów: ?items=productId:qty,productId:qty
  const prefill = (c.query.get('items') ?? '').split(',').filter(Boolean);
  for (const part of prefill) {
    const [pid, q] = part.split(':');
    const prod = products.find((p) => p.id === pid);
    const qn = parseQuantity(q ?? '');
    if (prod && qn.ok) addLine({ product: prod, qty: qn.value });
  }
  if (lines.length === 0) addLine();

  function openNewSupplier() {
    const name = field('Nazwa dostawcy', textInput({ maxLength: 120, required: true }));
    const m = openModal({ title: 'Nowy dostawca', body: null });
    const save = button('Dodaj dostawcę', { type: 'submit', size: 'lg', block: true });
    const f = h('form', { class: 'form', novalidate: true }, name.el, save);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      void guarded(save, async () => {
        const v = validateText((name.input as HTMLInputElement).value, 'nazwę dostawcy', 1, 120);
        name.setError(v.ok ? null : v.error);
        if (!v.ok) return;
        try {
          const [row] = await insert<Supplier>('suppliers', { name: v.value });
          if (row) {
            supplierSel.appendChild(h('option', { value: row.id }, row.name));
            supplierSel.value = row.id;
          }
        } catch (err) {
          if (err instanceof ApiError && err.code === '23505') {
            name.setError('Dostawca o tej nazwie już istnieje.');
            return;
          }
          throw err;
        }
        m.close();
        toast('Dodano dostawcę.', 'ok');
      });
    });
    m.el.querySelector('.modal-body')?.replaceChildren(f);
    name.input.focus();
  }

  // Uwaga: przycisk jest już chroniony przed podwójnym kliknięciem przez button() — nie opakowujemy drugi raz.
  async function submit(confirm: boolean) {
    const d = validatePurchaseDate(dateInput.value, today());
    date.setError(d.ok ? null : d.error);
    let ok = d.ok;
    const items: { product_id: string; quantity: number; unit_price_net: number; vat_rate: number }[] = [];
    for (const l of lines) {
      const p = l.picker.get();
      l.picker.setError(p ? null : 'Wybierz produkt z listy.');
      const q = parseQuantity(l.qty.value);
      const pr = parseMoney(l.price.value);
      const fields = l.el.querySelectorAll('.field');
      const setErr = (idx: number, msg: string | null) => {
        const f = fields[idx];
        const e = f?.querySelector('.field-error');
        if (e) e.textContent = msg ?? '';
      };
      setErr(1, q.ok ? null : q.error);
      setErr(2, pr.ok ? null : pr.error);
      if (!p || !q.ok || !pr.ok) {
        ok = false;
        continue;
      }
      items.push({ product_id: p.id, quantity: q.value, unit_price_net: pr.value, vat_rate: Number(l.vat.value) });
    }
    if (lines.length === 0) {
      toast('Dodaj co najmniej jedną pozycję.', 'error');
      return;
    }
    if (!ok) {
      toast('Popraw zaznaczone pola.', 'error');
      return;
    }
    if (
      confirm &&
      !(await confirmDialog({
        title: 'Zatwierdzić zakup?',
        message: `Stan magazynu zwiększy się o ${items.length} ${plural(items.length, 'pozycję', 'pozycje', 'pozycji')}, a otwarte braki tych produktów zostaną zamknięte. Zatwierdzonego zakupu nie można edytować.`,
        confirmLabel: 'Zatwierdź zakup',
      }))
    )
      return;
    const pid = await rpc<string>('create_purchase', {
      p_supplier_id: supplierSel.value || null,
      p_purchase_date: d.ok ? d.value : null,
      p_document_number: (doc.input as HTMLInputElement).value || null,
      p_note: null,
      p_items: items,
      p_confirm: confirm,
    });
    toast(confirm ? 'Zakup zatwierdzony. Stan magazynu zaktualizowany.' : 'Zapisano szkic zakupu.', 'ok');
    navigate(`/zakupy/${pid}`);
  }

  const confirmBtn = button('Zatwierdź zakup', { size: 'lg', block: true, icon: 'check', onClick: () => submit(true) });
  const draftBtn = button('Szkic', {
    variant: 'ghost',
    title: 'Zapisz jako szkic (bez zmiany stanu magazynu)',
    onClick: () => submit(false),
  });

  mount(
    c.el,
    h(
      'div',
      { class: 'page' },
      backLink('#/zakupy', 'Zakupy'),
      h(
        'div',
        { class: 'card form' },
        h(
          'div',
          { class: 'row-actions', style: 'align-items:flex-end' },
          h('div', { style: 'flex:1;min-width:180px' }, supplier.el),
          button('Nowy', { size: 'sm', variant: 'soft', icon: 'plus', onClick: openNewSupplier }),
        ),
        h('div', { class: 'form-row' }, date.el, doc.el),
      ),
      sectionHeader('Pozycje'),
      linesHost,
      button('Dodaj pozycję', { variant: 'soft', icon: 'plus', onClick: () => void addLine() }),
      totals,
      h('div', { class: 'sticky-actions' }, h('div', { class: 'action-row' }, confirmBtn, draftBtn)),
    ),
  );
}
