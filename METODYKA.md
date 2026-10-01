# Metodyka: na czym oparto trener izometryki

Dokument opisuje, jakie metody nauczania izometryki i wyobraźni przestrzennej
zostały przyjęte za podstawę aplikacji `trener.html`, oraz jak każda z nich
przekłada się na konkretną funkcję programu.

> **Status źródeł — przeczytaj przed powołaniem się na ten dokument.**
> Żadna z publikacji wymienionych na końcu nie została otwarta przy pisaniu
> tego tekstu. Środowisko, w którym powstawał, blokowało ruch wychodzący do
> wszystkich tych domen. Twierdzenia pochodzą ze **streszczeń wyników
> wyszukiwarki**, nie z tekstów źródłowych. To wystarcza do podjęcia decyzji
> projektowych w aplikacji edukacyjnej, ale **nie wystarcza do cytowania w
> pracy naukowej ani do powoływania się na konkretne liczby**. Przed takim
> użyciem trzeba sięgnąć do oryginałów. Lista na końcu oznacza, które
> stwierdzenia są jak dobrze umocowane.

---

## 1. Punkt wyjścia: izometryka to trenowalna umiejętność przestrzenna

Najważniejszy wniosek z badań nad kształceniem grafiki inżynierskiej jest taki,
że rysunek izometryczny nie jest zbiorem reguł do zapamiętania, lecz wyrazem
**zdolności wyobraźni przestrzennej (spatial visualization)**, a ta jest
mierzalna i trenowalna.

Sheryl Sorby (Michigan Tech, Ohio State) prowadziła te badania przez ponad 20
lat. Ustalenia, które kształtują konstrukcję tej aplikacji:

- Zdolności przestrzenne dają się wyćwiczyć w krótkim czasie: kurs obejmuje
  **15–20 godzin** ćwiczeń, nie cały semestr.
- Studentom, którzy poprawili wynik, przypisuje się **wyższy wskaźnik
  pozostania na kierunku** niż tym ze słabymi zdolnościami, którzy ich nie
  poprawili. To zależność obserwacyjna — nie wynika z niej, że sam trening
  zatrzymuje studentów na studiach.
- Deficyt dotyka nieproporcjonalnie kobiet, co czyni trening kwestią
  wyrównywania szans, a nie tylko techniki.
- Skuteczny program łączy trzy rodzaje aktywności: **konstruowanie fizyczne
  (klocki), szkicowanie odręczne i pracę z komputerem** — w tej kolejności.

Materiał "Developing Spatial Thinking" jest podzielony na **10 modułów po ok.
1,5 godziny**, obejmujących m.in. rysunki izometryczne, rzuty prostokątne,
obroty 3D, rozwinięcia, odbicia i symetrię, bryły obrotowe, przekroje oraz
łączenie brył.

**Konsekwencja dla aplikacji:** program nie jest quizem z wiedzy, tylko
generatorem ćwiczeń przestrzennych. Sesja trwa kilkanaście minut, a materiał
jest podzielony na umiejętności składowe odpowiadające modułom Sorby.

---

## 2. Dwukierunkowość: rzuty ↔ bryła

Badania nad dydaktyką rysunku technicznego pokazują, że nauczyciele najczęściej
rozumieją rysunek izometryczny jako **przekształcanie rzutów 2D w figurę 3D** i
w tym kierunku prowadzą ćwiczenia. Tymczasem kierunek odwrotny bywa opisywany jako trudniejszy: według
streszczenia jednego z badań odczyt rzutów prostokątnych wiąże się z wyższą
aktywnością mózgu niż odczyt widoku izometrycznego. Tego pojedynczego wyniku
nie zweryfikowano w źródle, więc traktujemy go jako przesłankę, a nie dowód —
waga 1,3 dla odczytu rzutów jest decyzją projektową, nie wnioskiem z pomiaru.

**Konsekwencja dla aplikacji:** oba kierunki są osobnymi umiejętnościami z
osobnym śledzeniem postępu:

| Umiejętność | Kierunek |
| --- | --- |
| `rzuty-bryla` | trzy rzuty → wybór bryły |
| `bryla-rzut` | bryła → wybór poprawnego rzutu |

Trudniejszy kierunek (odczyt rzutów) dostaje wyższą wagę w doborze zadań.

---

## 3. Konstruowanie zamiast rozpoznawania

Ćwiczenia typu "zbuduj obiekt z klocków i naszkicuj go z różnych stron" są
rdzeniem sprawdzonego programu. Badania nad interwencjami łączącymi **szkic
odręczny** z treningiem przestrzennym pokazują istotne statystycznie przyrosty
w teście PSVT:R. Integrowanie realnych modeli z instrukcją CAD poprawiało wyniki
— zaangażowanie dotykowe i wizualne pomaga zrozumieć zasady rzutowania.

Odpowiedź wielokrotnego wyboru pozwala zgadywać. Konstruowanie nie pozwala.

**Konsekwencja dla aplikacji:** tryb **Buduj** — interaktywny edytor planu
kodowanego z podglądem izometrycznym na żywo. Uczeń dostaje trzy rzuty i musi
zbudować bryłę, stawiając słupki kostek. Sprawdzenie porównuje zbiory wokseli,
więc liczy się dokładna zgodność, a nie rozpoznanie.

---

## 4. Plany kodowane jako pomost

Plan kodowany (siatka rzutu z góry z liczbą kostek wpisaną w każde pole) to
klasyczne narzędzie z programu Sorby. Redukuje bryłę do zapisu, który da się
odczytać analitycznie, i stanowi pomost między myśleniem całościowym a
analitycznym.

**Konsekwencja dla aplikacji:** plan kodowany jest jednocześnie formatem
zadania (`plan-bryla`), interfejsem edytora w trybie Buduj i wewnętrzną
reprezentacją generatora brył. Bryły są generowane jako mapy wysokości, dzięki
czemu każda bryła ma jednoznaczny plan kodowany.

---

## 5. Dystraktory oparte na realnych błędach

W profesjonalnych materiałach testowych błędne odpowiedzi nie są losowe —
kodują typowe pomyłki. Aplikacja generuje dystraktory przez celowe zaburzenie
poprawnej odpowiedzi, a każdy typ zaburzenia ma nazwę, którą widać w informacji
zwrotnej:

| Dystraktor | Błąd, który wykrywa |
| --- | --- |
| odbicie lustrzane | mylenie obrotu z odbiciem |
| obrót w złą stronę | zgubiony zwrot obrotu |
| obrót wokół złej osi | zgubiona oś |
| przesunięta jedna kostka | pobieżne porównanie |
| zamieniony rzut | mylenie rzutu z góry z rzutem z przodu |
| liczba widocznych kostek | pominięcie kostek zasłoniętych |

Dzięki temu informacja zwrotna nie brzmi "źle", tylko nazywa popełniony błąd.
Jest to zastosowanie zasady, że sprzężenie zwrotne ma wskazywać przyczynę,
a nie tylko wynik.

---

## 6. Przeplatanie, powtórki rozłożone i pożądane trudności

Zasady z psychologii poznawczej, potwierdzone m.in. przeglądami systematycznymi
w edukacji medycznej:

- **Retrieval practice** — aktywne przypominanie bije bierny przegląd.
- **Spaced repetition** — powtórka po przerwie utrwala trwalej niż powtórka
  natychmiastowa.
- **Interleaving** — mieszanie typów zadań utrudnia naukę w trakcie, ale
  poprawia transfer, bo zmusza do rozróżniania podobnych przypadków.
- **Desirable difficulties** (Bjork) — warunki obniżające płynność ćwiczenia
  podnoszą późniejsze przypominanie.

**Konsekwencja dla aplikacji:**

- Zadania są **przeplatane** — kolejne pytania celowo pochodzą z różnych
  umiejętności, nigdy trzy te same z rzędu.
- Każda umiejętność ma **pudełko Leitnera** i termin następnej powtórki.
  Umiejętności zaległe mają priorytet w losowaniu.
- Poziom trudności jest dobierany adaptacyjnie tak, by skuteczność utrzymywała
  się w okolicy **75–85%**. Zbyt wysoka skuteczność podnosi poziom, zbyt niska
  obniża. To operacyjna definicja strefy najbliższego rozwoju.

---

## 7. Diagnoza wstępna wzorowana na PSVT:R

Purdue Spatial Visualization Test: Rotations to standardowe narzędzie pomiaru
w tej dziedzinie: **30 zadań wielokrotnego wyboru na rotacje 3D, 20 minut**,
dla osób od 13. roku życia. Zadanie ma stałą formę: pokazana jest para
obiektów ilustrująca obrót, a następnie inny obiekt, do którego trzeba
zastosować ten sam obrót.

**Konsekwencja dla aplikacji:** krótki **test wstępny** (8 zadań rotacyjnych w
tej samej konwencji) ustawia poziom startowy, zamiast zaczynać każdego od zera.
Wynik jest zapisywany, więc po przerobieniu materiału można porównać go z
wynikiem testu końcowego — to ta sama logika pre/post, którą stosują badania.

---

## 8. Norma: metoda pierwszego kąta

Aplikacja jest polska, więc domyślnym układem rzutów jest **metoda europejska
(pierwszego kąta)**, zgodna z PN-EN ISO 5456-2. W tej metodzie przedmiot
znajduje się **przed rzutnią**, w amerykańskiej (trzeciego kąta) — za rzutnią.

Wynikające z tego rozmieszczenie rzutów:

| Rzut | Metoda pierwszego kąta (E) | Metoda trzeciego kąta (A) |
| --- | --- | --- |
| z góry | **pod** rzutem głównym | nad rzutem głównym |
| z lewej strony | **po prawej** stronie | po lewej stronie |
| z prawej strony | **po lewej** stronie | po prawej stronie |

Ponieważ ten sam rysunek odczytany w złej konwencji daje inną bryłę, norma
wymaga umieszczania **symbolu graficznego metody** (ścięty stożek) na rysunku.

**Konsekwencja dla aplikacji:** układ rzutów jest przełączalny między metodą E
i A, osobna lekcja w dziale Teoria pokazuje, jak ta sama bryła daje różne
rysunki w obu konwencjach, a osobny typ zadania sprawdza samo rozmieszczenie
rzutów.

Aplikacja **nie rysuje** symbolu graficznego metody, choć norma go wymaga,
a lekcja o nim mówi. Powód jest celowy: nie udało się dotrzeć do wiarygodnego
opisu jego orientacji (dostęp do treści normy i do materiałów opisujących ją
był zablokowany, a dostępne streszczenia były ze sobą sprzeczne co do strony,
po której stoją okręgi). Narysowanie znaku normatywnego w złą stronę w
materiale dydaktycznym jest gorsze niż jego brak, więc do czasu weryfikacji
symbol pozostaje tylko opisany słownie.

---

## 9. Kurs liniowy obok treningu przeplatanego

To jest jedyne miejsce, w którym dwie dobrze udokumentowane zasady stoją
naprzeciw siebie, więc wymaga wyjaśnienia.

**Przeplatanie wygrywa z blokowaniem.** Mieszanie typów zadań daje gorsze
wyniki w trakcie nauki, ale lepszy transfer i trwalszą pamięć niż ćwiczenie
jednego typu w bloku.

**A jednak kurs prowadzi po kolei.** Materiał ułożony tematycznie, moduł po
module, to z definicji praktyka blokowa.

Sprzeczność jest pozorna, bo obie zasady odpowiadają na inne pytanie.
Przeplatanie dotyczy **utrwalania** czegoś, co się już rozumie. Kolejność
tematyczna dotyczy **budowania** rozumienia od zera. Nie da się przeplatać
przekrojów z obrotami, zanim uczeń wie, czym jest plan kodowany.

Stąd podział ról w aplikacji:

| Tryb | Rola | Kolejność zadań |
| --- | --- | --- |
| **Kurs** | zbudować rozumienie po kolei | blokowa, temat po temacie |
| **Trening** | utrwalić i utrzymać | przeplatana, sterowana powtórkami |

Kurs ma dziesięć modułów odwzorowujących strukturę materiału Sorby
(rysunki izometryczne, rzuty, obroty, odbicia, przekroje). Każdy zamyka
sprawdzanie na progu 5 z 6, które otwiera kolejny moduł. Egzamin końcowy
miesza wszystkie umiejętności — i to jest już zadanie przeplatane, bo na
tym etapie sprawdzamy transfer, a nie naukę.

Odpowiedzi udzielone w kursie zasilają ten sam model ucznia co trening,
więc po ukończeniu kursu harmonogram powtórek jest już gotowy i tryb
Trening wie, co komu przypominać.

Uczciwa uwaga o czasie: kurs to około dwóch godzin, a badania mówią
o 15–20 godzinach treningu. Kurs jest rusztowaniem, nie całą nauką.
Objętość ma dostarczyć tryb Trening używany regularnie.

---

## 10. Czego aplikacja świadomie nie robi

- **Nie zastępuje klocków.** Badania wskazują konstruowanie fizyczne jako
  pierwszy etap. Tryb Buduj jest jego namiastką, nie zamiennikiem.
- **Nie ocenia szkicu odręcznego.** Wiarygodna ocena odręcznego rysunku
  wymagałaby rozpoznawania obrazu. Zamiast udawać, że to robi, aplikacja
  stawia na konstruowanie, gdzie sprawdzenie jest ścisłe.
- **Nie uczy CAD.** Zakres to wyobraźnia przestrzenna i czytanie rysunku,
  czyli fundament, który powinien poprzedzać CAD.

---

## Źródła

Wszystkie pozycje poniżej pochodzą z wyników wyszukiwania. **Żadnej nie
otwarto.** Oznaczenia mówią, jak mocno opiera się na nich treść dokumentu:

- **(S)** — twierdzenie zaczerpnięte ze streszczenia wyszukiwarki, nieweryfikowane
  w tekście źródłowym;
- **(B)** — pozycja podana jako wskazówka bibliograficzna, nic z niej nie jest
  cytowane wprost.

Ustalenia dotyczące **układu rzutów w metodzie pierwszego i trzeciego kąta**
są jedynymi, które zostały potwierdzone niezależnie, przez porównanie dwóch
oddzielnych wyszukiwań zgodnych co do rozmieszczenia rzutów.

- [Sheryl Sorby Supports Women's Learning with Spatial Visualization Course at OSU](https://eed.osu.edu/news/2016/02/sheryl-sorby-supports-women%E2%80%99s-learning-spatial-visualization-course-osu) (S)
- [Spatial skills are building blocks to STEM success, Ohio State College of Engineering](https://engineering.osu.edu/news/2016/02/spatial-skills-are-building-blocks-stem-success) (S)
- [Sorby, Development and Assessment of a Course for Enhancing 3-D Spatial Visualization Skills](https://www.vanderbilt.edu/GISEd/wp-content/uploads/Sorby_DevelopmentAssessmentCourse-Enhancing3DSpatialVisualizationSkillsEngineering.pdf) (B)
- [Sorby, Developing 3-D Spatial Visualization Skills, Engineering Design Graphics Journal](https://www.edgj.org/index.php/EDGJ/article/view/126) (B)
- [Spatial Visualization Skills: why it works, engageengineering.org](https://www.engageengineering.org/spatial/whyitworks/learnmore) (S)
- [Developing Spatial Thinking (opis modułów kursu)](https://www.higheredservices.org/classroom-course/) (S)
- [A Focus on Teaching and Learning of Isometric Drawing (ERIC EJ1440807)](https://files.eric.ed.gov/fulltext/EJ1440807.pdf) (S)
- [How orthographic projection engineering drawing supports VHS students, SAGE 2025](https://journals.sagepub.com/doi/10.1177/03064190251377899) (S)
- [Investigating the Impact of an Online Freehand Sketching and Spatial Visualization Intervention, ASEE](https://peer.asee.org/investigating-the-impact-of-an-online-freehand-sketching-and-spatial-visualization-intervention-on-first-year-engineering-students-skills-and-cognitive-development.pdf) (S)
- [Revised PSVT:R, Spatial Intelligence and Learning Center](https://www.spatiallearning.org/tools/revised-purdue-spatial-visualization-test-revised-psvtr-visualization-of-rotations) (S)
- [Purdue Spatial Visualization Test: Visualization of Rotations](https://en.wikipedia.org/wiki/Purdue_Spatial_Visualization_Test:_Visualization_of_Rotations) (S)
- [The Effectiveness of Spaced Learning, Interleaving, and Retrieval Practice, ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1546144023006464) (S)
- [Desirable Difficulties: Bjork's principles](https://www.structural-learning.com/post/desirable-difficulties) (S)
- [Spaced and interleaved practice, MIT Open Learning](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/spaced-and-interleaved-practice) (S)
- [First vs Third Angle Orthographic Views, GD&T Basics](https://www.gdandtbasics.com/first-vs-third-angle-orthographic-views/) (S, potwierdzone drugim wyszukiwaniem)
- [PN-EN ISO 5456-2:2002, Polski Komitet Normalizacyjny](https://sklep.pkn.pl/pn-en-iso-5456-2-2002p.html) (B, treść normy niedostępna)
- [Rzutowanie prostokątne, materiały UPSL](https://cms.upsl.edu.pl/content/download/7811/file/Rzutowanie%20Prostok%C4%85tne.pdf) (B)
