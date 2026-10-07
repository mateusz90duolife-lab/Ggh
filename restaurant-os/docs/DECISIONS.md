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

OCR dokumentów (FAZA 3), wykresy i alerty cen (FAZA 4), receptury i food cost (FAZA 5), raporty i prognozy (FAZA 6). Schemat bazy dla receptur i OCR jest opisany w `MASTER_PROMPT.md`, ale nie ma go w migracjach.

## D13. Funkcje API dostępne dla zalogowanych

Doradca bezpieczeństwa Supabase ostrzega, że zalogowani mogą wywoływać funkcje `SECURITY DEFINER`. To zamierzone: to jest API aplikacji (zgłoszenie braku, zakup, inwentaryzacja…), a każda funkcja sama sprawdza rolę i restaurację. Rola `anon` nie wykona żadnej funkcji (migracja 005, test w `supabase/tests/20_app_functions.sql`). Funkcje wyzwalaczy są poza API.

## D14. Klucz publishable i brama JWT funkcji

Frontend używa nowego klucza `sb_publishable_…` (jawny z założenia). Funkcje Edge mają wyłączoną bramę JWT (`verify_jwt = false`), bo nie współpracuje ona z nowymi kluczami podpisu; obie funkcje same sprawdzają token w Auth i rolę w bazie (wywołanie bez tokenu zwraca 401 — sprawdzone na produkcji).

## D15. Hosting na GitHub Pages z folderu `/docs`

Repozytorium jest publiczne, więc GitHub Pages jest darmowy. Zbudowana aplikacja leży w `/docs` (skrypt `scripts/publish-pages.mjs`), co działa z dowolnej gałęzi bez dodatkowego CI. Alternatywa (Vercel) jest opisana w `SETUP.md`.

## D16. Widok stanów jako `security_invoker`

Po uwadze doradcy bezpieczeństwa widok `product_stock` działa z uprawnieniami użytkownika, a sumy ruchów liczy funkcja `stock_levels()` ograniczona do restauracji zalogowanego. Pracownik nadal widzi stany, ale nie historię ruchów (migracja 005).
