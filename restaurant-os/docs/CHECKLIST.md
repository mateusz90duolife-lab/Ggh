# Lista kontrolna przed udostępnieniem

Legenda: ✅ sprawdzone automatycznie · ⚠️ częściowo albo wymaga sprawdzenia u Ciebie · ❌ nie zrobione.

**Stan wdrożenia:** backend działa na prawdziwym projekcie Supabase (migracje, RLS, funkcje Edge, konto właściciela); testy SQL i sprawdzenie API przeszły na produkcji — szczegóły w `WDROZENIE.md`. Interfejs przetestowano w Chromium przeciw lokalnemu backendowi testowemu (D10), a nie na prawdziwych telefonach. Po włączeniu GitHub Pages zrób test dymny (`SETUP.md`, krok 7).

| Obszar                        | Stan | Dowód / uwagi                                                                                                                                                                   |
| ----------------------------- | :--: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logowanie, reset hasła        |  ✅  | E2E: błędne hasło, sesja po odświeżeniu, link resetu (także gdy aplikacja jest już otwarta), wygasły link, odświeżanie tokenu                                                   |
| Role i blokada tras           |  ✅  | E2E: pracownik/manager nie wchodzą do paneli wyższej roli; SQL: eskalacja uprawnień niemożliwa                                                                                  |
| RLS                           |  ✅  | Testy SQL (izolacja restauracji, `anon`, każda rola); test statyczny: RLS na wszystkich 16 tabelach                                                                             |
| Magazyn i ruchy               |  ✅  | Stan = suma ruchów, ruchy niezmienne, walidacje, alert niskiego stanu (jeden na przekroczenie progu), inwentaryzacja                                                            |
| Braki i lista zakupów         |  ✅  | Agregacja 5+10 L = 15 L, PILNE, anulowanie, „nie ma na liście”                                                                                                                  |
| Zakupy                        |  ✅  | Atomowy zakup (ruchy + cena + zamknięcie braków), szkic nie rusza stanu, brak podwójnego zatwierdzenia                                                                          |
| E-mail z listą zakupów        |  ⚠️  | Testy z atrapą Resend: godzina, strefa czasu, jeden mail dziennie, ponowienie po błędzie. **Prawdziwa wysyłka przez Resend nie była sprawdzona**                                |
| Zadania, szablony             |  ✅  | Odhaczanie, widok managera bez przeładowania, szablony wg dni tygodnia, idempotentne generowanie                                                                                |
| Dashboard                     |  ✅  | Karty zgodne ze specyfikacją; kwota zakupów tylko dla właściciela                                                                                                               |
| Pracownicy, ustawienia        |  ✅  | Tworzenie konta, logowanie, dezaktywacja (blokada Auth), duplikaty, własna rola zablokowana                                                                                     |
| Audyt (KTO · CO · KIEDY)      |  ✅  | Triggery na wszystkich tabelach, czytelne opisy, filtry                                                                                                                         |
| PWA                           |  ⚠️  | Manifest, ikony, service worker, otwarcie bez internetu — sprawdzone w Chromium. **Instalacja na prawdziwym Androidzie/iPhonie nie była testowana**; Lighthouse nie uruchamiano |
| Offline (minimum)             |  ✅  | Zgłoszenie braku i odhaczenie zadania offline → kolejka → jedna synchronizacja bez duplikatów                                                                                   |
| Responsywność                 |  ✅  | 360, 390, 412, 768, 1280, 1440 px: brak poziomego scrolla, właściwa nawigacja (emulacja w Chromium, nie prawdziwe urządzenia)                                                   |
| Bezpieczeństwo                |  ⚠️  | Brak sekretów we froncie, brak `innerHTML`, CSP, RLS, walidacja w 3 warstwach. Brak ograniczania liczby żądań (rate limiting) i testu penetracyjnego                            |
| Build produkcyjny             |  ✅  | `npm run lint`, `npm test`, `npm run db:test`, `npm run e2e` przechodzą lokalnie. CI (`.github/workflows`) nie było uruchamiane                                                 |
| Kopie zapasowe                |  ❌  | Tylko opisane w `SETUP.md`; trzeba włączyć w Supabase i przećwiczyć przywracanie                                                                                                |
| „Realtime”                    |  ⚠️  | Odpytywanie co 8–20 s zamiast WebSocket (D2)                                                                                                                                    |
| OCR, ceny, receptury, raporty |  ❌  | FAZY 3–6, poza tym wydaniem (D12). Historia cen jest zapisywana i widoczna na karcie produktu                                                                                   |
| Dokumentacja                  |  ✅  | `SETUP.md`, instrukcje dla trzech ról, `DECISIONS.md`                                                                                                                           |

Żaden element kodu nie jest oznaczony jako `TODO`, `MOCK` ani `PLACEHOLDER` (pilnuje tego test w `tests/security.test.mjs`).
