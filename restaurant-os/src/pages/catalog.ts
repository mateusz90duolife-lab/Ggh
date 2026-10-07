import { insert } from '../api/db.js';
import { h, mount } from '../dom.js';
import { CATALOG } from '../lib/catalog.js';
import type { CatalogItem } from '../lib/catalog.js';
import { errorMessage } from '../lib/errors.js';
import { normalize, plural } from '../lib/format.js';
import { unitLabel } from '../lib/units.js';
import type { PageCtx } from '../router.js';
import { loadCatalog } from '../state.js';
import type { Category, Product } from '../types.js';
import { backLink, button, errorState, skeleton } from '../ui/components.js';
import { toast } from '../ui/toast.js';

/**
 * Katalog z ilustracjami: mięsa, warzywa, zupy, przyprawy, sosy. Manager zaznacza kafelki
 * i jednym przyciskiem dodaje produkty (oraz brakujące kategorie) do magazynu lokalu.
 */
export async function catalogPage(c: PageCtx): Promise<void> {
  c.setTitle('Katalog produktów');
  const host = h('div', { class: 'page' }, backLink('#/magazyn', 'Magazyn'), skeleton(4));
  mount(c.el, host);

  let products: Product[] = [];
  let categories: Category[] = [];
  let current = CATALOG[0]?.category ?? '';
  const selected = new Set<CatalogItem>();

  const chipsEl = h('div', { class: 'chips chips-scroll', role: 'tablist', 'aria-label': 'Kategorie katalogu' });
  const tilesEl = h('div', { class: 'tiles', role: 'group' });
  const hintEl = h(
    'div',
    { class: 'notice notice-info', hidden: true },
    'Wszystkie produkty z tej kategorii są już w magazynie. Dotknij kafelka, aby zamówić produkt albo dodać / odjąć ze stanu — albo otwórz ',
    h('a', { href: '#/produkty' }, 'Produkty'),
    ', żeby zaznaczyć kilka naraz.',
  );
  const countEl = h('span');
  const addBtn = button('', { size: 'lg', block: true, onClick: () => add() });
  addBtn.replaceChildren(countEl);
  const selectAllBtn = button('Zaznacz wszystkie', { variant: 'soft', size: 'sm', onClick: () => toggleAll() });

  const existing = () => new Set(products.map((p) => normalize(p.name)));

  function drawChips() {
    chipsEl.replaceChildren(
      ...CATALOG.map((g) => {
        const n = g.items.filter((it) => selected.has(it)).length;
        return h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: `chip${g.category === current ? ' chip-active' : ''}`,
            'aria-selected': String(g.category === current),
            onclick: () => {
              current = g.category;
              draw();
            },
          },
          `${g.icon} ${g.category}${n ? ` (${n})` : ''}`,
        );
      }),
    );
  }

  function drawTiles() {
    const have = existing();
    const group = CATALOG.find((g) => g.category === current);
    const idByName = new Map(products.map((p) => [normalize(p.name), p.id]));
    const items = group?.items ?? [];
    const allIn = items.length > 0 && items.every((it) => have.has(normalize(it.name)));
    hintEl.hidden = !allIn;
    tilesEl.replaceChildren(
      ...items.map((it) => {
        const inStock = have.has(normalize(it.name));
        const on = selected.has(it);
        // produkt już jest w magazynie: kafelek prowadzi do „Produkty” (zamów, dodaj, odejmij)
        if (inStock)
          return h(
            'a',
            {
              class: 'tile tile-have',
              href: `#/produkty?produkt=${idByName.get(normalize(it.name)) ?? ''}`,
              'aria-label': `${it.name} — już w magazynie, otwórz`,
            },
            h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, it.icon),
            h('span', null, it.name),
            h('span', { class: 'tile-sub' }, '✓ w magazynie'),
          );
        return h(
          'button',
          {
            type: 'button',
            class: `tile${on ? ' tile-selected' : ''}`,
            'aria-pressed': String(on),
            'aria-label': `${it.name}, ${unitLabel(it.unit)}`,
            onclick: () => {
              if (on) selected.delete(it);
              else selected.add(it);
              draw();
            },
          },
          h('span', { class: 'tile-icon', 'aria-hidden': 'true' }, it.icon),
          h('span', null, it.name),
          h('span', { class: 'tile-sub' }, unitLabel(it.unit)),
        );
      }),
    );
    const free = (group?.items ?? []).filter((it) => !have.has(normalize(it.name)));
    selectAllBtn.hidden = free.length === 0;
    selectAllBtn.textContent = free.every((it) => selected.has(it)) ? 'Odznacz wszystkie' : 'Zaznacz wszystkie';
  }

  function toggleAll() {
    const have = existing();
    const free = (CATALOG.find((g) => g.category === current)?.items ?? []).filter(
      (it) => !have.has(normalize(it.name)),
    );
    const all = free.every((it) => selected.has(it));
    for (const it of free) {
      if (all) selected.delete(it);
      else selected.add(it);
    }
    draw();
  }

  function draw() {
    drawChips();
    drawTiles();
    const n = selected.size;
    countEl.textContent = n
      ? `Dodaj ${n} ${plural(n, 'produkt', 'produkty', 'produktów')} do magazynu`
      : 'Zaznacz produkty do dodania';
  }

  async function add() {
    const items = [...selected];
    if (!items.length) {
      toast('Najpierw zaznacz produkty (dotknij kafelki).', 'info');
      return;
    }
    const catByName = new Map(categories.map((x) => [normalize(x.name), x.id]));
    const groupOf = new Map(CATALOG.flatMap((g) => g.items.map((it) => [it, g.category] as const)));
    const missing = [...new Set(items.map((it) => groupOf.get(it) ?? ''))].filter(
      (name) => name && !catByName.has(normalize(name)),
    );
    if (missing.length) {
      const maxOrder = categories.reduce((m, x) => Math.max(m, x.sort_order), 0);
      const created = await insert<Category>(
        'product_categories',
        missing.map((name, i) => ({ name, sort_order: maxOrder + i + 1 })),
      );
      for (const x of created) catByName.set(normalize(x.name), x.id);
    }
    const have = existing();
    const rows = items
      .filter((it) => !have.has(normalize(it.name)))
      .map((it) => ({
        name: it.name,
        unit: it.unit,
        icon: it.icon,
        minimum_stock: 0,
        category_id: catByName.get(normalize(groupOf.get(it) ?? '')) ?? null,
      }));
    if (rows.length) await insert('products', rows);
    selected.clear();
    toast(
      `Dodano ${rows.length} ${plural(rows.length, 'produkt', 'produkty', 'produktów')}. Minimalny stan ustawisz w karcie produktu.`,
      'ok',
    );
    await load();
  }

  async function load() {
    try {
      const cat = await loadCatalog();
      if (!c.isAlive()) return;
      products = cat.products;
      categories = cat.categories;
      mount(
        host,
        backLink('#/magazyn', 'Magazyn'),
        h(
          'p',
          { class: 'muted', style: 'margin:0' },
          'Dotknij kafelki, aby zaznaczyć nowe produkty, i dodaj je jednym przyciskiem. Produkty oznaczone „✓ w magazynie” otwierają ekran Produkty (zamów, dodaj, odejmij).',
        ),
        chipsEl,
        hintEl,
        h('div', { class: 'row-actions', style: 'justify-content:flex-end' }, selectAllBtn),
        tilesEl,
        h('div', { class: 'sticky-actions' }, addBtn),
      );
      draw();
    } catch (e) {
      if (c.isAlive())
        mount(
          host,
          backLink('#/magazyn', 'Magazyn'),
          errorState(errorMessage(e), () => void load()),
        );
    }
  }
  await load();
}
