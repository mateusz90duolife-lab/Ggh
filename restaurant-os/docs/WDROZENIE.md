# Wdrożenie produkcyjne — stan

Aplikacja działa na projekcie Supabase **restaurant-os** (region Frankfurt, plan darmowy).

| Element                    | Stan | Szczegóły                                                                                          |
| -------------------------- | :--: | -------------------------------------------------------------------------------------------------- |
| Baza danych (migracje 1–6) |  ✅  | Schemat, RLS na 18 tabelach, funkcje; testy SQL przeszły na tym projekcie (w transakcji wycofanej) |
| Doradca bezpieczeństwa     |  ✅  | Brak błędów; zostały ostrzeżenia o funkcjach API dla zalogowanych (zamierzone, patrz D13)          |
| Funkcje Edge               |  ✅  | `admin-users`, `daily-shopping-summary`, `scan-receipt` — wdrożone i sprawdzone                    |
| Katalog produktów          |  ✅  | ok. 110 produktów z ilustracjami (mięsa, warzywa, zupy, przyprawy, sosy) dodanych do lokalu        |
| Skaner paragonów           |  ⚠️  | Funkcja gotowa; brakuje klucza `ANTHROPIC_API_KEY` (niżej, krok 4)                                 |
| Konto właściciela          |  ✅  | Lokal „Moja Restauracja”, 12 kategorii startowych. Hasło tymczasowe zmień po pierwszym logowaniu   |
| Zadania z szablonów (cron) |  ✅  | `pg_cron`, co godzinę (`ros-generate-tasks`)                                                       |
| Frontend                   |  ✅  | GitHub Pages z gałęzi `gh-pages`: https://mateusz90duolife-lab.github.io/Ggh/                      |
| E-mail z listą zakupów     |  ⚠️  | Funkcja gotowa; brakuje klucza Resend i harmonogramu (niżej)                                       |
| Link resetu hasła          |  ⚠️  | Wymaga ustawienia adresu aplikacji w Supabase Auth (niżej)                                         |

Sprawdzenie API (z wnętrza Supabase, przez `pg_net`, tak jak robi to przeglądarka): logowanie hasłem, błędne hasło,
profil, kategorie, stany magazynu, `ensure_today_tasks`, `dashboard_summary`, lista kont w `admin-users` — odpowiedzi 200;
bez tokenu 401; tabele bez logowania niedostępne.

## Co musisz zrobić (ok. 5 minut)

### 1. GitHub Pages — gotowe

Aplikacja jest publikowana z gałęzi **`gh-pages`** (zawiera tylko zbudowane pliki). GitHub włączył Pages automatycznie
po jej utworzeniu. Adres: **https://mateusz90duolife-lab.github.io/Ggh/**

### 2. Adres aplikacji w Supabase (dla linku „Nie pamiętasz hasła?”)

Supabase → projekt **restaurant-os** → **Authentication → URL Configuration**:

- **Site URL:** `https://mateusz90duolife-lab.github.io/Ggh/`
- **Redirect URLs:** dodaj ten sam adres

Uwaga: wbudowana poczta Supabase wysyła maile tylko na adresy członków zespołu projektu i z limitem. Dla pracowników
ustaw własny SMTP (np. Resend) w _Authentication → SMTP Settings_ albo resetuj hasła w aplikacji (Pracownicy → Resetuj hasło).

### 3. E-mail z listą zakupów (opcjonalne)

1. Załóż konto na resend.com, zweryfikuj domenę i utwórz klucz API.
2. Supabase → **Edge Functions → Secrets**: dodaj `RESEND_API_KEY`, `MAIL_FROM` (np. `Restauracja <lista@twoja-domena.pl>`)
   i `CRON_SECRET` (dowolny długi losowy ciąg).
3. W **SQL Editor** uruchom część 1 i 3 z `supabase/cron.example.sql` (z `wefcwnhqklovzrrmcfou` jako `<PROJECT_REF>`).
   Rozszerzenia `pg_cron` i `pg_net` są już włączone.
4. W aplikacji: **Więcej → Ustawienia → Wyślij testowy e-mail**.

### 4. Skaner paragonów — klucz API Claude

1. Na **platform.claude.com** (konsola Anthropic) utwórz klucz API (Settings → API Keys) i doładuj saldo.
2. Supabase → projekt **restaurant-os** → **Edge Functions → Secrets** → dodaj `ANTHROPIC_API_KEY` z tym kluczem.
3. W aplikacji: **Zakupy → Skanuj paragon**, zrób zdjęcie paragonu.

Klucza nie wpisuj nigdzie w aplikacji ani w repozytorium — jest używany wyłącznie w funkcji `scan-receipt` na serwerze.
Jeden odczyt paragonu to zwykle kilka groszy; limit to 60 skanów na lokal na dobę.

## Aktualizacja aplikacji

Po zmianach w kodzie: `cd restaurant-os && node scripts/publish-pages.mjs` (buduje do `/docs`), a następnie skopiuj
zawartość `/docs` na gałąź `gh-pages` i wypchnij ją — GitHub opublikuje nową wersję w 1–2 minuty.
Nowe migracje SQL wgrywasz przez `supabase db push` albo w SQL Editor.
