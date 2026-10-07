import { h } from '../dom.js';
import { normalize } from '../lib/format.js';
import { unitLabel } from '../lib/units.js';
import type { Category, Product } from '../types.js';

export interface PickerHandle {
  el: HTMLElement;
  input: HTMLInputElement;
  get(): Product | null;
  set(p: Product | null): void;
  setError(msg: string | null): void;
}

/**
 * Wyszukiwarka produktu: ignoruje wielkość liter i polskie znaki, najczęściej zgłaszane są na górze.
 * Wartość musi zostać WYBRANA z listy (nie przyjmujemy dowolnego tekstu).
 */
export function productPicker(opts: {
  products: Product[];
  categories: Category[];
  frequency?: Map<string, number>;
  onChange?: (p: Product | null) => void;
  label?: string;
}): PickerHandle {
  const active = opts.products.filter((p) => p.active);
  const catName = new Map(opts.categories.map((c) => [c.id, c.name]));
  const freq = opts.frequency ?? new Map<string, number>();
  let selected: Product | null = null;
  let highlighted = 0;
  let shown: Product[] = [];
  const id = `pick_${Math.random().toString(36).slice(2, 8)}`;

  const input = h('input', {
    class: 'input',
    id,
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'none',
    placeholder: 'Wpisz nazwę produktu…',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-controls': `${id}_list`,
    'aria-autocomplete': 'list',
  });
  const list = h('div', { class: 'picker-list', id: `${id}_list`, role: 'listbox', hidden: true });
  const err = h('div', { class: 'field-error', role: 'alert' });
  const chosen = h('div', { class: 'card', hidden: true });
  const wrap = h(
    'div',
    { class: 'field picker' },
    h('label', { for: id }, opts.label ?? 'Produkt'),
    input,
    list,
    chosen,
    err,
  );

  function candidates(q: string): Product[] {
    const n = normalize(q);
    const base = n ? active.filter((p) => normalize(p.name).includes(n)) : [...active];
    base.sort((a, b) => {
      const sa = n && normalize(a.name).startsWith(n) ? 1 : 0;
      const sb = n && normalize(b.name).startsWith(n) ? 1 : 0;
      return sb - sa || (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pl');
    });
    return base.slice(0, n ? 30 : 8);
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function render() {
    shown = candidates(input.value);
    highlighted = Math.min(highlighted, Math.max(0, shown.length - 1));
    list.replaceChildren(
      ...(shown.length
        ? shown.map((p, i) =>
            h(
              'button',
              {
                type: 'button',
                role: 'option',
                class: `picker-opt${i === highlighted ? ' active' : ''}`,
                'aria-selected': String(i === highlighted),
                onmousedown: (e: Event) => e.preventDefault(), // nie gub fokusu przed wyborem
                onclick: () => choose(p),
              },
              h(
                'span',
                null,
                h('strong', null, p.name),
                h('div', { class: 'item-sub' }, catName.get(p.category_id ?? '') ?? 'Inne'),
              ),
              h('span', { class: 'muted' }, unitLabel(p.unit)),
            ),
          )
        : [h('div', { class: 'picker-opt muted' }, 'Brak pasujących produktów')]),
    );
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function choose(p: Product | null) {
    selected = p;
    err.textContent = '';
    wrap.classList.remove('has-error');
    if (p) {
      input.value = p.name;
      input.hidden = true;
      chosen.hidden = false;
      chosen.replaceChildren(
        h(
          'div',
          { class: 'item', style: 'padding:0;min-height:0;border:0;background:transparent' },
          h(
            'div',
            { class: 'item-main' },
            h('div', { class: 'item-title' }, p.name),
            h(
              'div',
              { class: 'item-sub' },
              `${catName.get(p.category_id ?? '') ?? 'Inne'} · jednostka: ${unitLabel(p.unit)}`,
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-soft btn-sm',
              onclick: () => {
                choose(null);
                input.focus();
              },
            },
            'Zmień',
          ),
        ),
      );
    } else {
      input.hidden = false;
      input.value = '';
      chosen.hidden = true;
      chosen.replaceChildren();
    }
    close();
    opts.onChange?.(p);
  }

  input.addEventListener('input', () => {
    if (selected) choose(null);
    highlighted = 0;
    render();
  });
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (list.hidden) render();
      highlighted = Math.min(highlighted + 1, shown.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      render();
    } else if (e.key === 'Enter' && !list.hidden && shown[highlighted]) {
      e.preventDefault();
      choose(shown[highlighted] ?? null);
    } else if (e.key === 'Escape') close();
  });

  return {
    el: wrap,
    input,
    get: () => selected,
    set: (p) => choose(p),
    setError(msg) {
      err.textContent = msg ?? '';
      wrap.classList.toggle('has-error', !!msg);
    },
  };
}
