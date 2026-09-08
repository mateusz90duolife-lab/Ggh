# Metodyka: na czym oparto trener izometryki

Dokument opisuje, jakie metody nauczania izometryki i wyobraźni przestrzennej
zostały przyjęte za podstawę aplikacji `trener.html`, oraz jak każda z nich
przekłada się na konkretną funkcję programu.

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
- Studenci, którzy poprawili wynik, mają **wyższy wskaźnik pozostania na
  kierunku** niż studenci ze słabymi zdolnościami, którzy ich nie poprawili.
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
w tym kierunku prowadzą ćwiczenia. Tymczasem większe obciążenie poznawcze — i
większy przyrost umiejętności — daje kierunek odwrotny: odczytanie rzutów
prostokątnych wymaga wyższej aktywności mózgu niż odczytanie widoku
izometrycznego.

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
i A, symbol metody jest rysowany przy zadaniu, a osobna lekcja w dziale Teoria
pokazuje, jak ta sama bryła daje różne rysunki w obu konwencjach. Jest też typ
zadania sprawdzający samo rozmieszczenie rzutów.

---

## 9. Czego aplikacja świadomie nie robi

- **Nie zastępuje klocków.** Badania wskazują konstruowanie fizyczne jako
  pierwszy etap. Tryb Buduj jest jego namiastką, nie zamiennikiem.
- **Nie ocenia szkicu odręcznego.** Wiarygodna ocena odręcznego rysunku
  wymagałaby rozpoznawania obrazu. Zamiast udawać, że to robi, aplikacja
  stawia na konstruowanie, gdzie sprawdzenie jest ścisłe.
- **Nie uczy CAD.** Zakres to wyobraźnia przestrzenna i czytanie rysunku,
  czyli fundament, który powinien poprzedzać CAD.

---

## Źródła

- [Sheryl Sorby Supports Women's Learning with Spatial Visualization Course at OSU](https://eed.osu.edu/news/2016/02/sheryl-sorby-supports-women%E2%80%99s-learning-spatial-visualization-course-osu)
- [Spatial skills are building blocks to STEM success, Ohio State College of Engineering](https://engineering.osu.edu/news/2016/02/spatial-skills-are-building-blocks-stem-success)
- [Sorby, Development and Assessment of a Course for Enhancing 3-D Spatial Visualization Skills](https://www.vanderbilt.edu/GISEd/wp-content/uploads/Sorby_DevelopmentAssessmentCourse-Enhancing3DSpatialVisualizationSkillsEngineering.pdf)
- [Sorby, Developing 3-D Spatial Visualization Skills, Engineering Design Graphics Journal](https://www.edgj.org/index.php/EDGJ/article/view/126)
- [Spatial Visualization Skills: why it works, engageengineering.org](https://www.engageengineering.org/spatial/whyitworks/learnmore)
- [Developing Spatial Thinking (opis modułów kursu)](https://www.higheredservices.org/classroom-course/)
- [A Focus on Teaching and Learning of Isometric Drawing (ERIC EJ1440807)](https://files.eric.ed.gov/fulltext/EJ1440807.pdf)
- [How orthographic projection engineering drawing supports VHS students, SAGE 2025](https://journals.sagepub.com/doi/10.1177/03064190251377899)
- [Investigating the Impact of an Online Freehand Sketching and Spatial Visualization Intervention, ASEE](https://peer.asee.org/investigating-the-impact-of-an-online-freehand-sketching-and-spatial-visualization-intervention-on-first-year-engineering-students-skills-and-cognitive-development.pdf)
- [Revised PSVT:R, Spatial Intelligence and Learning Center](https://www.spatiallearning.org/tools/revised-purdue-spatial-visualization-test-revised-psvtr-visualization-of-rotations)
- [Purdue Spatial Visualization Test: Visualization of Rotations](https://en.wikipedia.org/wiki/Purdue_Spatial_Visualization_Test:_Visualization_of_Rotations)
- [The Effectiveness of Spaced Learning, Interleaving, and Retrieval Practice, ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1546144023006464)
- [Desirable Difficulties: Bjork's principles](https://www.structural-learning.com/post/desirable-difficulties)
- [Spaced and interleaved practice, MIT Open Learning](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/spaced-and-interleaved-practice)
- [First vs Third Angle Orthographic Views, GD&T Basics](https://www.gdandtbasics.com/first-vs-third-angle-orthographic-views/)
- [PN-EN ISO 5456-2:2002, Polski Komitet Normalizacyjny](https://sklep.pkn.pl/pn-en-iso-5456-2-2002p.html)
- [Rzutowanie prostokątne, materiały UPSL](https://cms.upsl.edu.pl/content/download/7811/file/Rzutowanie%20Prostok%C4%85tne.pdf)
