# Instalacja i wdrożenie — krok po kroku

Czas: ok. 45 minut. Potrzebujesz: konta Supabase, konta Vercel (lub dowolnego hostingu plików statycznych), konta Resend (e-mail) i Node.js 22+ na komputerze.

> **Ważne:** nigdy nie wklejaj klucza `service_role`, klucza Resend ani `CRON_SECRET` do frontendu ani do repozytorium. Frontend dostaje wyłącznie adres projektu i klucz **publishable/anon**.

## 1. Projekt Supabase

1. Na supabase.com utwórz projekt (region UE, np. Frankfurt) i zapisz hasło bazy.
2. Z panelu _Project Settings → API_ skopiuj: **Project URL** i klucz **anon / publishable**.

## 2. Baza danych (migracje)

Zainstaluj [Supabase CLI](https://supabase.com/docs/guides/cli) i w katalogu `restaurant-os`:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Bez CLI: w panelu _SQL Editor_ wklej po kolei zawartość plików z `supabase/migrations/` (od najstarszego) i uruchom.

Sprawdź w _Authentication → Policies_, że przy każdej tabeli widać włączone RLS.

## 3. Pierwszy właściciel

1. _Authentication → Users → Add user_: podaj e-mail i hasło, zaznacz „Auto Confirm User”.
2. W _SQL Editor_ uruchom (podmień e-mail, nazwę lokalu i imię):

```sql
with r as (
  insert into restaurants (name, timezone, summary_time, summary_emails)
  values ('Nazwa Twojej Restauracji', 'Europe/Warsaw', '21:00', array['twoj@email.pl'])
  returning id
), u as (select id from auth.users where email = 'twoj@email.pl')
insert into profiles (id, restaurant_id, full_name, role)
select u.id, r.id, 'Imię Nazwisko', 'owner' from u, r;

-- startowe kategorie
insert into product_categories (restaurant_id, name, sort_order)
select (select id from restaurants limit 1), n, row_number() over ()
from unnest(array['Nabiał','Warzywa','Owoce','Mięso','Ryby','Pieczywo','Suche','Napoje','Alkohole','Przyprawy','Chemia i czystość','Inne']) as n;
```

Kolejne osoby dodajesz już w aplikacji: **Więcej → Pracownicy → Dodaj pracownika**.

## 4. Funkcje Edge i e-mail

1. Na resend.com zweryfikuj domenę nadawcy i utwórz klucz API.
2. Ustaw sekrety (wartości wpisz po `=`; `CRON_SECRET` wygeneruj losowo):

```bash
supabase secrets set RESEND_API_KEY=re_... \
  MAIL_FROM="Restauracja <lista@twoja-domena.pl>" \
  CRON_SECRET=$(openssl rand -hex 32) \
  ALLOWED_ORIGIN=https://twoja-aplikacja.vercel.app
```

3. Wdróż funkcje (konfiguracja bramki JWT jest w `supabase/config.toml`):

```bash
supabase functions deploy admin-users --no-verify-jwt
supabase functions deploy daily-shopping-summary --no-verify-jwt
```

## 5. Harmonogram

W _Database → Extensions_ włącz `pg_cron` i `pg_net`. Otwórz `supabase/cron.example.sql`, podmień `<PROJECT_REF>` i `<CRON_SECRET>` (ta sama wartość co w sekretach) i uruchom w _SQL Editor_. Dwa zadania:

- co godzinę tworzą zadania z szablonów (z uwzględnieniem strefy czasu),
- co 10 minut sprawdzają, czy czas wysłać listę zakupów (domyślnie 21:00 czasu lokalu); najwyżej jeden mail dziennie.

Aplikacja ma też zabezpieczenie: przy otwarciu ekranów „Dzisiaj” i „Zadania” sama dogenerowuje dzisiejsze zadania z szablonów.

## 6. Hosting (Vercel)

1. Zaimportuj repozytorium; jako **Root Directory** wskaż `restaurant-os`.
2. Zmienne środowiskowe: `SUPABASE_URL` i `SUPABASE_ANON_KEY` (tylko klucz anon/publishable!). Build (`npm run build`) odrzuci klucz `service_role`.
3. Po wdrożeniu w Supabase: _Authentication → URL Configuration_ ustaw **Site URL** na adres aplikacji i dodaj go do **Redirect URLs** (potrzebne do linku resetu hasła).
4. Opcjonalnie w _Authentication → Email Templates_ przetłumacz wiadomości na polski.

## 7. Test dymny po wdrożeniu

1. Zaloguj się jako właściciel → **Ustawienia** → sprawdź godzinę i adresy e-mail → _Wyślij testowy e-mail_.
2. Dodaj pracownika i zaloguj się nim na telefonie; zgłoś brak; odhacz zadanie.
3. Jako manager: lista zakupów → zakup → sprawdź, że stan magazynu wzrósł.
4. Zainstaluj aplikację na telefonie (Android: menu ⋮ → „Dodaj do ekranu głównego”; iPhone: Safari → Udostępnij → „Do ekranu początkowego”).
5. Usuń dane testowe (produkty, zgłoszenia) przed użyciem produkcyjnym.

## 8. Kopie zapasowe

- Plany płatne Supabase: codzienne kopie i PITR — włącz w _Database → Backups_.
- Plan darmowy (brak kopii): raz w tygodniu `pg_dump "postgresql://postgres:<HASŁO>@db.<PROJECT_REF>.supabase.co:5432/postgres" -Fc -f kopia.dump`.
- Przywracanie: utwórz nowy projekt, zastosuj migracje, a potem `pg_restore --data-only --disable-triggers -d <connection-string> kopia.dump`. Przećwicz to raz, zanim będzie potrzebne.

## 9. Praca lokalna i testy

```bash
npm install
cp .env.example .env          # uzupełnij SUPABASE_URL i SUPABASE_ANON_KEY
npm run serve                 # http://127.0.0.1:8080
npm run lint                  # formatowanie + typy
npm test                      # testy jednostkowe i bezpieczeństwa (Node)
npm run db:test               # migracje + RLS + funkcje na lokalnym PostgreSQL 16
npm run e2e                   # testy w Chromium przeciw lokalnemu backendowi testowemu
```

`db:test` i `e2e` wymagają lokalnego PostgreSQL z uprawnieniami superużytkownika (zmienne `PGHOST`, `PGUSER`, `PGPASSWORD`) oraz — dla `e2e` — Playwright (`npx playwright install chromium`).

## Rozwiązywanie problemów

| Objaw                                               | Przyczyna i rozwiązanie                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Ekran „brak konfiguracji”                           | Brak `SUPABASE_URL`/`SUPABASE_ANON_KEY` w zmiennych hostingu; ustaw i wdróż ponownie.                         |
| „Konto jest nieaktywne albo nie zostało przypisane” | Użytkownik istnieje w Auth, ale nie ma wiersza w `profiles` (krok 3) albo konto zdezaktywowano.               |
| Pracownik nie widzi produktów                       | Najpierw manager musi je dodać (Magazyn → Produkt).                                                           |
| Mail nie przychodzi                                 | Sprawdź `select * from email_log order by created_at desc` (kolumna `error`), sekrety Resend i adres nadawcy. |
| Link resetu hasła wraca na logowanie                | Dodaj adres aplikacji do _Redirect URLs_ w Supabase (krok 6.3).                                               |
| Nowa wersja nie pojawia się                         | Aplikacja pokaże baner „Dostępna nowa wersja — Odśwież”; ewentualnie zamknij i otwórz ją ponownie.            |
