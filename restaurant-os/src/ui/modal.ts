import { h, icon } from '../dom.js';
import type { Child } from '../dom.js';

export interface ModalHandle {
  close(): void;
  el: HTMLElement;
}

/** Okno modalne (na telefonie wysuwa się od dołu). Esc i kliknięcie w tło zamykają okno. */
export function openModal(opts: { title: string; body: Child; onClose?: () => void; wide?: boolean }): ModalHandle {
  const previous = document.activeElement as HTMLElement | null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    document.body.classList.remove('modal-open');
    previous?.focus?.();
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const dialog = h(
    'div',
    { class: `modal${opts.wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
    h(
      'div',
      { class: 'modal-head' },
      h('h2', null, opts.title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zamknij', onclick: close }, icon('x')),
    ),
    h('div', { class: 'modal-body' }, opts.body),
  );
  const backdrop = h(
    'div',
    {
      class: 'backdrop',
      onmousedown: (e: Event) => {
        if (e.target === backdrop) close();
      },
    },
    dialog,
  );
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKey);
  const first = dialog.querySelector<HTMLElement>('input, select, textarea, button.btn-primary');
  setTimeout(() => first?.focus(), 30);
  return { close, el: dialog };
}

export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: boolean) => {
      if (settled) return;
      settled = true;
      m.close();
      resolve(v);
    };
    const m = openModal({
      title: opts.title,
      onClose: () => done(false),
      body: [
        h('p', { class: 'modal-text' }, opts.message),
        h(
          'div',
          { class: 'modal-actions' },
          h(
            'button',
            { class: 'btn btn-ghost', type: 'button', onclick: () => done(false) },
            opts.cancelLabel ?? 'Anuluj',
          ),
          h(
            'button',
            { class: `btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: () => done(true) },
            opts.confirmLabel ?? 'Potwierdź',
          ),
        ),
      ],
    });
  });
}
