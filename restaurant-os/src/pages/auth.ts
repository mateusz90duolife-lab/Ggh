import { requestPasswordReset, signIn, signOut, updatePassword, getSession } from '../api/auth.js';
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

export function loginPage(c: PageCtx): void {
  c.setTitle('Logowanie');
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
      submit.disabled = true;
      submit.classList.add('is-busy');
      try {
        await signIn(em.value, pw);
        // dalszy ciąg (wczytanie profilu i przekierowanie) obsługuje main.ts po zmianie sesji
      } catch (err) {
        mount(status, h('div', { class: 'notice notice-error', role: 'alert' }, errorMessage(err)));
        (password.input as HTMLInputElement).value = '';
        password.input.focus();
      } finally {
        submit.disabled = false;
        submit.classList.remove('is-busy');
      }
    })();
  });
  mount(c.el, h('div', { class: 'auth' }, brand('Zaloguj się, aby kontynuować'), takeNotice(), form));
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
