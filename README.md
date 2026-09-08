# ISO Master

Nauka rzutowania izometrycznego i czytania rysunku technicznego.
Repozytorium zawiera dwie aplikacje, obie bez frameworka i bez kroku budowania.

| Plik | Co to jest | Czego wymaga |
| --- | --- | --- |
| `trener.html` | **Trener izometryki** — generator ćwiczeń przestrzennych z adaptacyjną trudnością | nic, działa offline |
| `index.html` | Powłoka SaaS: logowanie, subskrypcja, prosty quiz | konta Supabase i Stripe |

Metodyka, na której oparto trener, wraz ze źródłami: [METODYKA.md](METODYKA.md).

---

## Trener izometryki (`trener.html`)

Otwórz plik w przeglądarce i gotowe. Bez logowania, bez serwera, bez zależności
zewnętrznych. Postęp zapisuje się w pamięci przeglądarki.

**Osiem typów zadań**, generowanych proceduralnie, więc pule zadań się nie
wyczerpują:

| Zadanie | Umiejętność |
| --- | --- |
| Plan kodowany → bryła | odczyt zapisu wysokości słupków |
| Rzuty → bryła | odtworzenie bryły z trzech rzutów |
| Bryła → rzut | wskazanie poprawnego rzutu |
| Obroty przestrzenne | obrót o 90° wokół wybranej osi |
| Odbicia i symetria | odróżnienie odbicia od obrotu |
| Przekroje brył | przekrój płaszczyzną |
| Liczenie kostek | objętość wraz z kostkami zasłoniętymi |
| Układ rzutów | metoda pierwszego i trzeciego kąta |

**Tryb Buduj** daje zadanie konstrukcyjne zamiast wyboru z listy: trzy rzuty
i pusta siatka, w której trzeba postawić bryłę słupek po słupku. Sprawdzenie
porównuje zbiory kostek, więc zgadywanie nie działa.

**Jak dobierany jest materiał:** typy zadań są przeplatane (ta sama umiejętność
nie wystąpi dwa razy z rzędu), każda umiejętność ma własny harmonogram powtórek
w rosnących odstępach, a poziom trudności podąża za skutecznością, celując
w okolice 75–85% trafień. Błędne odpowiedzi nie są losowe — kodują typowe
pomyłki, a informacja zwrotna nazywa popełniony błąd zamiast tylko go
odnotować.

Domyślną metodą rzutowania jest **metoda pierwszego kąta** (europejska,
PN-EN ISO 5456-2). W ustawieniach można przełączyć na metodę trzeciego kąta.

---

## Powłoka SaaS (`index.html`)

Frontend bez frameworka. Backend to Supabase (autoryzacja i baza), płatności
przez Stripe Payment Link.

### Uruchomienie lokalne

```bash
python3 -m http.server 8000
# następnie otwórz http://localhost:8000
```

Otwarcie pliku bezpośrednio przez `file://` nie zadziała dla `index.html` —
Supabase Auth wymaga kontekstu HTTP. Trener (`trener.html`) działa również
z `file://`.

## Moduły

| Moduł | Opis |
| --- | --- |
| Dashboard | Statystyki odpowiedzi: suma, poprawne, błędne, skuteczność |
| Quiz | Pytania jednokrotnego wyboru, tylko dla subskrybentów PRO |
| Siatka izometryczna | Canvas 8×8, podgląd współrzędnych, malowanie kafelków |
| Cennik | Płatność przez Stripe Payment Link |

## Konfiguracja Supabase

Stałe `SUPABASE_URL` i `SUPABASE_KEY` znajdują się na początku bloku
`<script>`. Klucz `anon` jest z założenia publiczny, ale dostęp do danych musi
być ograniczony przez Row Level Security.

### Wymagane tabele

```sql
create table questions (
  id            bigserial primary key,
  question      text    not null,
  answers       jsonb   not null,   -- tablica stringów
  correct_index int     not null,
  fail_message  text,
  image_url     text                -- opcjonalna ilustracja pytania
);

create table progress (
  id          bigserial primary key,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  question_id bigint  not null references questions(id) on delete cascade,
  correct     boolean not null,
  created_at  timestamptz default now()
);

create table subscriptions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  active     boolean     not null default false,
  expires_at timestamptz
);
```

Włącz RLS na `progress` i `subscriptions`, tak aby użytkownik widział wyłącznie
własne wiersze. Tabelę `subscriptions` zapisuje wyłącznie webhook Stripe
(rola `service_role`) — klient nie może jej modyfikować, inaczej każdy
nadałby sobie dostęp PRO.

### Logowanie nazwą użytkownika

Supabase Auth wymaga adresu e-mail, dlatego nazwa użytkownika jest mapowana na
syntetyczny adres `<nazwa>@isomaster.local`, a prawdziwa nazwa trafia do
`user_metadata.username`.

Konieczne ustawienie w panelu Supabase:

> Authentication → Providers → Email → wyłącz **Confirm email**

Adresy w domenie `isomaster.local` nie istnieją, więc e-mail potwierdzający
nigdy by nie dotarł i rejestracja utknęłaby na etapie weryfikacji.

## Konfiguracja Stripe

Ustaw `STRIPE_LINK` na swój Payment Link. Aplikacja dokleja do niego
`?client_reference_id=<user_id>`. Webhook po stronie serwera odczytuje
`session.client_reference_id` ze zdarzenia `checkout.session.completed`
i aktywuje subskrypcję:

```sql
insert into subscriptions (user_id, active, expires_at)
values ($1, true, now() + interval '1 month')
on conflict (user_id) do update
  set active = true, expires_at = excluded.expires_at;
```

## Znane ograniczenia

- `getNextQuestion()` pobiera do 1000 odpowiedzianych pytań i filtruje po
  stronie klienta przez `NOT IN (...)`. Powyżej tego progu przenieś logikę do
  funkcji RPC w Supabase, np. `get_next_unanswered_question(p_user_id)`.
- `LoginGuard` (blokada po 5 nieudanych próbach) działa wyłącznie w pamięci
  przeglądarki. Ogranicza przypadkowe zapętlenie, ale nie zastępuje
  rate-limitingu po stronie serwera.
- Kolorowanie kafelków siatki izometrycznej nie jest zapisywane — stan ginie
  po przeładowaniu strony.
