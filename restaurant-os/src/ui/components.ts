import { h, icon } from '../dom.js';
import type { Child, IconName } from '../dom.js';
import { errorMessage } from '../lib/errors.js';
import { formatQty } from '../lib/format.js';
import { unitLabel } from '../lib/units.js';
import type { StockStatus } from '../types.js';
import { toast } from './toast.js';

export function button(
  label: Child,
  opts: {
    variant?: 'primary' | 'ghost' | 'danger' | 'soft';
    size?: 'lg' | 'sm';
    icon?: IconName;
    type?: 'button' | 'submit';
    onClick?: (e: Event) => void | Promise<void>;
    disabled?: boolean;
    block?: boolean;
    title?: string;
  } = {},
): HTMLButtonElement {
  const el = h(
    'button',
    {
      type: opts.type ?? 'button',
      class: [
        'btn',
        `btn-${opts.variant ?? 'primary'}`,
        opts.size ? `btn-${opts.size}` : '',
        opts.block ? 'btn-block' : '',
      ]
        .filter(Boolean)
        .join(' '),
      disabled: opts.disabled,
      title: opts.title,
    },
    opts.icon ? icon(opts.icon, opts.size === 'lg' ? 24 : 20) : null,
    h('span', null, label),
  );
  if (opts.onClick) {
    const handler = opts.onClick;
    el.addEventListener('click', (e) => {
      void guarded(el, () => handler(e));
    });
  }
  return el;
}

/** Wykonuje akcję z blokadą przycisku (brak podwójnych kliknięć) i czytelnym komunikatem błędu. */
export async function guarded(el: HTMLButtonElement, fn: () => void | Promise<void>): Promise<void> {
  if (el.dataset.busy === '1') return;
  el.dataset.busy = '1';
  el.disabled = true;
  el.classList.add('is-busy');
  try {
    await fn();
  } catch (e) {
    toast(errorMessage(e), 'error');
  } finally {
    el.dataset.busy = '';
    el.classList.remove('is-busy');
    if (el.isConnected) el.disabled = false;
  }
}

export interface FieldHandle {
  el: HTMLElement;
  input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  setError(msg: string | null): void;
}

export function field(
  label: string,
  input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  opts: { hint?: string } = {},
): FieldHandle {
  const id = input.id || `f_${Math.random().toString(36).slice(2, 9)}`;
  input.id = id;
  const err = h('div', { class: 'field-error', role: 'alert', id: `${id}_err` });
  const el = h(
    'div',
    { class: 'field' },
    h('label', { for: id }, label),
    input,
    opts.hint ? h('div', { class: 'field-hint' }, opts.hint) : null,
    err,
  );
  return {
    el,
    input,
    setError(msg) {
      err.textContent = msg ?? '';
      el.classList.toggle('has-error', !!msg);
      if (msg) input.setAttribute('aria-describedby', err.id);
      else input.removeAttribute('aria-describedby');
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    },
  };
}

export function textInput(opts: {
  value?: string;
  placeholder?: string;
  type?: string;
  autocomplete?: string;
  maxLength?: number;
  required?: boolean;
  inputMode?: string;
  name?: string;
}): HTMLInputElement {
  return h('input', {
    class: 'input',
    type: opts.type ?? 'text',
    value: opts.value ?? '',
    placeholder: opts.placeholder,
    autocomplete: opts.autocomplete,
    maxLength: opts.maxLength,
    required: opts.required,
    inputMode: opts.inputMode,
    name: opts.name,
  });
}

export function numberInput(opts: { value?: string; placeholder?: string; name?: string } = {}): HTMLInputElement {
  return h('input', {
    class: 'input',
    type: 'text',
    inputMode: 'decimal',
    autocomplete: 'off',
    value: opts.value ?? '',
    placeholder: opts.placeholder,
    name: opts.name,
  });
}

export function selectInput(
  options: { value: string; label: string; disabled?: boolean }[],
  value = '',
): HTMLSelectElement {
  const s = h(
    'select',
    { class: 'input' },
    options.map((o) => h('option', { value: o.value, disabled: o.disabled }, o.label)),
  );
  s.value = value;
  return s;
}

const STATUS_TEXT: Record<StockStatus, string> = { ok: 'Stan OK', low: 'Niski stan', out: 'BRAK', none: 'Bez stanu' };
const STATUS_ICON: Record<StockStatus, IconName> = { ok: 'check', low: 'alert', out: 'alert', none: 'minus' };

/** Kolor ZAWSZE z ikoną i tekstem (czytelne także dla osób z zaburzeniami widzenia barw). */
export function stockBadge(status: StockStatus): HTMLElement {
  return h('span', { class: `badge badge-${status}` }, icon(STATUS_ICON[status], 14), STATUS_TEXT[status]);
}

export function stockBar(stock: number, minimum: number, status: StockStatus): HTMLElement {
  const target = Math.max(minimum * 2, 1);
  const pct = status === 'out' || status === 'none' ? 0 : Math.max(4, Math.min(100, (stock / target) * 100));
  return h(
    'div',
    { class: `bar bar-${status}`, role: 'img', 'aria-label': `${STATUS_TEXT[status]}` },
    h('div', { class: 'bar-fill', style: `width:${pct.toFixed(0)}%` }),
  );
}

export function qtyText(value: number | string, unit: string): string {
  return `${formatQty(value)} ${unitLabel(unit)}`;
}

export function emptyState(title: string, text?: string, action?: Child): HTMLElement {
  return h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty-title' }, title),
    text ? h('p', null, text) : null,
    action,
  );
}

export function errorState(message: string, onRetry?: () => void): HTMLElement {
  return h(
    'div',
    { class: 'empty empty-error', role: 'alert' },
    icon('alert', 28),
    h('div', { class: 'empty-title' }, 'Nie udało się wczytać danych'),
    h('p', null, message),
    onRetry ? button('Spróbuj ponownie', { variant: 'soft', onClick: () => onRetry() }) : null,
  );
}

export function skeleton(lines = 4): HTMLElement {
  return h(
    'div',
    { class: 'skeleton-list', 'aria-busy': 'true', 'aria-label': 'Wczytywanie' },
    Array.from({ length: lines }, () => h('div', { class: 'skeleton' })),
  );
}

export function sectionHeader(title: string, right?: Child): HTMLElement {
  return h('div', { class: 'section-head' }, h('h2', null, title), right);
}

export function statCard(opts: {
  icon: IconName;
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'warn' | 'danger' | 'neutral';
  href?: string;
}): HTMLElement {
  const body = [
    h('div', { class: 'stat-icon' }, icon(opts.icon, 22)),
    h(
      'div',
      { class: 'stat-body' },
      h('div', { class: 'stat-label' }, opts.label),
      h('div', { class: 'stat-value' }, opts.value),
      opts.sub ? h('div', { class: 'stat-sub' }, opts.sub) : null,
    ),
  ];
  const cls = `stat stat-${opts.tone ?? 'neutral'}`;
  return opts.href ? h('a', { class: `${cls} stat-link`, href: opts.href }, body) : h('div', { class: cls }, body);
}

export function chip(
  label: string,
  opts: { active?: boolean; onClick?: () => void; pressed?: boolean } = {},
): HTMLElement {
  const el = h(
    'button',
    { type: 'button', class: `chip${opts.active ? ' chip-active' : ''}`, 'aria-pressed': String(!!opts.active) },
    label,
  );
  if (opts.onClick) el.addEventListener('click', opts.onClick);
  return el;
}

export function fab(label: string, href: string): HTMLElement {
  return h('a', { class: 'fab', href }, icon('plus', 24), h('span', null, label));
}

export function backLink(href: string, label = 'Wstecz'): HTMLElement {
  return h('a', { class: 'back-link', href }, icon('back', 18), label);
}

export function tabs(
  items: { id: string; label: string }[],
  active: string,
  onSelect: (id: string) => void,
): HTMLElement {
  return h(
    'div',
    { class: 'tabs', role: 'tablist' },
    items.map((t) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: `tab${t.id === active ? ' tab-active' : ''}`,
          'aria-selected': String(t.id === active),
          onclick: () => onSelect(t.id),
        },
        t.label,
      ),
    ),
  );
}
