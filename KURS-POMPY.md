# Kurs instalatora pomp ciepła i klimatyzacji

Opis zakresu, metodyki i źródeł aplikacji `pompy.html`. Kurs jest na
poziomie zaawansowanym: zakłada, że uczestnik zna podstawy instalacji
sanitarnych lub elektrycznych i chce przygotować się do samodzielnego
projektowania, montażu, uruchamiania i serwisu pomp ciepła i klimatyzacji.

Otwórz plik w przeglądarce. Nie wymaga serwera, logowania ani internetu.
Postęp zapisuje się w pamięci przeglądarki.

---

## 1. Zakres

| Część | Moduł | Zadania obliczeniowe |
| --- | --- | --- |
| I. Fizyka i czynniki | 1. Obieg sprężarkowy i termodynamika | COP Carnota |
| | 2. Czynniki chłodnicze i bezpieczeństwo | t CO₂e, limit napełnienia czynnikiem palnym |
| | 3. Przepisy: F-gazy, UDT, CRO | częstotliwość kontroli szczelności, t CO₂e |
| II. Projekt i dobór | 4. Obciążenie cieplne i dobór pompy ciepła | punkt biwalentny, koszt eksploatacji |
| | 5. Hydraulika instalacji z pompą ciepła | przepływ, prędkość w rurze |
| | 6. Dolne źródło: powietrze i grunt | hałas jednostki zewnętrznej, długość sond |
| | 7. Klimatyzacja: bilans, dobór, skropliny | zyski ciepła, punkt rosy |
| III. Montaż i uruchomienie | 8. Instalacja chłodnicza: rury, kielichy, lutowanie | doładowanie czynnika |
| | 9. Próba szczelności, próżnia, osuszanie | korekta temperatury próby azotem, mikrony |
| | 10. Uruchomienie i pomiary | przegrzanie, dochłodzenie |
| IV. Automatyka i serwis | 11. Elektryka, sterowanie i automatyka | prąd zasilania, krzywa grzewcza |
| | 12. Diagnostyka, serwis i odzysk czynnika | — (diagnoza z tabeli objawów) |

W liczbach: 39 lekcji ze schematami, 135 pytań stałych, 17 generatorów
zadań obliczeniowych i 12 kalkulatorów. Łączny czas nauki to około
10–12 godzin.

## 2. Jak działa kurs

- **Moduł** to teoria, ćwiczenia (6 zadań, bez oceny) i sprawdzian
  (8 zadań, próg 6). Zaliczenie sprawdzianu otwiera kolejny moduł.
- **Egzamin końcowy** ma 24 zadania, po dwa z każdego modułu, próg 19
  (ok. 80%). Po zdaniu aplikacja wystawia zaświadczenie ukończenia kursu
  do wydruku.
- **Trening** miesza zadania z otwartych modułów i częściej sięga do tych,
  w których uczestnik ma niższą skuteczność. Uzasadnienie podziału na kurs
  liniowy i trening przeplatany opisuje sekcja 9 w [METODYKA.md](METODYKA.md).
  Te same zasady stosuje trener izometryki.
- **Kalkulatory** i **Ściąga** to narzędzia robocze z tymi samymi wzorami
  co zadania.

**Błędne odpowiedzi nie są losowe.** Każdy dystraktor w zadaniu
obliczeniowym to wynik typowej pomyłki: ciśnienie z manometru użyte jak
bezwzględne, temperatura w °C zamiast w K, pełna moc grzewcza zamiast mocy
parownika przy doborze sond, brak √3 w układzie trójfazowym. Informacja
zwrotna nazywa popełniony błąd.

## 3. Dane techniczne i ich pochodzenie

| Dane | Źródło i uwagi |
| --- | --- |
| Ciśnienia nasycenia R32, R410A, R290 | Tabele producentów czynników, wygładzone równaniem Antoine'a dopasowanym do punktów odniesienia (błąd dopasowania ok. 0,2%). Wartości przybliżone, do nauki. |
| GWP | IV raport IPCC (AR4), stosowany do przeliczeń w przepisach F-gazowych UE. Do dokumentacji obowiązuje tabliczka znamionowa. |
| Klasy bezpieczeństwa i LFL | ISO 817, PN-EN 378-1 |
| Limit napełnienia czynnikiem palnym | PN-EN 378-1 zał. C, PN-EN IEC 60335-2-40: m = 2,5 · LFL^1,25 · h₀ · √A |
| Kontrole szczelności, zakazy | Rozporządzenie (UE) 2024/573, art. 5 i zał. IV |
| Kategorie certyfikatów | Rozporządzenie wykonawcze (UE) 2015/2067; mogą je zaktualizować nowe akty wykonawcze |
| CRO, UDT | Ustawa z 15 maja 2015 r. o substancjach zubożających warstwę ozonową oraz o niektórych fluorowanych gazach cieplarnianych |
| Strefy klimatyczne | PN-EN 12831, załącznik krajowy |
| Moc jednostkowa gruntu | VDI 4640 (wartości orientacyjne dla ok. 1800 h pracy) |
| Hałas | model propagacji z kierunkowością Q; limity dla zabudowy jednorodzinnej 50/40 dB(A) |
| Momenty dokręcania kielichów | wartości typowe z instrukcji producentów splitów |

Wszystkie wzory są w jednym miejscu kodu i obsługują jednocześnie lekcje,
zadania i kalkulatory, więc liczba w lekcji, w kluczu zadania i w
kalkulatorze nie może się rozjechać.

## 4. Testy

```bash
./testy/uruchom.sh          # logika obu aplikacji
./testy/uruchom.sh --all    # dodatkowo przebieg w przeglądarce (Playwright)
```

Testy kursu sprawdzają między innymi:

- **Tabele ciśnień** przez gładkość zależności ln p od 1/T
  (równanie Clausiusa–Clapeyrona). Literówka rzędu 1% w pojedynczej
  wartości psuje tę gładkość i test ją wykrywa.
- **Wzory** na przykładach z lekcji i przypadkach granicznych, np. dokładnie
  5, 50 i 500 t CO₂e przy kontrolach szczelności.
- **Zgodność klucza z treścią zadania.** Test odczytuje dane z tekstu
  wygenerowanego zadania i liczy odpowiedź od nowa, niezależnie od
  generatora. Wykrywa to rozjazd między tym, co widzi uczestnik, a tym,
  co aplikacja uznaje za poprawne.
- **Bramkowanie**: oblany sprawdzian nie otwiera modułu, słabsza poprawka
  nie odbiera zaliczenia.
- **Przebieg w przeglądarce** od pierwszego modułu po zaświadczenie,
  kalkulatory, obsługę klawiatury i widok 390 px bez poziomego
  przewijania.

## 5. Czego kurs świadomie nie robi

- **Nie jest certyfikatem UDT.** Egzamin na certyfikat F-gazowy dla
  personelu ma część praktyczną zdawaną przed komisją UDT. Zaświadczenie
  z aplikacji mówi to wprost.
- **Nie zastępuje praktyki.** Kielichowania, lutowania z azotem i pracy
  z czynnikami palnymi uczy się rękami, pod nadzorem.
- **Nie zastępuje dokumentacji producenta ani projektu.** Wartości
  orientacyjne (przegrzanie, dochłodzenie, momenty, wskaźniki W/m²) są
  opisane jako takie. Obowiązuje instrukcja konkretnego urządzenia.
- **Nie śledzi zmian przepisów.** Stan prawny odpowiada wrześniowi 2026 r.
  Przed decyzjami projektowymi sprawdź pełne brzmienie rozporządzenia
  2024/573 i komunikaty UDT.

## Źródła

- [Regulation (EU) 2024/573 on fluorinated greenhouse gases, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/573/oj/eng)
- [Article 5 Leak checks, Regulation (EU) 2024/573](https://service.betterregulation.com/document/714935)
- [Regulation (EU) 2024/573: Reviewing the New F-gas Regulation, Compliance & Risks](https://www.complianceandrisks.com/blog/regulation-eu-2024-573-european-commission-adopts-new-f-gas-regulation/)
- [F-Gas Regulation 2024/573: air conditioning and heat pumps](https://industrialgines.com/en/f-gas-regulation-2024-573-air-conditioning/)
- [Stulz: Adapting to EU F-Gas Regulation with Low-GWP Solutions](https://www.stulz.com/newsroom/detail/f-gas-regulation/)
- [Air conditioning: climate-friendly alternatives to F-gases, Komisja Europejska](https://climate.ec.europa.eu/areas-action/fluorinated-greenhouse-gases/climate-friendly-alternatives-f-gases/air-conditioning_en)
- [UDT: Urządzenia chłodnicze, klimatyzacyjne, pompy ciepła — certyfikat dla przedsiębiorców](https://www.udt.gov.pl/uslugi-udt/szwo-i-f-gazy/certyfikat-dla-przedsiebiorcow/uzyskanie-certyfikatu/urzadzenia-chlodnicze-klimatyzacyjne-pompy-ciepla)
- [CRO: Rejestracja pompy ciepła w CRO](http://www.cro.ichp.pl/aktualnosci/rejestracja-pompy-ciepla-w-cro-informacja-dla-wlascicieli-pomp-ciepla-bedacych-osobami-fizycznymi,p536454966)
- [Centralny Rejestr Operatorów a fluorowane gazy cieplarniane, RynekInstalacyjny.pl](https://www.rynekinstalacyjny.pl/artykul/pompy-ciepla/145903,centralny-rejestr-operatorow-a-fluorowane-gazy-cieplarniane)
- [Strefy klimatyczne Polski i temperatury obliczeniowe, hvacr.pl](https://www.hvacr.pl/strefy-klimatyczne-polski-i-temperatury-obliczeniowe-322)
- [Strzeszewski, Wereszczyński: Norma PN-EN 12831. Nowa metoda obliczania projektowego obciążenia cieplnego](https://www.purmo.com/docs/Poradnik-Purmo-nowa-metoda-obliczania_12831_01_2012.pdf)
