import { getSession, updatePassword } from '../api/auth.js';
import { failedItems, removeFromQueue } from '../api/queue.js';
import { h, icon, mount } from '../dom.js';
import { canPromptInstall, isIos, isStandalone, promptInstall } from '../install.js';
import { ROLE_LABEL, moreNav } from '../layout.js';
import { validateNewPassword } from '../lib/validate.js';
import type { PageCtx } from '../router.js';
import { profile, restaurant, role } from '../state.js';
import { button, field, guarded, sectionHeader, textInput } from '../ui/components.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

export const APP_VERSION = '0.1.0';
let logoutHandler: () => void = () => {};
export function setLogoutHandler(fn: () => void): void {
  logoutHandler = fn;
}

export function morePage(c: PageCtx): void {
  c.setTitle('Więcej');
  const r = role();
  const p = profile();
  const host = h('div', { class: 'page' });
  const failedHost = h('div');
  const installHost = h('div');

  function drawFailed() {
    const items = failedItems();
    mount(
      failedHost,
      items.length
        ? [
            sectionHeader('Nie udało się wysłać'),
            h(
              'div',
              { class: 'card card-flush' },
              items.map((i) =>
                h(
                  'div',
                  { class: 'item' },
                  h(
                    'div',
                    { class: 'item-main' },
                    h('div', { class: 'item-title' }, i.label),
                    h('div', { class: 'item-sub neg' }, i.error ?? ''),
                  ),
                  button('Usuń', {
                    size: 'sm',
                    variant: 'ghost',
                    onClick: () => {
                      removeFromQueue(i.id);
                      drawFailed();
                    },
                  }),
                ),
              ),
            ),
          ]
        : null,
    );
  }

  function drawInstall() {
    if (isStandalone()) {
      mount(installHost, h('p', { class: 'muted small' }, '✓ Aplikacja jest zainstalowana na tym urządzeniu.'));
    } else if (canPromptInstall()) {
      mount(
        installHost,
        button('Zainstaluj aplikację', {
          icon: 'download',
          variant: 'soft',
          block: true,
          onClick: async () => {
            const ok = await promptInstall();
            if (ok) toast('Aplikacja zainstalowana.', 'ok');
            drawInstall();
          },
        }),
      );
    } else if (isIos()) {
      mount(
        installHost,
        h(
          'div',
          { class: 'card install-help' },
          h('strong', null, 'Instalacja na iPhone'),
          h('p', null, 'W Safari dotknij „Udostępnij”, a potem „Do ekranu początkowego”.'),
        ),
      );
    } else {
      mount(
        installHost,
        h(
          'div',
          { class: 'card install-help' },
          h('strong', null, 'Instalacja aplikacji'),
          h(
            'p',
            null,
            'Android (Chrome): menu ⋮ → „Dodaj do ekranu głównego”. Komputer (Chrome/Edge): ikona instalacji w pasku adresu.',
          ),
        ),
      );
    }
  }

  function openChangePassword() {
    const a = field('Nowe hasło', textInput({ type: 'password', autocomplete: 'new-password' }), {
      hint: 'Minimum 8 znaków.',
    });
    const b = field('Powtórz nowe hasło', textInput({ type: 'password', autocomplete: 'new-password' }));
    const m = openModal({ title: 'Zmiana hasła', body: null });
    const save = button('Zmień hasło', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form', novalidate: true }, a.el, b.el, save);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void guarded(save, async () => {
        const x = (a.input as HTMLInputElement).value;
        const y = (b.input as HTMLInputElement).value;
        const v = validateNewPassword(x, y);
        a.setError(v.ok || x.length >= 8 ? null : v.error);
        b.setError(v.ok || x.length < 8 ? null : v.error);
        if (!v.ok) return;
        await updatePassword(x);
        m.close();
        toast('Hasło zostało zmienione.', 'ok');
      });
    });
    m.el.querySelector('.modal-body')?.replaceChildren(form);
    a.input.focus();
  }

  mount(
    host,
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'section-head', style: 'margin:0 0 8px' },
        h('h2', null, p?.full_name ?? ''),
        h('span', { class: 'badge badge-neutral' }, r ? ROLE_LABEL[r] : ''),
      ),
      h(
        'dl',
        { class: 'kv' },
        h('dt', null, 'E-mail'),
        h('dd', null, getSession()?.user.email ?? '—'),
        h('dt', null, 'Lokal'),
        h('dd', null, restaurant()?.name ?? '—'),
      ),
    ),
    r && moreNav(r).length
      ? [
          sectionHeader('Sekcje'),
          h(
            'div',
            { class: 'card card-flush' },
            moreNav(r).map((i) =>
              h(
                'a',
                { class: 'item', href: `#${i.path}` },
                icon(i.icon, 22),
                h('div', { class: 'item-main item-title' }, i.label),
                icon('chevron', 18),
              ),
            ),
          ),
        ]
      : null,
    failedHost,
    sectionHeader('Konto i aplikacja'),
    h(
      'div',
      { class: 'form' },
      button('Zmień hasło', { variant: 'soft', block: true, onClick: openChangePassword }),
      installHost,
      button('Wyloguj się', { variant: 'ghost', icon: 'logout', block: true, onClick: () => logoutHandler() }),
    ),
    h('p', { class: 'muted small', style: 'text-align:center' }, `Restaurant OS ${APP_VERSION}`),
  );
  mount(c.el, host);
  drawFailed();
  drawInstall();
}
