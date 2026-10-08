# ISO Master

Nauka rzutowania izometrycznego i czytania rysunku technicznego.
Repozytorium zawiera dwie aplikacje, obie bez frameworka i bez kroku budowania.

> Ta gałąź (`claude/iso-master-saas-app-oharjy`) zawiera wyłącznie kurs izometrii.
> Aplikacja restauracji (Restaurant OS) jest na osobnych gałęziach: `main`,
> `ccr-fb37870d-vqxmgt` i `gh-pages`.

| Plik | Co to jest | Czego wymaga |
| --- | --- | --- |
| `trener.html` | **Trener izometryki** — generator ćwiczeń przestrzennych z adaptacyjną trudnością | nic, działa offline |
| `index.html` | Powłoka SaaS: logowanie, prosty quiz, siatka izometryczna — bezpłatnie | konta Supabase |

Metodyka, na której oparto trener, wraz ze źródłami: [METODYKA.md](METODYKA.md).

---

## Trener izometryki (`trener.html`)

Otwórz plik w przeglądarce i gotowe. Bez logowania, bez serwera, bez zależności
zewnętrznych. Postęp zapisuje się w pamięci przeglądarki.

Aplikacja ma sześć zakładek: **Kurs**, **Trening**, **Szkicuj**, **Buduj**,
**Teoria** i **Postępy**.

### Kurs — ścieżka prowadzona

Szesnaście modułów w ustalonej kolejności, około trzech i pół godziny. Każdy
moduł to teoria, ćwiczenia bez oceny i sprawdzian z progiem około 80%, który
otwiera kolejny moduł. Na końcu egzamin z 18 zadań ze wszystkich modułów,
próg 14, oraz certyfikat do wydruku.

| # | Moduł | # | Moduł |
| --- | --- | --- | --- |
| 1 | Układ osi i rzut izometryczny | 9 | Powierzchnie pochyłe i okręgi |
| 2 | Plan kodowany | 10 | Bryły obrotowe |
| 3 | Szkicowanie izometryczne | 11 | Rozwinięcia brył |
| 4 | Łączenie brył | 12 | Obroty wokół osi pionowej |
| 5 | Trzy rzuty prostokątne | 13 | Obroty wokół osi poziomych |
| 6 | Krawędzie widoczne i niewidoczne | 14 | Odbicia i symetria |
| 7 | Czytanie rzutów: od rysunku do bryły | 15 | Przekroje i kłady |
| 8 | Wymiarowanie | 16 | Metoda pierwszego i trzeciego kąta |

Kurs obejmuje wszystkie dziesięć tematów kursu „Developing Spatial Thinking"
(Sorby) oraz krawędzie niewidoczne, wymiarowanie i normę rozmieszczenia rzutów.
Kurs buduje rozumienie po kolei, tryb Trening je potem utrwala, mieszając
materiał. Uzasadnienie tego podziału opisuje sekcja 9 w
[METODYKA.md](METODYKA.md).

### Trening — praktyka przeplatana

Sesja to 10 zadań dobieranych przez model ucznia. **Piętnaście typów zadań**,
generowanych proceduralnie, więc pule zadań się nie wyczerpują:

| Zadanie | Umiejętność |
| --- | --- |
| Plan kodowany → bryła | odczyt zapisu wysokości słupków |
| Rzuty → bryła | odtworzenie bryły z trzech rzutów |
| Bryła → rzut | wskazanie poprawnego rzutu |
| Obroty przestrzenne | obrót o 90° wokół wybranej osi |
| Odbicia i symetria | odróżnienie odbicia od obrotu |
| Przekroje brył | figura przekroju (kład) |
| Liczenie kostek | objętość wraz z kostkami zasłoniętymi |
| Układ rzutów | metoda pierwszego i trzeciego kąta |
| Szkic izometryczny | rysunek bryły na siatce punktowej — bez wyboru z listy |
| Linie pochyłe | rzuty bryły ze skosem → rysunek izometryczny |
| Okręgi w izometrii | orientacja i wymiary elipsy |
| Łączenie brył | suma, różnica i część wspólna dwóch brył |
| Bryły obrotowe | figura przy osi ↔ bryła powstała z obrotu |
| Rozwinięcia brył | siatki sześcianu, składanie w wyobraźni, rozwinięcie walca |
| Wymiarowanie | brakujący wymiar w łańcuchu, poprawny zapis wymiaru |

Rzuty są rysowane zgodnie z PN-EN ISO 128: krawędzie widoczne linią ciągłą
grubą, niewidoczne kreskową cienką, a pole kładu jest kreskowane.

### Szkicuj, Buduj, Teoria, Postępy

**Szkicuj** to rysowanie bryły na siatce punktów izometrycznych, z planu
kodowanego albo z trzech rzutów. Kliknięcie w punkt zaczyna odcinek,
kliknięcie w drugi punkt na tej samej linii siatki go rysuje; z klawiatury
strzałki przesuwają kursor, a `Enter` działa jak kliknięcie. Program porównuje
szkic z rysunkiem bryły odcinek po odcinku, z dokładnością do przesunięcia,
i zaznacza odcinki zbędne i brakujące. Na szkic są dwie próby.

**Buduj** daje zadanie konstrukcyjne zamiast wyboru z listy: trzy rzuty
i pusta siatka, w której trzeba postawić bryłę słupek po słupku. Poprawna
jest bryła wzorcowa i każda inna o identycznych trzech rzutach.

**Teoria** to dziewiętnaście lekcji z rysunkami generowanymi tym samym silnikiem
co zadania; twierdzenia oparte na źródłach mają je podane pod lekcją.
**Postępy** pokazują opanowanie każdej umiejętności i termin najbliższej
powtórki.

**Jak dobierany jest materiał w treningu:** typy zadań są przeplatane (ta sama
umiejętność nie powtórzy się w ciągu trzech kolejnych zadań), każda
umiejętność ma własny harmonogram powtórek w rosnących odstępach, a poziom
trudności rośnie po 8 poprawnych odpowiedziach z rzędu i spada przy 2 błędach
na 8. W symulacji z modelowym uczniem utrzymuje to skuteczność 75–85%. Błędne odpowiedzi nie są losowe — kodują typowe
pomyłki, a informacja zwrotna nazywa popełniony błąd zamiast tylko go
odnotować.

Domyślną metodą rzutowania jest **metoda pierwszego kąta** (europejska,
PN-EN ISO 5456-2). W ustawieniach można przełączyć na metodę trzeciego kąta.
Każdy układ rzutów ma obok symbol metody wymagany przez normę, a jeden
z wariantów zadania wymaga odczytania metody z samego symbolu.

### Test wstępny i końcowy

Przyrost mierzy się tym samym narzędziem przed nauką i po niej, tak jak robili
to Sorby i Baartmans z testem PSVT:R. Każde z ośmiu zadań pokazuje obrót na
jednej bryle i każe zastosować go do drugiej; na wyższych poziomach obrót jest
złożony z dwóch osi. Generator odrzuca zadania, w których przykład pasuje do
więcej niż jednego z 24 obrotów sześcianu, bo wtedy poprawnie odczytany obrót
mógłby prowadzić do innej odpowiedzi.

Certyfikat porównuje test wstępny z końcowym, a wynik egzaminu podaje osobno.
Test końcowy można powtarzać, a zapisywany jest ostatni wynik. Dlatego przy
wyniku z drugiego i kolejnego podejścia stoi jego numer: pomiarem jest
pierwsze podejście, każde następne jest już ćwiczeniem na tym samym typie
zadań.
Test jest wzorowany na PSVT:R, ale nim nie jest: ma 8 zadań zamiast 30 i nie
przeszedł walidacji psychometrycznej, więc pokazuje kierunek zmiany, nie wynik
porównywalny z normami.

---

### Dostępność

Całą aplikację da się obsłużyć z klawiatury. Opcje odpowiedzi, pola edytora
planu, pozycje kursu i nagłówki lekcji są przyciskami, więc działają pod Tab
i Enter. W trakcie zadania klawisze `1`–`5` wybierają odpowiedź, a `Enter`
przechodzi dalej. W edytorze planu strzałki w górę i w dół zmieniają wysokość
słupka. Na siatce szkicu strzałki przesuwają kursor po punktach (z `Shift` po
drugiej przekątnej), `Enter` rysuje, `Escape` przerywa, `Backspace` cofa,
a każdy ruch jest ogłaszany przez czytnik ekranu. Fokus jest widoczny, a informacja zwrotna po odpowiedzi ogłaszana
przez czytnik ekranu.

Ograniczenie, które warto znać: rysunki na płótnie mają opis słowny
(„bryła z 9 kostek, podstawa 3 na 3 pola, wysokość 3"), ale **opis nie
zastępuje obrazu**. Zadania na wyobraźnię przestrzenną wymagają zobaczenia
rysunku, więc dla osoby niewidomej aplikacja pozostaje nieprzydatna
merytorycznie, choć jest nawigowalna. Udawanie, że jest inaczej, byłoby
nieuczciwe.

### Testy

```bash
./testy/uruchom.sh          # logika, skrypt RLS, migracja RLS na PostgreSQL
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
- **Jednoznaczność zadań PSVT** — dla każdego zadania sprawdzane są wszystkie
  24 obroty sześcianu. Kontrola ograniczona do obrotów obecnych w opcjach
  przepuszczała 7% zadań z dwiema poprawnymi interpretacjami.
- **Linie niewidoczne kontra krawędzie 3D** — linie w rzutach są porównywane
  z wyliczeniem z krawędzi bryły w przestrzeni, niezależnym od kodu rzutów.
- **Szkic kontra algorytm malarza** — przypisanie ścian do trójkątów siatki
  jest porównywane z kolejnością rysowania używaną w rysunku bryły.
- **Elipsy kontra rozkład macierzy** — osie i obrót elips są liczone
  z wartości osobliwych rzutu ściany i porównywane ze stałymi aplikacji.
- **Jednoznaczność rzutów** — wyczerpujące przeszukanie brył o tych samych
  rzutach; bez linii niewidocznych 3–30% brył miało więcej niż jedno
  rozwiązanie.
- **Regulator trudności** — symulacja modelowego ucznia musi dać 75–85%
  skuteczności, bo tyle obiecuje opis.
- **Polityki RLS na prawdziwej bazie** — migracja jest uruchamiana dwukrotnie
  na tymczasowym PostgreSQL z imitacją Supabase oraz raz na bazie bez dawnej
  tabeli `subscriptions`, a 19 sprawdzeń weryfikuje,
  co widzi i co może zmienić każda rola oraz czy `auth.uid()` jest liczone
  raz na zapytanie. Sprawdzono też, że test wychwytuje celowo zepsutą
  politykę i nieopakowane `auth.uid()`.

Test przeglądarkowy przechodzi cały kurs od pierwszego modułu po certyfikat,
potwierdza, że oblany sprawdzian nie otwiera kolejnego modułu, rysuje szkic
prawdziwymi kliknięciami myszy i z klawiatury oraz sprawdza obsługę
z klawiatury w całej aplikacji.

Audyt treści i jego pomiary opisuje sekcja 11 w [METODYKA.md](METODYKA.md),
a uzasadnienie nowych modułów — sekcja 12.

### Recenzja merytoryczna

Treści nie sprawdził jeszcze nauczyciel rysunku technicznego, a tekstu norm
nie przeczytano. Do recenzji służy karta `recenzja/karta.md`, generowana
z kodu aplikacji: każde twierdzenie z lekcji i każdy tekst informacji zwrotnej
w osobnym wierszu, z miejscem na ocenę i uwagi.

```bash
node narzedzia/karta-recenzji.js > recenzja/karta.md   # po każdej zmianie treści
```

`./testy/uruchom.sh` kończy się błędem, gdy karta nie odpowiada aktualnej
treści. Recenzent kopiuje kartę jako `recenzja/RRRR-MM-nazwisko.md`
i wypełnia kopię.

---

## Powłoka SaaS (`index.html`)

Frontend bez frameworka. Backend to Supabase (autoryzacja i baza). Dostęp jest
bezpłatny: po założeniu konta wszystkie zakładki są otwarte.

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
| Quiz | Pytania jednokrotnego wyboru, dla każdego zalogowanego |
| Siatka izometryczna | Canvas 8×8, podgląd współrzędnych, malowanie kafelków |
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
```

#### Row Level Security

Klucz `anon` jest wpisany w źródło strony, więc każdy może odpytać API
bezpośrednio, z pominięciem interfejsu. Pytania są bezpłatne, ale bez polityk
RLS każdy mógłby też czytać cudze postępy, podrabiać je albo zmieniać treść
pytań. Polityki są w pliku migracji, który da się uruchamiać wielokrotnie:

```bash
supabase db push
# albo wklej supabase/migrations/20261007120000_rls.sql
# w Supabase → SQL Editor → Run
```

Polityki wywołują `(select auth.uid())`, a nie samo `auth.uid()`. Według
dokumentacji Supabase dzięki temu identyfikator liczy się raz na zapytanie
zamiast dla każdego wiersza, a doradca bazy nie zgłasza ostrzeżenia
`0003_auth_rls_initplan`.

| Tabela | Kto widzi | Kto zapisuje |
| --- | --- | --- |
| `questions` | każdy zalogowany | nikt z klientów — tylko panel Supabase |
| `progress` | właściciel wiersza | właściciel, tylko we własnym imieniu |

Jeśli w bazie została tabela `subscriptions` z czasów płatnego dostępu,
migracja zamyka ją dla klientów, ale nie usuwa danych. Możesz ją usunąć ręcznie
(`drop table subscriptions;`), gdy nie będzie już potrzebna.

Po wdrożeniu sprawdź szczelność z zewnątrz, tak jak widzi ją każdy, kto
otworzy źródło strony:

```bash
./testy/sprawdz-rls.sh
```

Skrypt tylko czyta i kończy się kodem `0`, gdy żadna tabela nie ujawnia danych,
`1` przy wycieku i `2`, gdy wynik jest nierozstrzygnięty — na przykład z braku
połączenia. Brak połączenia nigdy nie jest raportowany jako szczelność.
Pusta odpowiedź oznacza albo działającą politykę, albo pustą tabelę, więc
wynik rozstrzyga dopiero wtedy, gdy w `questions` jest co najmniej jedno pytanie.

#### Logowanie nazwą użytkownika

Supabase Auth wymaga adresu e-mail, dlatego nazwa użytkownika jest mapowana na
syntetyczny adres `<nazwa>@isomaster.local`, a prawdziwa nazwa trafia do
`user_metadata.username`.

Konieczne ustawienie w panelu Supabase:

> Authentication → Providers → Email → wyłącz **Confirm email**

Adresy w domenie `isomaster.local` nie istnieją, więc e-mail potwierdzający
nigdy by nie dotarł i rejestracja utknęłaby na etapie weryfikacji.

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
