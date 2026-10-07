# Metodyka: na czym oparto trener izometryki

Dokument opisuje, jakie metody nauczania izometryki i wyobraźni przestrzennej
zostały przyjęte za podstawę aplikacji `trener.html`, oraz jak każda z nich
przekłada się na konkretną funkcję programu.

> **Status źródeł.** Pierwsza wersja tego dokumentu opierała się wyłącznie
> na streszczeniach wyszukiwarki, bo środowisko robocze blokowało dostęp do
> stron źródłowych. W obecnej wersji **11 z 20 pozycji zostało przeczytanych**
> za pośrednictwem konektora Firecrawl — w całości albo w postaci dosłownych
> fragmentów wybranych pod kątem konkretnych pytań. Weryfikacja obaliła dwa
> twierdzenia z pierwszej wersji i doprecyzowała kilka innych; zmiany są
> opisane w tekście. Każda pozycja na liście źródeł ma oznaczenie, czy ją
> przeczytano. Liczby podane niżej pochodzą wyłącznie z pozycji oznaczonych
> jako przeczytane.

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

**Konsekwencja dla aplikacji:** tryb **Buduj** — edytor planu kodowanego
z podglądem izometrycznym na żywo. Uczeń dostaje trzy rzuty i stawia bryłę
słupek po słupku. Sprawdzenie porównuje zbiory kostek, więc liczy się
dokładna zgodność. W kursie jest to zadanie konstrukcyjne modułu 5.

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

---

## 6. Przeplatanie, powtórki rozłożone i pożądane trudności

MIT Open Learning streszcza to tak: nauka rozłożona w czasie daje lepsze
wyniki niż sesje skupione, a przeplatanie typów zadań daje *higher learning
gains* niż ćwiczenie ich blokami. Oba zabiegi *can mean slower initial
learning*, ale poprawiają zapamiętanie i umiejętność rozróżniania typów
zadań. Źródło powołuje się na Taylor i Rohrera.

**Konsekwencja dla aplikacji:**

- Zadania w treningu są **przeplatane** — ta sama umiejętność nie wystąpi
  trzy razy z rzędu.
- Każda umiejętność ma **pudełko Leitnera** i termin następnej powtórki.
  Umiejętności zaległe mają priorytet w losowaniu.
- Poziom trudności dobiera się tak, by skuteczność trzymała się w okolicy
  **75–85%**. To decyzja projektowa inspirowana zasadą pożądanych trudności
  (Bjork); źródła tej zasady nie przeczytano.

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

Kurs ma dziesięć modułów. Każdy zamyka sprawdzian na progu 5 z 6, który
otwiera kolejny moduł. Egzamin końcowy miesza wszystkie umiejętności, bo na
tym etapie sprawdzamy transfer. Odpowiedzi z kursu zasilają ten sam model
ucznia co trening, więc po kursie harmonogram powtórek jest gotowy.

**Uwaga o czasie:** kurs to około dwóch godzin, a sprawdzone programy
trwają około 15 godzin (wersja obecna) albo około 40 (pierwotny GN102).
Kurs jest rusztowaniem, nie całą nauką. Objętość ma dostarczyć regularny
trening.

---

## 10. Czego aplikacja świadomie nie robi

- **Nie zastępuje klocków.** W kursie Sorby studenci trzymają fizyczną
  bryłę w rękach, kiedy ją szkicują. Tryb Buduj jest namiastką tego etapu,
  nie zamiennikiem.
- **Nie ocenia szkicu odręcznego.** Wiarygodna ocena odręcznego rysunku
  wymagałaby rozpoznawania obrazu. Aplikacja stawia na konstruowanie, gdzie
  sprawdzenie jest ścisłe.
- **Nie uczy CAD.** Zakres to wyobraźnia przestrzenna i czytanie rysunku.
- **Nie mierzy psychometrycznie.** Test wstępny i końcowy pokazują kierunek
  zmiany, nie wynik porównywalny z normami PSVT:R.

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
