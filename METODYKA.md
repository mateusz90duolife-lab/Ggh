# Metodyka: na czym oparto trener izometryki

Dokument opisuje, jakie metody nauczania izometryki i wyobraźni przestrzennej
zostały przyjęte za podstawę aplikacji `trener.html`, oraz jak każda z nich
przekłada się na konkretną funkcję programu.

> **Status źródeł.** Pierwsza wersja tego dokumentu opierała się wyłącznie
> na streszczeniach wyszukiwarki, bo środowisko robocze blokowało dostęp do
> stron źródłowych. W obecnej wersji **17 z 28 pozycji zostało przeczytanych**
> za pośrednictwem konektora Firecrawl — w całości albo w postaci dosłownych
> fragmentów wybranych pod kątem konkretnych pytań. Weryfikacja obaliła dwa
> twierdzenia z pierwszej wersji i doprecyzowała kilka innych; zmiany są
> opisane w tekście. Audyt treści samej aplikacji z października 2026
> znalazł kolejne błędy — opisuje je sekcja 11. Każda pozycja na liście
> źródeł ma oznaczenie, czy ją przeczytano. Liczby podane niżej pochodzą
> wyłącznie z pozycji oznaczonych jako przeczytane.

---

## 1. Punkt wyjścia: izometryka to trenowalna umiejętność przestrzenna

Rysunek izometryczny nie jest zbiorem reguł do zapamiętania, lecz wyrazem
**zdolności wyobraźni przestrzennej (spatial visualization)**, a ta jest
mierzalna i trenowalna. Najlepiej udokumentowany program jej treningu
prowadzili Sorby i Baartmans na Michigan Technological University.

**Co mówi tekst źródłowy (Sorby i Baartmans, 2000):**

- **Przyrost jest duży i powtarzalny.** Przez sześć edycji kursu GN102
  średni wynik PSVT:R rósł z około 50% do około 80%. Przyrosty wyniosły
  od 6,5 do 9,7 punktu na 30, czyli od 1,74 do 2,91 odchylenia
  standardowego, a autorzy zauważają, że to dziesięć razy więcej, niż
  tłumaczyłoby samo powtórne rozwiązywanie tego samego testu.
- **Różnica między płciami jest wyraźna.** W roczniku 1993, przy 535
  zbadanych osobach, testu nie zdało 39,3% kobiet i 12,0% mężczyzn.
  Kobiety stanowiły 22% badanych i prawie połowę osób z wynikiem
  niezaliczonym.
- **Wpływ na wytrwałość jest obiecujący, ale słabo udowodniony.** Grupa
  kursu liczyła 24 osoby, grupa porównawcza 72. Losowo wybierano osoby
  zapraszane, ale udział był dobrowolny. W programach inżynierskich
  wymagających wyobraźni przestrzennej zostało 69,2% mężczyzn i 63,6%
  kobiet z grupy kursu wobec 47,5% i 46,9% z grupy porównawczej. Dla
  zatrzymania na uczelni efekt widać tylko u kobiet (81,8% wobec 71,9%);
  u mężczyzn go nie ma (69,2% wobec 70,0%). Średnia ocen obu grup jest taka
  sama, a dla wskaźników wytrwałości autorzy nie podają testów istotności.

**Pierwsza wersja tego dokumentu zawierała dwa twierdzenia, których tekst
źródłowy nie potwierdza:**

- **„15–20 godzin".** Kurs GN102 trwał dziesięć tygodni po dwie godziny
  wykładu i dwie godziny laboratorium, czyli około 40 godzin. Liczba „około
  15 godzin" dotyczy późniejszej wersji szkolenia (ENGAGE: *about 15 hours
  of instruction*; Higher Education Services: dziesięć sesji po 1,5 godziny).
- **„Konstruowanie, szkicowanie i komputer — w tej kolejności".** Tekst
  mówi tylko, że kurs obejmuje te trzy rodzaje aktywności i że tematy są
  ułożone w logicznej kolejności. Kolejność konstruowanie → szkic występuje
  wewnątrz pojedynczych zajęć (tydzień 2 i 7: studenci budują bryłę
  z kostek, potem ją szkicują), ale nie jako zasada całego programu.

Nowsze dane z Michigan Tech (ENGAGE) są zgodne co do kierunku: 89%
ukończenia studiów wśród kobiet, które nie zdały PSVT:R i odbyły kurs,
wobec 68% wśród tych, które go nie odbyły. Są to jednak dane obserwacyjne,
bez losowego przydziału.

**Konsekwencja dla aplikacji:** program nie jest quizem z wiedzy, tylko
generatorem ćwiczeń przestrzennych. Materiał jest podzielony na
umiejętności odpowiadające tematom kursu Sorby.

---

## 2. Dwukierunkowość: rzuty ↔ bryła

Nauczyciele rysunku technicznego rozumieją rysunek izometryczny głównie
jako **przekształcanie rzutów 2D w bryłę 3D** (Mlambo, 2024). To badanie
jakościowe: wywiady z 7 nauczycielami z RPA, dobranymi według dostępności.
Daje obraz praktyki, nie miarę skuteczności.

Pierwsza wersja dokumentu powoływała się też na wynik, według którego odczyt
rzutów prostokątnych wywołuje wyższą aktywność mózgu niż odczyt widoku
izometrycznego. Po przeczytaniu źródła okazało się, że praca Setiyawana
i współautorów (2025) to wywiady z 5 praktykami przemysłowymi, a ten wynik
jedynie cytuje za Lukačeviciem i współautorami. Oryginału nie przeczytano.

**Konsekwencja dla aplikacji:** oba kierunki są osobnymi umiejętnościami
z osobnym śledzeniem postępu. Waga 1,3 dla odczytu rzutów jest decyzją
projektową, nie wnioskiem z pomiaru.

| Umiejętność | Kierunek |
| --- | --- |
| `rzuty-bryla` | trzy rzuty → wybór bryły |
| `bryla-rzut` | bryła → wybór poprawnego rzutu |

---

## 3. Konstruowanie zamiast rozpoznawania

W kursie Sorby studenci budują bryły z kostek według planów kodowanych,
a potem szkicują je na papierze z siatką. Obroty też ćwiczą na bryłach
z kostek, które fizycznie obracają przed narysowaniem.

Ozden (2025) zbadała aplikację do szkicowania odręcznego z natychmiastową
informacją zwrotną. Grupa ćwicząca poprawiła wynik PSVT:R z 52,9 do 62,0
punktu na 78 (p = 0,005, d = 0,85), grupa porównawcza z 50,3 do 52,7
(p = 0,58). Ograniczenia są poważne i autorka je wymienia: 12 osób wobec 7,
brak losowego przydziału, każdą grupę uczył inny prowadzący. Twierdzenie
autorki, że przyrost wynika z narzędzia, a nie z innych czynników, idzie
dalej, niż pozwala ten układ badania.

Pierwsza wersja tego dokumentu przypisywała pracy Mlambo (2024) wynik, że
łączenie modeli z CAD poprawia wyniki. Ta praca niczego nie mierzy, a taki
wynik jedynie przytacza za innymi autorami. Zaznacza wręcz, że uczniowie
nadal mają trudności mimo stosowania zalecanych metod.

Odpowiedź wielokrotnego wyboru pozwala zgadywać. Konstruowanie nie pozwala.

**Konsekwencja dla aplikacji:** dwa tryby, w których nic się nie wybiera
z listy.

- **Buduj** — edytor planu kodowanego z podglądem izometrycznym na żywo.
  Uczeń dostaje trzy rzuty i stawia bryłę słupek po słupku. Poprawna jest
  bryła wzorcowa albo każda inna o identycznych trzech rzutach (sekcja 11).
  W kursie jest to zadanie konstrukcyjne modułu „Czytanie rzutów”.
- **Szkicuj** — rysunek izometryczny na siatce punktowej, z planu kodowanego
  albo z trzech rzutów. Szkic składa się z odcinków między sąsiednimi
  punktami siatki, więc da się go sprawdzić ściśle, bez rozpoznawania obrazu:
  program porównuje zbiór narysowanych odcinków z rysunkiem bryły,
  z dokładnością do przesunięcia, i pokazuje odcinki brakujące i zbędne.
  Szkicowanie ma w kursie własny moduł, a jego sprawdzian składa się
  wyłącznie ze szkiców.

---

## 4. Plany kodowane jako pomost

Plan kodowany to siatka rzutu z góry z liczbą kostek wpisaną w każde pole.
W kursie Sorby pojawia się już w drugim tygodniu: *students are given a set
of snap cubes so that they can construct a building according to coded
plans*. Redukuje bryłę do zapisu, który da się odczytać analitycznie.

**Konsekwencja dla aplikacji:** plan kodowany jest jednocześnie formatem
zadania (`plan-bryla`), interfejsem edytora w trybie Buduj i wewnętrzną
reprezentacją generatora brył. Bryły są generowane jako mapy wysokości,
więc każda ma jednoznaczny plan kodowany.

---

## 5. Dystraktory oparte na realnych błędach

To zasada projektowa, nie wniosek z konkretnego źródła: błędne odpowiedzi
powinny odpowiadać typowym pomyłkom, a nie być losowe. Aplikacja generuje
dystraktory przez celowe zaburzenie poprawnej odpowiedzi, a każdy rodzaj
zaburzenia ma nazwę, którą widać w informacji zwrotnej.

| Dystraktor | Błąd, który wykrywa |
| --- | --- |
| odbicie lustrzane | mylenie obrotu z odbiciem |
| obrót w złą stronę | zgubiony zwrot obrotu |
| obrót wokół złej osi | zgubiona oś |
| przesunięta jedna kostka | pobieżne porównanie |
| zamieniony rzut | mylenie rzutu z góry z rzutem z przodu |
| ten sam zarys, inne uskoki | pominięcie linii wewnętrznych |
| liczba widocznych kostek | pominięcie kostek zasłoniętych |
| elipsa obrócona o 90° lub z innej ściany | mylenie kierunku dużej osi elipsy |
| okrąg zamiast elipsy | przekonanie, że okrąg w izometrii pozostaje okręgiem |
| osie elipsy ze skrótem 0,816 | pomylenie rysunku bez skrótu z rzutem ścisłym |
| końce skosu zamienione | mierzenie odcinków w złych kierunkach |
| skos w innej płaszczyźnie | brak powiązania linii pochyłej z rzutem, w którym ją widać |

---

## 6. Przeplatanie, powtórki rozłożone i pożądane trudności

MIT Open Learning streszcza to tak: nauka rozłożona w czasie daje lepsze
wyniki niż sesje skupione, a przeplatanie typów zadań daje *higher learning
gains* niż ćwiczenie ich blokami. Oba zabiegi *can mean slower initial
learning*, ale poprawiają zapamiętanie i umiejętność rozróżniania typów
zadań. Źródło powołuje się na Taylor i Rohrera.

**Konsekwencja dla aplikacji:**

- Zadania w treningu są **przeplatane** — ta sama umiejętność nie powtórzy
  się w ciągu trzech kolejnych zadań.
- Każda umiejętność ma **pudełko Leitnera** i termin następnej powtórki.
  Umiejętności zaległe mają priorytet w losowaniu.
- Poziom trudności dobiera się tak, by skuteczność trzymała się w okolicy
  **75–85%**. To decyzja projektowa inspirowana zasadą pożądanych trudności
  (Bjork); źródła tej zasady nie przeczytano. Poziom rośnie po 8 poprawnych
  odpowiedziach z rzędu i spada, gdy wśród ostatnich 8 są co najmniej
  2 błędy. Pierwsza wersja miała inne progi i — jak pokazała symulacja —
  nie realizowała tego celu (sekcja 11).

---

## 7. Test wstępny i końcowy w formacie PSVT:R

PSVT:R (Guay, 1977) to 30 zadań o rosnącej trudności z limitem 20 minut.
Wersja poprawiona (Yoon, 2011) ma 2 zadania wprowadzające i 30 testowych,
13 z bryłami symetrycznymi i 17 z niesymetrycznymi, uporządkowane od
najłatwiejszych. Jest przeznaczona dla osób od 13. roku życia. Sorby
i Baartmans używali PSVT:R jako testu wstępnego i końcowego — dokładnie tym
samym narzędziem przed kursem i po nim.

Pierwsza wersja aplikacji miała w tym miejscu dwie wady:

- **Test wstępny nie był w formacie PSVT:R**, choć ten dokument tak
  twierdził. Zadania podawały obrót słownie („obróć o 90° w prawo"), zamiast
  pokazać go na przykładzie.
- **Certyfikat porównywał test wstępny z egzaminem końcowym**, czyli dwa
  różne narzędzia. Różnica wyników nie mierzyła więc przyrostu.

**Obecnie:** test wstępny i test końcowy to to samo narzędzie w formacie
PSVT:R. Każde zadanie pokazuje bryłę przed obrotem i po obrocie, a potem
drugą bryłę, którą trzeba obrócić tak samo. Osiem zadań o rosnącej
trudności. Certyfikat porównuje test wstępny z końcowym, a wynik egzaminu
podaje osobno.

Test końcowy da się powtarzać, a zapisywany jest ostatni wynik. Powtarzanie
do skutku zawyżyłoby przyrost, więc przy wyniku stoi numer podejścia.
Rzetelnym pomiarem jest pierwsze podejście.

Jest to test **wzorowany** na PSVT:R, a nie PSVT:R. Ma 8 zadań zamiast 30,
bryły z kostek zamiast brył z płaszczyznami ukośnymi i nie przeszedł
walidacji psychometrycznej. Jego wynik pokazuje kierunek zmiany u jednej
osoby, nie jest porównywalny z normami testu oryginalnego.

---

## 8. Norma: metoda pierwszego kąta

Aplikacja jest polska, więc domyślnym układem rzutów jest **metoda
pierwszego kąta** (dawniej „metoda E"), zgodna z PN-EN ISO 5456-2.

Obie metody dają **te same rzuty**, a różnią się tylko ich rozmieszczeniem.
Wikipedia ujmuje to wprost: *both first-angle and third-angle projections
result in the same 6 views; the difference between them is the arrangement
of these views*.

| Rzut | Metoda pierwszego kąta (E) | Metoda trzeciego kąta (A) |
| --- | --- | --- |
| z góry | **pod** rzutem głównym | nad rzutem głównym |
| z lewej strony | **po prawej** stronie | po lewej stronie |
| z prawej strony | **po lewej** stronie | po prawej stronie |

**Symbol metody.** Norma wymaga na rysunku symbolu: ściętego stożka
narysowanego w dwóch rzutach. Widziany od węższego końca daje dwa
współśrodkowe okręgi, widziany z boku — trapez. Symbol to po prostu
zasada rozmieszczenia zastosowana do stożka, dlatego oba warianty są
swoimi lustrzanymi odbiciami:

- **pierwszy kąt:** krótszy bok trapezu jest **odwrócony od** okręgów;
- **trzeci kąt:** krótszy bok trapezu jest **zwrócony do** okręgów.

Pierwsza wersja aplikacji symbolu nie rysowała, bo dostępne wtedy
streszczenia przeczyły sobie co do jego orientacji. Obecnie orientacja jest
potwierdzona w dwóch niezależnych źródłach (Wikipedia i SizeMarker), zgodna
z wyprowadzeniem z zasady rozmieszczenia i symbol jest rysowany przy każdym
układzie rzutów. Treści samej normy nadal nie przeczytano: dostępna próbka
ISO 5456-2 jest skanem, z którego da się wydobyć tylko znak wodny. Proporcje
symbolu w aplikacji są więc przybliżone; zgodny z normą jest kierunek
trapezu względem okręgów, bo to on niesie znaczenie.

---

## 9. Kurs liniowy obok treningu przeplatanego

To jedyne miejsce, w którym dwie zasady stoją naprzeciw siebie.

**Przeplatanie wygrywa z blokowaniem** przy utrwalaniu. **A jednak kurs
prowadzi po kolei**, a materiał ułożony temat po temacie to z definicji
praktyka blokowa.

Sprzeczność jest pozorna, bo zasady odpowiadają na inne pytania.
Przeplatanie dotyczy **utrwalania** tego, co już rozumiane. Kolejność
tematyczna dotyczy **budowania** rozumienia od zera. Nie da się przeplatać
przekrojów z obrotami, zanim uczeń wie, czym jest plan kodowany. Kurs Sorby
też jest ułożony tematycznie, tydzień po tygodniu.

| Tryb | Rola | Kolejność zadań |
| --- | --- | --- |
| **Kurs** | zbudować rozumienie po kolei | blokowa, temat po temacie |
| **Trening** | utrwalić i utrzymać | przeplatana, sterowana powtórkami |

Kurs ma dwanaście modułów w kolejności tematów kursu „Developing Spatial
Thinking”: osie i plan kodowany, szkicowanie izometryczne, rzuty, krawędzie
widoczne i niewidoczne, czytanie rzutów, powierzchnie pochyłe i krzywe,
obroty wokół jednej i dwóch osi, odbicia, przekroje, a na końcu norma
rozmieszczenia rzutów. Każdy moduł zamyka sprawdzian na progu około 80%
(5 z 6 albo 3 z 4 szkiców), który otwiera kolejny moduł. Egzamin końcowy —
14 zadań, próg 11 — miesza wszystkie umiejętności, bo na tym etapie
sprawdzamy transfer. Odpowiedzi z kursu zasilają ten sam model ucznia co
trening, więc po kursie harmonogram powtórek jest gotowy.

Z dziesięciu modułów kursu Sorby aplikacja nie obejmuje trzech: brył
obrotowych, łączenia brył i rozwinięć (siatek brył). Silnik oparty na
kostkach ich nie wyrazi — patrz sekcja 12.

**Uwaga o czasie:** kurs to niecałe trzy godziny, a sprawdzone programy
trwają około 15 godzin (wersja obecna) albo około 40 (pierwotny GN102).
Kurs jest rusztowaniem, nie całą nauką. Objętość ma dostarczyć regularny
trening.

---

## 10. Czego aplikacja świadomie nie robi

- **Nie zastępuje klocków.** W kursie Sorby studenci trzymają fizyczną
  bryłę w rękach, kiedy ją szkicują. Tryb Buduj jest namiastką tego etapu,
  nie zamiennikiem.
- **Nie ocenia szkicu odręcznego.** Wiarygodna ocena odręcznego rysunku
  wymagałaby rozpoznawania obrazu. Ocenia szkic na siatce punktowej, gdzie
  sprawdzenie jest ścisłe. Odręczne szkicowanie na papierze zostaje
  ćwiczeniem poza aplikacją.
- **Nie uczy CAD.** Zakres to wyobraźnia przestrzenna i czytanie rysunku.
- **Nie mierzy psychometrycznie.** Test wstępny i końcowy pokazują kierunek
  zmiany, nie wynik porównywalny z normami PSVT:R.

---

## 11. Audyt treści aplikacji (październik 2026)

Każde twierdzenie w lekcjach, podpowiedziach i informacji zwrotnej
porównano ze źródłami, a każdą obietnicę opisu — z tym, co kod faktycznie
robi. Tam, gdzie się dało, zmierzono to automatycznie; pomiary są stałą
częścią testów (`testy/logika.js`, sekcje 21–29).

**Błędy merytoryczne w lekcjach**

| Miejsce | Było | Jest | Podstawa |
| --- | --- | --- | --- |
| Odbicia | Lekcja pokazywała bryłę z dwiema płaszczyznami symetrii i twierdziła, że jej odbicia nie da się uzyskać obrotem. Tymczasem było ono obrotem o 90°. | Bryła chiralna; test pilnuje chiralności. | sprawdzenie wszystkich 24 obrotów |
| Odbicia | „Policz kostki wzdłuż krawędzi — odbicie odwróci kolejność zawsze.” Ciąg wzdłuż jednej krawędzi odwraca także obrót o 180°. | Reguła dłoni: obrót zachowuje skrętność trójki kierunków, odbicie ją odwraca. | geometria |
| Obroty wokół osi poziomych | „Przechylenie do tyłu — przód wędruje pod spód.” To opis przechylenia do przodu. | Przy przechyleniu do tyłu przód idzie do góry, tył pod spód. | definicje obrotów w kodzie |
| Przekroje | „Przekrój nie pokazuje tego, co leży za płaszczyzną.” W rysunku technicznym to definicja kładu; przekrój pokazuje także zarysy za płaszczyzną. | Lekcja rozróżnia kład i przekrój; zadania pytają o kład, który jest kreskowany. | PCEZ Bytów, WAT |
| Krawędzie | Krawędzie wewnątrz zarysu rysowane cienką linią jako „uskoki”, brak krawędzi niewidocznych. | Wszystkie krawędzie widoczne linią ciągłą grubą, niewidoczne — kreskową cienką. | PN-EN ISO 128 wg materiałów PCEZ i AGH |
| Czytanie rzutów | „Procedura działa zawsze; przecięcie ograniczeń wyznacza wysokość każdego słupka.” Ograniczenia to tylko górne granice. | Czwarty krok: linie wewnętrzne i niewidoczne rozstrzygają wysokości ukrytych słupków. | wyczerpujące przeszukanie brył |
| Osie | „Wszystkie trzy wymiary są mierzalne w tej samej skali.” | Tylko wzdłuż osi; linie pochyłe, kąty i okręgi są zniekształcone. | SDC Publications |
| Osie | Skrót 0,816 nazwany „izometrią znormalizowaną”. Źródła różnią się co do tego, co dokładnie zaleca norma, a treści normy nie przeczytano. | Rzut ścisły (0,816) i rysowanie bez skrótu opisane bez przypisywania normie. | PCEZ Bytów |
| Plan kodowany | „Zapisuje bryłę jednoznacznie.” | Jednoznacznie dla brył bez nawisów. | geometria |
| Strategie | „Badania wyróżniają dwa style; całościowy zawodzi przy złożonych bryłach” — bez źródła. | Wynik Khooshabeha, Hegarty i Shipleya (2013) z odwołaniem. | Semantic Scholar, streszczenie |
| Kilka lekcji | Superlatywy bez źródła („najczęstsze źródło pomyłek”, „najczęstsza pułapka”). | Złagodzone. | — |

**Rozbieżności między opisem a działaniem programu**

| Obszar | Pomiar przed poprawką | Poprawka | Pomiar po poprawce |
| --- | --- | --- | --- |
| Chiralność brył w zadaniach na obrót i odbicie | 45% (poziom 1), 20% (poziom 3) brył achiralnych; dla nich informacja zwrotna „odbicia nie da się uzyskać obrotem” była fałszywa | sprawdzenie wszystkich 24 obrotów zamiast 3 przekształceń | 0 na 287 dystraktorów |
| Zadania rzuty → bryła | 0,5–3,3% zadań miało dwie poprawne odpowiedzi | odrzucanie dystraktorów o identycznych trzech rzutach | 0 na 300 zadań |
| Tryb Buduj | 3–30% brył (zależnie od poziomu) miało rzuty, które pasowały do kilku brył, a program uznawał tylko jedną | linie niewidoczne w rzutach i akceptacja każdej bryły o identycznych rzutach | 0 niejednoznacznych na 1200 brył |
| Regulator trudności | Opis obiecywał 75–85%; symulacja z modelowym uczniem dała 62–67% | progi: w górę po 8 z 8, w dół przy co najwyżej 6 z 8 | 76–84% w symulacji |

Symulacja regulatora zakłada ucznia, którego szansa sukcesu maleje
logistycznie z poziomem; wynik zależy od nachylenia tej krzywej. Pokazuje
więc, że reguła realizuje zamierzony cel dla rozsądnych założeń, a nie że
każdy uczeń utrzyma dokładnie taką skuteczność.

## 12. Dodatki niezbędne do opanowania izometrii

Porównanie z kursem Sorby i z praktyką rysunku technicznego pokazało, że
pierwsza wersja uczyła wyłącznie **rozpoznawania** brył z kostek. Brakowało
czterech rzeczy, bez których rysunku izometrycznego nie da się opanować.
Wszystkie zostały dodane.

| Dodatek | Dlaczego niezbędny | Co robi aplikacja |
| --- | --- | --- |
| **Szkicowanie na siatce izometrycznej** | Rysunek izometryczny to umiejętność wytwórcza, a test wyboru sprawdza tylko rozpoznawanie. Kurs Sorby szkicuje od trzeciego tygodnia; Ozden (2025) — mała próba, bez losowego przydziału — zanotowała przyrost PSVT:R przy szkicowaniu z natychmiastową informacją zwrotną. | Moduł kursu, zakładka Szkicuj i zadanie w treningu. Sprawdzanie odcinek po odcinku, dwie próby, wskazanie braków i nadmiarów. |
| **Linie pochyłe (nieizometryczne)** | Prawdziwe części mają skosy i fazki. Linii pochyłej nie da się odmierzyć wprost, a kąty są zniekształcone — trzeba wyznaczać jej końce. To moduł 5 kursu Sorby. | Lekcja z rysunkiem i zadanie: rzuty bryły ze ściętą krawędzią → wybór rysunku izometrycznego. |
| **Okręgi w izometrii** | Otwory i walce są na niemal każdym rysunku części. Najczęstszy błąd to zła orientacja elipsy. | Lekcja i dwa rodzaje zadań: orientacja elipsy na każdej ze ścian i wymiary osi bez skrótu (1,22·d × 0,71·d). |
| **Krawędzie niewidoczne w rzutach** | Na prawdziwym rysunku rzuty mają linie kreskowe. Bez nich nie da się czytać rysunków, a trzy rzuty nie wyznaczają bryły jednoznacznie. | Wszystkie rzuty zgodne z PN-EN ISO 128; nowa lekcja; zadania z tym samym zarysem rozróżniane także liniami niewidocznymi. |

**Czego nadal brakuje** — trzy moduły kursu Sorby, których silnik oparty na
kostkach nie wyrazi:

- **rozwinięcia (siatki brył)** — składanie i rozkładanie powierzchni,
  przydatne przy blachach i opakowaniach;
- **bryły obrotowe** — walec, stożek i kula powstające z obrotu figury płaskiej;
- **łączenie brył** — suma, różnica i część wspólna.

Do tego dochodzą rzeczy, których żadna aplikacja nie zastąpi: budowanie
z prawdziwych kostek przed szkicowaniem i szkicowanie odręczne na papierze.
Rekomendacja dla ucznia: równolegle z kursem w aplikacji szkicować te same
bryły ołówkiem na wydrukowanej siatce izometrycznej.

---

## Źródła

Oznaczenia:

- **(P)** — przeczytane. Pełny tekst albo dosłowne fragmenty pobrane przez
  konektor Firecrawl. Wszystkie liczby w dokumencie pochodzą z tych pozycji.
- **(S)** — nieprzeczytane; korzystano tylko ze streszczenia wyszukiwarki.
  Nic istotnego w dokumencie nie opiera się wyłącznie na nich.
- **(B)** — wskazówka bibliograficzna; nic nie jest z niej cytowane.

**Wyobraźnia przestrzenna i kurs Sorby**

- (P) Sorby, S. A., Baartmans, B. J. (2000). [The Development and Assessment of a Course for Enhancing the 3-D Spatial Visualization Skills of First Year Engineering Students](https://www.vanderbilt.edu/GISEd/wp-content/uploads/Sorby_DevelopmentAssessmentCourse-Enhancing3DSpatialVisualizationSkillsEngineering.pdf). *Journal of Engineering Education*. Pełny tekst.
- (P) [Spatial Visualization Skills: Learn More](https://www.engageengineering.org/spatial/whyitworks/learnmore). ENGAGE Engineering.
- (P) [Classroom Course: Developing Spatial Thinking](https://www.higheredservices.org/classroom-course/). Higher Education Services.
- (B) [Sorby, Developing 3-D Spatial Visualization Skills](https://www.edgj.org/index.php/EDGJ/article/view/126). *Engineering Design Graphics Journal*.
- (B) [Sheryl Sorby Supports Women's Learning with Spatial Visualization Course at OSU](https://eed.osu.edu/news/2016/02/sheryl-sorby-supports-women%E2%80%99s-learning-spatial-visualization-course-osu). Strona nie zwróciła treści; dane o różnicach płci pochodzą z pracy z 2000 roku.
- (B) [Spatial skills are building blocks to STEM success](https://engineering.osu.edu/news/2016/02/spatial-skills-are-building-blocks-stem-success). Ohio State.

**Dydaktyka rysunku technicznego**

- (P) Mlambo, P. B. (2024). [Instructional practices by engineering graphics and design teachers: A focus on teaching and learning of isometric drawing](https://files.eric.ed.gov/fulltext/EJ1440807.pdf). *Research in Social Sciences and Technology*, 9(2), 359–376. Pełny tekst.
- (P) Ozden, B. (2025). [Investigating the Impact of an Online Freehand Sketching and Spatial Visualization Intervention on First-Year Engineering Students](https://peer.asee.org/investigating-the-impact-of-an-online-freehand-sketching-and-spatial-visualization-intervention-on-first-year-engineering-students-skills-and-cognitive-development.pdf). ASEE. Fragmenty: układ badania, wyniki, ograniczenia.
- (P) Setiyawan, A. i in. (2025). [How orthographic projection engineering drawing support VHS students in their future career](https://journals.sagepub.com/doi/10.1177/03064190251377899). *International Journal of Mechanical Engineering Education*. Fragmenty: układ badania i cytowanie Lukačevicia.

**Pomiar wyobraźni przestrzennej**

- (P) [Purdue Spatial Visualization Test: Visualization of Rotations](https://en.wikipedia.org/wiki/Purdue_Spatial_Visualization_Test:_Visualization_of_Rotations). Wikipedia.
- (P) [Revised PSVT:R](https://www.spatiallearning.org/tools/revised-purdue-spatial-visualization-test-revised-psvtr-visualization-of-rotations). Spatial Intelligence and Learning Center. Podaje rok testu oryginalnego jako 1976; Wikipedia i praca Sorby'ego — 1977.

- (P) [Presentation Slides — Developing Spatial Thinking](https://www.higheredservices.org/wp-content/uploads/2016/05/DevelopingSpatialThinkingPresentationSlides2016.pdf). Higher Education Services. Fragment: lista dziesięciu modułów kursu.
- (P) Khooshabeh, P., Hegarty, M., Shipley, T. F. (2013). [Individual differences in mental rotation: piecemeal versus holistic processing](https://www.semanticscholar.org/paper/Individual-differences-in-mental-rotation%3A-versus-Khooshabeh-Hegarty/9220cbe8b1dff1d4873c9a4d07d29cb415e6b25f). *Experimental Psychology*. Streszczenie.

**Psychologia uczenia się**

- (P) [Spaced and interleaved practice](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/spaced-and-interleaved-practice). MIT Open Learning.
- (S) [The Effectiveness of Spaced Learning, Interleaving, and Retrieval Practice in Radiology Education](https://www.sciencedirect.com/science/article/pii/S1546144023006464). ScienceDirect.
- (S) [Desirable Difficulties: Bjork's principles](https://www.structural-learning.com/post/desirable-difficulties). Structural Learning.

**Norma i metody rzutowania**

- (P) [Multiview orthographic projection](https://en.wikipedia.org/wiki/Multiview_orthographic_projection). Wikipedia. Rozmieszczenie rzutów i orientacja symbolu.
- (P) [First Angle vs Third Angle Projection: 5-Second Test](https://www.sizemarker.com/blog/first-angle-vs-third-angle-projection). SizeMarker. Orientacja symbolu.
- (S) [First vs Third Angle Orthographic Views](https://www.gdandtbasics.com/first-vs-third-angle-orthographic-views/). GD&T Basics. Zastąpione dwoma pozycjami powyżej.
- (B) [ISO 5456-2:1996, próbka](https://cdn.standards.iteh.ai/samples/11502/b576be294da54eaab2b3b3fa748b8d1d/ISO-5456-2-1996.pdf). Skan; z próbki da się wydobyć tylko znak wodny.
- (B) [PN-EN ISO 5456-2:2002](https://sklep.pkn.pl/pn-en-iso-5456-2-2002p.html). Polski Komitet Normalizacyjny.
- (B) [Rzutowanie prostokątne](https://cms.upsl.edu.pl/content/download/7811/file/Rzutowanie%20Prostok%C4%85tne.pdf). Materiały UPSL.

**Rysunek techniczny: linie, przekroje, aksonometria**

- (P) [Moduł 1. Rodzaje rysunku i jego elementy składowe](http://www.pcez-bytow.pl/download/plk/1.1-rtdbm-tresc-20.01.21.pdf). PCEZ Bytów. Fragmenty: definicje widoku, kładu i przekroju.
- (P) [Rzuty aksonometryczne](http://www.pcez-bytow.pl/download/plk/rzuty-aksonometryczne.pdf). PCEZ Bytów. Fragmenty: skrót 0,816 w izometrii, osie elips (d i 0,58·d; bez skrótu 1,2·d i 0,7·d).
- (P) [Widoki, przekroje, kłady](https://www.wim.wat.edu.pl/wp-content/uploads/2024/01/widoki_przekroje_klady.pdf). WAT, Wydział Inżynierii Mechanicznej. Fragmenty: kład jako odmiana przekroju.
- (P) [Design Graphics for Engineering Communication, rozdz. 4 (próbka)](https://static.sdcpublications.com/pdfsample/978-1-58503-909-8-4.pdf). SDC Publications. Fragmenty: linie nieizometryczne, elipsy w rombie, linie niewidoczne w rysunkach aksonometrycznych.
- (S) [Linie na rysunku technicznym](https://www.cognity.pl/linie-na-rysunku-technicznym-jak-stosowac), [materiały PRz](https://e-learning.prz.edu.pl/), [materiały AGH](https://galaxy.agh.edu.pl/~olesiak/rysunek/01_wprowadzenie.pdf) — zgodne streszczenia: krawędzie widoczne linią ciągłą grubą, niewidoczne kreskową.
- (B) [ISO 5456-3:1996, próbka](https://cdn.standards.iteh.ai/samples/11503/006c88f9e0b040618800ce7a590d049f/ISO-5456-3-1996.pdf). Skan; tekstu nie udało się wydobyć, więc aplikacja nie przypisuje normie konkretnej skali izometrii.
