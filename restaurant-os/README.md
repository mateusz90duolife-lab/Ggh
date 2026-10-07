# Restaurant OS

Aplikacja PWA po polsku do prowadzenia restauracji: **magazyn, zgłaszanie braków, lista zakupów, zakupy, skaner paragonów, zadania i dashboard**. Działa na telefonie i komputerze, instaluje się jak aplikacja, a pracownik robi większość rzeczy w 2–3 dotknięciach.

> Specyfikacja i plan fazowy: [`MASTER_PROMPT.md`](MASTER_PROMPT.md). To wydanie obejmuje **FAZĘ 1 i 2** oraz odczyt paragonów z FAZY 3 (zdjęcie → tabela → zakup). Analizę cen, receptury i raporty (FAZY 3–6) opisano w specyfikacji, ale jeszcze ich nie zbudowano.

## Co jest w środku

| Rola       | Ekrany                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pracownik  | Dzisiaj, Zadania, Zgłoś brak (kafelki z ilustracjami), Magazyn (odczyt)                                                                               |
| Manager    | Dashboard, Magazyn (ruchy, inwentaryzacja, katalog), Zakupy (lista, kreator, historia, skaner paragonów), Zadania, Dostawcy, Kategorie, Powiadomienia |
| Właściciel | Wszystko powyżej + Pracownicy, Szablony zadań, Ustawienia, Historia zmian                                                                             |

Najważniejsze zasady: stan magazynu to suma niezmiennych ruchów, uprawnienia wymusza baza danych (RLS), tryb offline obsługuje zgłoszenia braków i odhaczanie zadań, a każda ważna zmiana zapisuje się w historii.

## Wersja produkcyjna

Backend działa na Supabase (projekt `restaurant-os`), a aplikacja jest opublikowana na GitHub Pages (gałąź `gh-pages`): **https://mateusz90duolife-lab.github.io/Ggh/**. Stan i kroki: [`docs/WDROZENIE.md`](docs/WDROZENIE.md).

## Szybki start

1. Przeczytaj [`docs/SETUP.md`](docs/SETUP.md) — Supabase, migracje, pierwszy właściciel, e-mail, hosting.
2. Instrukcje dla ludzi: [pracownik](docs/INSTRUKCJA_PRACOWNIK.md), [manager](docs/INSTRUKCJA_MANAGER.md), [właściciel](docs/INSTRUKCJA_WLASCICIEL.md).
3. Lokalnie: `npm install`, ustaw `SUPABASE_URL` i `SUPABASE_ANON_KEY`, `npm run serve`.

## Struktura

```
src/                 aplikacja (TypeScript, bez bibliotek uruchomieniowych)
  api/               klient Auth/REST, pamięć podręczna, kolejka offline
  pages/             ekrany     ui/  komponenty     lib/  formatowanie, walidacja, opisy audytu
public/              index.html, style, manifest, service worker, ikony (wynik kompilacji trafia do public/assets/js)
supabase/migrations  schemat, RLS, funkcje SQL    functions/  admin-users, daily-shopping-summary
supabase/tests       testy SQL (RLS, funkcje)     cron.example.sql  harmonogram
tests/               testy jednostkowe i bezpieczeństwa (Node)
e2e/                 testy w Chromium + lokalny backend testowy na PostgreSQL
docs/                instalacja, instrukcje, decyzje, lista kontrolna
```

## Testy

```bash
npm run lint      # formatowanie + typy
npm test          # 72 testy jednostkowe, funkcji Edge i bezpieczeństwa
npm run db:test   # migracje, RLS i funkcje na PostgreSQL 16
npm run e2e       # 17 scenariuszy w Chromium (w tym pełny dzień restauracji, offline, PWA, 6 rozmiarów ekranu)
```

Uczciwy stan prac i znane ograniczenia: [`docs/CHECKLIST.md`](docs/CHECKLIST.md), decyzje projektowe: [`docs/DECISIONS.md`](docs/DECISIONS.md).
