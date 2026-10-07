import { requestPasswordReset, signIn, signInWithPin, signOut, updatePassword, getSession } from '../api/auth.js';
import { h, mount } from '../dom.js';
import { errorMessage } from '../lib/errors.js';
import { storage } from '../lib/storage.js';
import { validateEmail, validateNewPassword } from '../lib/validate.js';
import { navigate } from '../router.js';
import type { PageCtx } from '../router.js';
import { homePath, role } from '../state.js';
import { button, field, textInput } from '../ui/components.js';
import { toast } from '../ui/toast.js';

const NOTICE_KEY = 'ros.notice';

/** Komunikat do pokazania na ekranie logowania (np. „Sesja wygasła”). */
export function setLoginNotice(msg: string, kind: 'info' | 'error' | 'ok' = 'info'): void {
  storage.setJson(NOTICE_KEY, { msg, kind });
}

function takeNotice(): HTMLElement | null {
  const n = storage.getJson<{ msg: string; kind: string } | null>(NOTICE_KEY, null);
  storage.remove(NOTICE_KEY);
  return n ? h('div', { class: `notice notice-${n.kind}`, role: 'status' }, n.msg) : null;
}

function brand(subtitle: string): HTMLElement {
  return h(
    'div',
    { class: 'auth-brand' },
    h('div', { class: 'logo' }, '🍽️'),
    h('h1', null, 'Restaurant OS'),
    h('p', null, subtitle),
  );
}

const MODE_KEY = 'ros.loginMode';
const NICK_KEY = 'ros.lastNick';

export function loginPage(c: PageCtx): void {
  c.setTitle('Logowanie');
  let mode: 'pin' | 'email' = storage.getJson<string>(MODE_KEY, 'pin') === 'email' ? 'email' : 'pin';
  const host = h('div');
  const tabsEl = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sposób logowania' });

  function drawTabs() {
    tabsEl.replaceChildren(
      ...(
        [
          ['pin', 'Pracownik: nick i PIN'],
          ['email', 'E-mail i hasło'],
        ] as const
      ).map(([id, label]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: `tab${mode === id ? ' tab-active' : ''}`,
            'aria-selected': String(mode === id),
            onclick: () => {
              mode = id;
              storage.setJson(MODE_KEY, id);
              draw();
            },
          },
          label,
        ),
      ),
    );
  }

  function busy(btn: HTMLButtonElement, on: boolean) {
    btn.disabled = on;
    btn.classList.toggle('is-busy', on);
  }

  function pinForm(): HTMLElement {
    const nick = field(
      'Nick',
      textInput({
        autocomplete: 'username',
        name: 'nick',
        value: storage.getJson<string>(NICK_KEY, ''),
        maxLength: 24,
      }),
    );
    nick.input.setAttribute('autocapitalize', 'none');
    const pinInput = h('input', {
      class: 'input pin-input',
      type: 'password',
      inputMode: 'numeric',
      autocomplete: 'current-password',
      name: 'pin',
      maxLength: 4,
      pattern: '[0-9]*',
    });
    const pin = field('PIN (4 cyfry)', pinInput);
    const status = h('div', { 'aria-live': 'polite' });
    const submit = button('Wejdź', { type: 'submit', size: 'lg', block: true });
    const form = h('form', { class: 'form card', novalidate: true }, nick.el, pin.el, status, submit);
    let sending = false;
    async function send() {
      if (sending) return;
      mount(status);
      const n = (nick.input as HTMLInputElement).value.trim().toLowerCase();
      const p = pinInput.value.trim();
      nick.setError(n ? null : 'Podaj swój nick.');
      pin.setError(/^\d{4}$/.test(p) ? null : 'PIN to 4 cyfry.');
      if (!n || !/^\d{4}$/.test(p)) return;
      sending = true;
      busy(submit, true);
      try {
        await signInWithPin(n, p);
        storage.setJson(NICK_KEY, n);
      } catch (err) {
        mount(status, h('div', { class: 'notice notice-error', role: 'alert' }, errorMessage(err)));
        pinInput.value = '';
        pinInput.focus();
      } finally {
        sending = false;
        busy(submit, false);
      }
    }
    pinInput.addEventListener('input', () => {
      pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
      if (pinInput.value.length === 4 && (nick.input as HTMLInputElement).value.trim()) void send();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void send();
    });
    setTimeout(() => ((nick.input as HTMLInputElement).value ? pinInput : nick.input).focus(), 0);
    return form;
  }

  function emailForm(): HTMLElement {
    const email = field(
      'Adres e-mail',
      textInput({ type: 'email', autocomplete: 'username', inputMode: 'email', name: 'email', required: true }),
    );
    const password = field(
      'Hasło',
      textInput({ type: 'password', autocomplete: 'current-password', name: 'password', required: true }),
    );
    const status = h('div', { 'aria-live': 'polite' });
    const submit = button('Zaloguj się', { type: 'submit', size: 'lg', block: true });
    const form = h(
      'form',
      { class: 'form card', novalidate: true },
      email.el,
      password.el,
      status,
      submit,
      h(
        'a',
        { href: '#/zapomniane-haslo', class: 'muted small', style: 'text-align:center;padding:8px' },
        'Nie pamiętasz hasła?',
      ),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void (async () => {
        mount(status);
        const em = validateEmail((email.input as HTMLInputElement).value);
        email.setError(em.ok ? null : em.error);
        const pw = (password.input as HTMLInputElement).value;
        password.setError(pw ? null : 'Podaj hasło.');
        if (!em.ok || !pw) return;
        busy(submit, true);
        try {
          await signIn(em.value, pw);
          // dalszy ciąg (wczytanie profilu i przekierowanie) obsługuje main.ts po zmianie sesji
        } catch (err) {
          mount(status, h('div', { class: 'notice notice-error', role: 'alert' }, errorMessage(err)));
          (password.input as HTMLInputElement).value = '';
          password.input.focus();
        } finally {
          busy(submit, false);
        }
      })();
    });
    return form;
  }

  function draw() {
    drawTabs();
    mount(host, mode === 'pin' ? pinForm() : emailForm());
  }
  mount(c.el, h('div', { class: 'auth' }, brand('Zaloguj się, aby kontynuować'), takeNotice(), tabsEl, host));
  draw();
}

export function forgotPage(c: PageCtx): void {
  c.setTitle('Reset hasła');
  const email = field(
    'Adres e-mail konta',
    textInput({ type: 'email', autocomplete: 'username', inputMode: 'email', required: true }),
  );
  const status = h('div', { 'aria-live': 'polite' });
  const form = h(
    'form',
    { class: 'form card', novalidate: true },
    h('p', { class: 'muted' }, 'Podaj adres e-mail. Jeśli konto istnieje, wyślemy link do ustawienia nowego hasła.'),
    email.el,
    status,
    button('Wyślij link', { type: 'submit', size: 'lg', block: true }),
    h('a', { href: '#/login', class: 'muted small', style: 'text-align:center;padding:8px' }, 'Wróć do logowania'),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void (async () => {
      const em = validateEmail((email.input as HTMLInputElement).value);
      email.setError(em.ok ? null : em.error);
      if (!em.ok) return;
      try {
        await requestPasswordReset(em.value);
        mount(
          status,
          h(
            'div',
            { class: 'notice notice-ok', role: 'status' },
            'Jeśli konto o tym adresie istnieje, wysłaliśmy wiadomość z linkiem. Sprawdź skrzynkę (także spam).',
          ),
        );
      } catch (err) {
        mount(status, h('div', { class: 'notice notice-error', role: 'alert' }, errorMessage(err)));
      }
    })();
  });
  mount(c.el, h('div', { class: 'auth' }, brand('Reset hasła'), form));
}

export function newPasswordPage(c: PageCtx): void {
  c.setTitle('Nowe hasło');
  if (!getSession()) {
    mount(
      c.el,
      h(
        'div',
        { class: 'auth' },
        brand('Nowe hasło'),
        h(
          'div',
          { class: 'card form' },
          h('div', { class: 'notice notice-error' }, 'Link wygasł lub jest nieprawidłowy. Poproś o nowy.'),
          h('a', { class: 'btn btn-primary btn-lg', href: '#/zapomniane-haslo' }, 'Poproś o nowy link'),
        ),
      ),
    );
    return;
  }
  const pw = field('Nowe hasło', textInput({ type: 'password', autocomplete: 'new-password', required: true }), {
    hint: 'Minimum 8 znaków.',
  });
  const pw2 = field(
    'Powtórz nowe hasło',
    textInput({ type: 'password', autocomplete: 'new-password', required: true }),
  );
  const status = h('div', { 'aria-live': 'polite' });
  const form = h(
    'form',
    { class: 'form card', novalidate: true },
    pw.el,
    pw2.el,
    status,
    button('Zapisz hasło', { type: 'submit', size: 'lg', block: true }),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void (async () => {
      const a = (pw.input as HTMLInputElement).value;
      const b = (pw2.input as HTMLInputElement).value;
      const r = validateNewPassword(a, b);
      pw.setError(r.ok || a.length >= 8 ? null : r.error);
      pw2.setError(r.ok || a.length < 8 ? null : r.error);
      if (!r.ok) return;
      try {
        await updatePassword(a);
        toast('Hasło zostało zmienione.', 'ok');
        navigate(homePath(role()), { replace: true });
      } catch (err) {
        mount(status, h('div', { class: 'notice notice-error', role: 'alert' }, errorMessage(err)));
      }
    })();
  });
  mount(c.el, h('div', { class: 'auth' }, brand('Ustaw nowe hasło'), form));
}

export function blockedScreen(root: HTMLElement, kind: 'no-profile' | 'inactive' | 'offline'): void {
  const msg =
    kind === 'inactive'
      ? 'Twoje konto zostało dezaktywowane. Skontaktuj się z właścicielem restauracji.'
      : kind === 'offline'
        ? 'Nie udało się połączyć z serwerem, a na tym urządzeniu nie ma jeszcze zapisanych danych. Sprawdź internet i spróbuj ponownie.'
        : 'Twoje konto jest nieaktywne albo nie zostało jeszcze przypisane do restauracji. Skontaktuj się z właścicielem.';
  mount(
    root,
    h(
      'main',
      { class: 'bare' },
      h(
        'div',
        { class: 'auth' },
        brand(kind === 'offline' ? 'Brak połączenia' : 'Brak dostępu'),
        h(
          'div',
          { class: 'card form' },
          h('div', { class: `notice ${kind === 'offline' ? 'notice-info' : 'notice-error'}`, role: 'alert' }, msg),
          kind === 'offline'
            ? button('Spróbuj ponownie', { size: 'lg', onClick: () => location.reload() })
            : button('Wyloguj się', { variant: 'ghost', onClick: () => signOut() }),
        ),
      ),
    ),
  );
}

export function configMissingScreen(root: HTMLElement): void {
  mount(
    root,
    h(
      'main',
      { class: 'bare' },
      h(
        'div',
        { class: 'auth' },
        brand('Konfiguracja'),
        h(
          'div',
          { class: 'card form' },
          h(
            'div',
            { class: 'notice notice-error', role: 'alert' },
            'Aplikacja nie ma jeszcze połączenia z bazą danych. Administrator musi ustawić SUPABASE_URL i SUPABASE_ANON_KEY (patrz docs/SETUP.md).',
          ),
        ),
      ),
    ),
  );
}
