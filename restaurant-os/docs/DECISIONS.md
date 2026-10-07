# Rejestr decyzji

Każda decyzja odbiega od `MASTER_PROMPT.md` albo uzupełnia go tam, gdzie specyfikacja milczała.

## D1. Stos: TypeScript bez zewnętrznych bibliotek (zamiast React + Vite + Tailwind + shadcn + supabase-js)

**Powód:** środowisko, w którym budowano aplikację, blokowało rejestry pakietów (npm, CDN). Nie dało się zainstalować ani zweryfikować React, Vite czy klienta Supabase. Zamiast dostarczać niesprawdzony kod, zbudowano aplikację w czystym TypeScripcie (kompilator `tsc`), z własnym małym routerem, pomocnikiem DOM i klientem REST/Auth.
**Skutki:** zero zależności uruchomieniowych, mały rozmiar, pełna kontrola nad bezpieczeństwem (brak `innerHTML`). Koszt: więcej kodu własnego, brak biblioteki komponentów. Warstwa danych (`src/api`) nie zależy od interfejsu, więc można ją przenieść do Reacta, jeśli zajdzie potrzeba.

## D2. „Realtime” jako odpytywanie

Zadania odświeżają się co 8 s, braki co 10 s, dashboard co 15 s (tylko gdy karta jest widoczna). Połączenia WebSocket Supabase Realtime nie wdrożono, bo nie dało się go sprawdzić. Dla restauracji opóźnienie kilku sekund jest akceptowalne. Publikacja Realtime w migracji jest przygotowana (`supabase_realtime`), więc można to dodać później.

## D3. Kolejka offline w localStorage (zamiast IndexedDB)

Kolejka zawiera tylko dwa typy akcji (zgłoszenie braku, odhaczenie zadania), więc to kilka krótkich rekordów. Wysyłka jest po kolei i idempotentna (`client_id`). Pamięć podręczna odczytów ma limit 400 kB na zapytanie.

## D4. Uprawnienia uzupełniające

- Zużycie, odpad, korekty i inwentaryzację wykonuje manager lub właściciel; pracownik tylko zgłasza braki.
- Własnej roli i statusu konta nie można zmienić w aplikacji (ochrona przed zablokowaniem sobie dostępu).
- „Nie ma na liście?” tworzy zadanie „Dodać produkt: …” dla managera przez funkcję `request_new_product` (pracownik nie tworzy produktów ani zadań bezpośrednio).
- Jednostki produktu nie można zmienić po utworzeniu (zmieniłaby sens historii ruchów).

## D5. Mail z listą zakupów

Mail wychodzący z crona jest podpisany datą następnego dnia („na jutro”), a wysyłka ręczna jako „aktualna lista”. Wpis w `email_log` jest „przejmowany” (stany `sending/sent/failed/skipped`), co daje najwyżej jeden mail dziennie, ponowienie po błędzie oraz przejęcie wpisu zawieszonego dłużej niż 10 minut. Pusta lista lub brak odbiorców to status `skipped` (bez maila).

## D6. Zadania z szablonów

Tworzy je `pg_cron` bezpośrednio w SQL (co godzinę, idempotentnie, z uwzględnieniem strefy czasu lokalu), a dodatkowo aplikacja woła `ensure_today_tasks()` przy otwarciu ekranów zadań. Osobna funkcja Edge nie jest potrzebna.

## D7. Dashboard

Kwota „Zakupy dzisiaj” jest widoczna tylko dla właściciela (funkcja `dashboard_summary` zwraca `null` managerowi). „Wzrost cen” liczy produkty, których ostatnia cena wzrosła o co najmniej 10% względem poprzedniej (próg stały; ustawienie progu to element FAZY 4).

## D8. Audyt zakupów

Trigger audytu uzupełnia `restaurant_id` dla `purchase_items` z tabeli `purchases` (migracja 004), bo ta tabela nie ma własnej kolumny.

## D9. Ukrycie profilu nieaktywnego konta

Dla konta zdezaktywowanego RLS ukrywa także jego własny profil, więc aplikacja nie odróżni „nieaktywne” od „brak profilu” i pokazuje wspólny komunikat. Dodatkowo dezaktywacja blokuje logowanie w Auth (`ban_duration`), więc nowe logowanie kończy się komunikatem „konto jest zablokowane”.

## D10. Lokalny backend testowy

Testy E2E działają przeciw `e2e/local-backend.mjs`: serwerowi zgodnemu z API Supabase (GoTrue + PostgREST + funkcje Edge) na prawdziwym PostgreSQL z prawdziwym RLS i funkcjami SQL. Tłumaczy tylko podzbiór składni PostgREST używany przez aplikację, więc **nie zastępuje** testu na prawdziwym projekcie Supabase (patrz `CHECKLIST.md`).

## D11. CSP

`index.html` zawiera tag CSP dopuszczający także adresy lokalne (`127.0.0.1`, `localhost`) na potrzeby testów. Na produkcji `vercel.json` dodaje ostrzejszy nagłówek CSP (tylko `self` i Supabase); przeglądarka stosuje oba, więc obowiązuje część wspólna.

## D12. Poza zakresem tego wydania

Wykresy i alerty cen (FAZA 4), receptury i food cost (FAZA 5), raporty i prognozy (FAZA 6). Schemat bazy dla receptur i OCR jest opisany w `MASTER_PROMPT.md`, ale nie ma go w migracjach. Odczyt paragonów (część FAZY 3) jest od migracji 006 — patrz D18.

## D13. Funkcje API dostępne dla zalogowanych

Doradca bezpieczeństwa Supabase ostrzega, że zalogowani mogą wywoływać funkcje `SECURITY DEFINER`. To zamierzone: to jest API aplikacji (zgłoszenie braku, zakup, inwentaryzacja…), a każda funkcja sama sprawdza rolę i restaurację. Rola `anon` nie wykona żadnej funkcji (migracja 005, test w `supabase/tests/20_app_functions.sql`). Funkcje wyzwalaczy są poza API.

## D14. Klucz publishable i brama JWT funkcji

Frontend używa nowego klucza `sb_publishable_…` (jawny z założenia). Funkcje Edge mają wyłączoną bramę JWT (`verify_jwt = false`), bo nie współpracuje ona z nowymi kluczami podpisu; obie funkcje same sprawdzają token w Auth i rolę w bazie (wywołanie bez tokenu zwraca 401 — sprawdzone na produkcji).

## D15. Hosting na GitHub Pages z folderu `/docs`

Repozytorium jest publiczne, więc GitHub Pages jest darmowy. Zbudowana aplikacja leży w `/docs` (skrypt `scripts/publish-pages.mjs`), co działa z dowolnej gałęzi bez dodatkowego CI. Alternatywa (Vercel) jest opisana w `SETUP.md`.

## D16. Widok stanów jako `security_invoker`

Po uwadze doradcy bezpieczeństwa widok `product_stock` działa z uprawnieniami użytkownika, a sumy ruchów liczy funkcja `stock_levels()` ograniczona do restauracji zalogowanego. Pracownik nadal widzi stany, ale nie historię ruchów (migracja 005).

## D17. Katalog produktów z ilustracjami (emoji)

Ilustracje produktów to emoji: działają offline, nie wymagają pobierania obrazków ani magazynu plików, są kolorowe i czytelne na każdym telefonie. Katalog startowy (`src/lib/catalog.ts`, ok. 110 pozycji: mięsa, warzywa, zupy, przyprawy, sosy) dodaje produkty z ikoną w kolumnie `products.icon`; produktom bez ikony aplikacja dobiera ją po słowach w nazwie, a w ostateczności po kategorii. Produkt bez minimalnego stanu i bez zapasu ma status **„Bez stanu”** (`none`), a nie „BRAK” — inaczej każdy produkt dodany z katalogu od razu liczyłby się na pulpicie jako brak.

## D18. Skaner paragonów (Claude, odczyt obrazu)

- Zdjęcie jest zmniejszane w przeglądarce (JPEG, dłuższy bok ≤ 2000 px) i wysyłane do funkcji Edge `scan-receipt` (tylko manager i właściciel). Funkcja wywołuje model **Claude Opus 5.5** (`claude-opus-5-5`) przez oficjalne SDK `@anthropic-ai/sdk` (w Deno przez `npm:`), z odpowiedzią wymuszoną schematem JSON (`output_config.format`), więc wynik zawsze ma postać tabeli: nazwa, ilość, jednostka, cena jednostkowa, wartość, VAT, wielkość opakowania.
- Włączone są **zapasowe modele po stronie serwera** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): gdy model odmówi odczytu, API samo ponawia zapytanie na modelu zalecanym przez Anthropic. Gdyby konto nie miało dostępu do tej funkcji beta (błąd 400), funkcja ponawia zapytanie raz bez niej.
- Odpowiedź modelu jest zawsze sprawdzana (liczby, zakresy, daty, jednostki), a nazwa „dopasowania” jest przyjmowana tylko wtedy, gdy dokładnie odpowiada produktowi lokalu. Zdjęcia **nie są zapisywane** — w bazie zostaje tylko odczytana tabela (`receipt_scans`).
- Dopasowanie pozycji do produktów: zapamiętane wcześniej dopasowanie (`product_aliases`) → podpowiedź modelu → podobna nazwa. Po zapisie zakupu aplikacja zapamiętuje dopasowania, więc kolejne paragony z tego sklepu dopasowują się same.
- Ceny na paragonie są brutto; do zakupu trafia cena netto = brutto / (1 + VAT). Ilość jest przeliczana na jednostkę produktu (np. 6 × „Mleko 1 L” = 6 L, 3 × 500 g = 1,5 kg).
- Limit 60 skanów na lokal na dobę chroni przed nadużyciem i niespodziewanym kosztem. Bez klucza `ANTHROPIC_API_KEY` skaner pokazuje czytelny komunikat zamiast błędu.
- Testy nie łączą się z API: funkcja przyjmuje wstrzyknięty obiekt klienta, a testy jednostkowe i E2E podstawiają stałą odpowiedź modelu.

## D19. Konta pracowników na nick i 4-cyfrowy PIN

- Pracownik loguje się **nickiem i PIN-em** (zakładka „Pracownik: nick i PIN” na ekranie logowania). Właściciel zakłada takie konto w **Pracownicy → Dodaj pracownika** i może w każdej chwili ustawić nowy PIN. Właściciel i osoby z adresem e-mail logują się jak dotąd.
- Pod spodem to zwykłe konto Supabase Auth (z technicznym adresem `…@staff.restaurant-os.invalid`, na który nic nie jest wysyłane). Hasłem konta **nie jest PIN**, tylko HMAC(sekret serwera, id + PIN). Dzięki temu PIN-u nie da się zgadywać bezpośrednio przez API logowania — tylko przez funkcję `pin-login`, która po **5 błędnych próbach blokuje konto na 15 minut** i odpowiada tak samo na zły nick i zły PIN.
- Sekret to `PIN_SECRET` (sekret funkcji Edge), a gdy go nie ustawiono — klucz service role. Zmiana tego sekretu unieważnia wszystkie PIN-y (właściciel ustawia je od nowa).
- Konta PIN nie mają „Zmień hasło” (zmiana hasła rozłączyłaby PIN); nowy PIN ustawia szef.
- Ograniczenie: Supabase ogranicza liczbę logowań z jednego adresu IP (domyślnie ok. 30 na 5 minut), a logowania PIN-em idą z serwera funkcji — dla jednego lokalu to z zapasem wystarcza.

## D20. Ekran „Produkty”, godziny pracy i podgląd zespołu

- **Produkty** (dla wszystkich): zaznaczanie wielu kafelków naraz, ilość dla każdego i trzy akcje — _Na listę potrzebnych_ (zgłoszenia braków, działa też offline), _Dodaj do stanu_ (przyjęcie, ruch `adjustment`) i _Odejmij ze stanu_ (wydanie, ruch `consumption`). Zmiany stanu idą przez funkcję `staff_stock_change`, zapisują się pod nazwiskiem pracownika i nie pozwalają zejść poniżej zera. Pracownik widzi swoje ruchy (nowa polityka RLS), manager — wszystkie.
- **Godziny** (tabela `work_shifts`): „Zaczynam pracę” / „Kończę pracę” albo ręczny wpis (dzień, od, do). Pracownik wpisuje tylko swoje godziny z ostatnich 14 dni, wpisy nie mogą się nakładać ani być z przyszłości, zmiana trwa najwyżej 16 h (ręcznie) / 24 h (zegar). Poprawki i starsze wpisy robi manager.
- **Zespół** (manager i właściciel): kto jest w pracy, godziny w tym tygodniu i miesiącu, zamówienia (zgłoszone braki), zmiany stanu i zadania każdej osoby; z karty osoby szef przydziela zadanie i dopisuje godziny. Zadania przydzielone konkretnej osobie widzi tylko ona (i szefowie); zadania „dla wszystkich” — cały zespół.
- Kafelki w **Katalogu**, które są już w magazynie, prowadzą teraz do ekranu Produkty (wcześniej były wyszarzone i nie dało się ich zaznaczyć).
