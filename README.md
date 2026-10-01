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

Aplikacja ma pięć zakładek: **Kurs**, **Trening**, **Buduj**, **Teoria**
i **Postępy**.

### Kurs — ścieżka prowadzona

Dziesięć modułów w ustalonej kolejności, około dwóch godzin. Każdy moduł to
teoria, ćwiczenia bez oceny i sprawdzian z progiem 5 z 6, który otwiera
kolejny moduł. Na końcu egzamin z 12 zadań ze wszystkich modułów, próg 9,
oraz certyfikat do wydruku.

| # | Moduł | # | Moduł |
| --- | --- | --- | --- |
| 1 | Układ osi i rzut izometryczny | 6 | Obroty wokół osi pionowej |
| 2 | Plan kodowany | 7 | Obroty wokół osi poziomych |
| 3 | Trzy rzuty prostokątne | 8 | Odbicia i symetria |
| 4 | Uskoki i linie wewnętrzne | 9 | Przekroje brył |
| 5 | Czytanie rzutów: od rysunku do bryły | 10 | Metoda pierwszego i trzeciego kąta |

Układ modułów odwzorowuje strukturę kursu „Developing Spatial Thinking".
Kurs buduje rozumienie po kolei, tryb Trening je potem utrwala, mieszając
materiał. Uzasadnienie tego podziału opisuje sekcja 9 w
[METODYKA.md](METODYKA.md).

### Trening — praktyka przeplatana

Sesja to 10 zadań dobieranych przez model ucznia. **Osiem typów zadań**,
generowanych proceduralnie, więc pule zadań się nie wyczerpują:

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

### Buduj, Teoria, Postępy

**Buduj** daje zadanie konstrukcyjne zamiast wyboru z listy: trzy rzuty
i pusta siatka, w której trzeba postawić bryłę słupek po słupku. Sprawdzenie
porównuje zbiory kostek, więc zgadywanie nie działa.

**Teoria** to dwanaście lekcji z rysunkami generowanymi tym samym silnikiem
co zadania. **Postępy** pokazują opanowanie każdej umiejętności i termin
najbliższej powtórki.

**Jak dobierany jest materiał w treningu:** typy zadań są przeplatane (ta sama umiejętność
nie wystąpi dwa razy z rzędu), każda umiejętność ma własny harmonogram powtórek
w rosnących odstępach, a poziom trudności podąża za skutecznością, celując
w okolice 75–85% trafień. Błędne odpowiedzi nie są losowe — kodują typowe
pomyłki, a informacja zwrotna nazywa popełniony błąd zamiast tylko go
odnotować.

Domyślną metodą rzutowania jest **metoda pierwszego kąta** (europejska,
PN-EN ISO 5456-2). W ustawieniach można przełączyć na metodę trzeciego kąta.

---

### Dostępność

Całą aplikację da się obsłużyć z klawiatury. Opcje odpowiedzi, pola edytora
planu, pozycje kursu i nagłówki lekcji są przyciskami, więc działają pod Tab
i Enter. W trakcie zadania klawisze `1`–`5` wybierają odpowiedź, a `Enter`
przechodzi dalej. W edytorze planu strzałki w górę i w dół zmieniają wysokość
słupka. Fokus jest widoczny, a informacja zwrotna po odpowiedzi ogłaszana
przez czytnik ekranu.

Ograniczenie, które warto znać: rysunki na płótnie mają opis słowny
(„bryła z 9 kostek, podstawa 3 na 3 pola, wysokość 3"), ale **opis nie
zastępuje obrazu**. Zadania na wyobraźnię przestrzenną wymagają zobaczenia
rysunku, więc dla osoby niewidomej aplikacja pozostaje nieprzydatna
merytorycznie, choć jest nawigowalna. Udawanie, że jest inaczej, byłoby
nieuczciwe.

### Testy

```bash
./testy/uruchom.sh          # logika: geometria, zadania, model ucznia, kurs
./testy/uruchom.sh --all    # dodatkowo przebieg w przeglądarce (Playwright)
```

Testy logiki działają na kodzie wyciętym z `trener.html`, więc aplikacja nie
zawiera żadnych ułatwień pod kątem testowania. Dwa z nich są mocniejsze niż
zwykłe sprawdzenie struktury, bo konfrontują kod z niezależnym wyliczeniem:

- **Obroty kontra rzuty** — obrót bryły w prawo musi obracać jej rzut z góry
  w prawo, a rzut z prawej musi stawać się rzutem z przodu. Zgadza się to
  tylko wtedy, gdy dwa osobne fragmenty kodu opisują tę samą geometrię.
- **Widoczność kontra rasteryzacja** — liczba kostek widocznych na rysunku
  jest porównywana z wynikiem rasteryzacji o wysokiej rozdzielczości.
  Dwie analityczne reguły, które wydawały się oczywiste, poległy właśnie na
  tym teście.

Test przeglądarkowy przechodzi cały kurs od pierwszego modułu po certyfikat,
potwierdza, że oblany sprawdzian nie otwiera kolejnego modułu, i sprawdza
obsługę z klawiatury.

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

### Zakładki powłoki

| Zakładka | Opis |
| --- | --- |
| Dashboard | Statystyki odpowiedzi: suma, poprawne, błędne, skuteczność |
| Quiz | Pytania jednokrotnego wyboru, tylko dla subskrybentów PRO |
| Siatka izometryczna | Canvas 8×8, podgląd współrzędnych, malowanie kafelków |
| Cennik | Płatność przez Stripe Payment Link |
| Trener izometryki | Odsyłacz do `trener.html` |

### Konfiguracja Supabase

Stałe `SUPABASE_URL` i `SUPABASE_KEY` znajdują się na początku bloku
`<script>`. Klucz `anon` jest z założenia publiczny, ale dostęp do danych musi
być ograniczony przez Row Level Security.

#### Wymagane tabele

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

#### Row Level Security — bez tego płatny dostęp nie istnieje

Klucz `anon` jest wpisany w źródło strony, więc każdy może odpytać API
bezpośrednio, z pominięciem interfejsu. Sprawdzenie `AppState.subscribed`
w kodzie przeglądarki **nie jest zabezpieczeniem**, tylko ukryciem przycisku.
Jedyną realną granicą są polityki RLS. W szczególności musi być chroniona
tabela `questions`: bez tego treść płatna jest publiczna.

```sql
-- Pytania tylko dla aktywnej subskrypcji
alter table questions enable row level security;
create policy "pytania dla subskrybentow" on questions for select
  using (exists (
    select 1 from subscriptions s
    where s.user_id = auth.uid()
      and s.active
      and (s.expires_at is null or s.expires_at > now())
  ));

-- Własne postępy, cudzych nie widać i nie da się ich podrobić
alter table progress enable row level security;
create policy "wlasne postepy" on progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Subskrypcję można tylko odczytać; zapisuje wyłącznie webhook Stripe
-- działający rolą service_role, która pomija RLS. Brak polityki insert,
-- update i delete oznacza, że klient nie nada sobie dostępu PRO.
alter table subscriptions enable row level security;
create policy "odczyt wlasnej subskrypcji" on subscriptions for select
  using (user_id = auth.uid());
```

Sprawdzenie po wdrożeniu: wyloguj się i spróbuj pobrać `questions` czystym
kluczem `anon`. Jeżeli przyjdą jakiekolwiek wiersze, paywall jest nieszczelny.

#### Logowanie nazwą użytkownika

Supabase Auth wymaga adresu e-mail, dlatego nazwa użytkownika jest mapowana na
syntetyczny adres `<nazwa>@isomaster.local`, a prawdziwa nazwa trafia do
`user_metadata.username`.

Konieczne ustawienie w panelu Supabase:

> Authentication → Providers → Email → wyłącz **Confirm email**

Adresy w domenie `isomaster.local` nie istnieją, więc e-mail potwierdzający
nigdy by nie dotarł i rejestracja utknęłaby na etapie weryfikacji.

### Konfiguracja Stripe

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

### Znane ograniczenia powłoki SaaS

- `getNextQuestion()` pobiera do 1000 odpowiedzianych pytań i filtruje po
  stronie klienta przez `NOT IN (...)`. Powyżej tego progu przenieś logikę do
  funkcji RPC w Supabase, np. `get_next_unanswered_question(p_user_id)`.
- `LoginGuard` (blokada po 5 nieudanych próbach) działa wyłącznie w pamięci
  przeglądarki. Ogranicza przypadkowe zapętlenie, ale nie zastępuje
  rate-limitingu po stronie serwera.
- Kolorowanie kafelków siatki izometrycznej nie jest zapisywane — stan ginie
  po przeładowaniu strony.

Ograniczenia samego trenera opisuje sekcja 10 w [METODYKA.md](METODYKA.md).
