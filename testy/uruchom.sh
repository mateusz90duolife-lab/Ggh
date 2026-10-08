#!/usr/bin/env bash
# Uruchamia komplet testów trenera izometryki.
#
#   ./testy/uruchom.sh            logika (Node) + skrypt RLS + migracja RLS na PostgreSQL
#   ./testy/uruchom.sh --all      dodatkowo testy w przeglądarce (Playwright)
#
# Testy logiki działają na kodzie wyciętym z trener.html, więc aplikacja
# nie zawiera żadnych ułatwień pod kątem testowania.

set -euo pipefail
cd "$(dirname "$0")/.."

APP=trener.html
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Wytnij blok <script> i odetnij dwie ostatnie linie uruchamiające interfejs
sed -n '/^<script>$/,/^<\/script>$/p' "$APP" | sed '1d;$d' > "$TMP/pelny.js"
node --check "$TMP/pelny.js"
echo "Składnia $APP: OK"
sed '/START APLIKACJI/,$d' "$TMP/pelny.js" > "$TMP/rdzen.js"

cat "$TMP/rdzen.js" testy/logika.js > "$TMP/testy.js"
node "$TMP/testy.js"

# Karta recenzji musi odpowiadać aktualnej treści lekcji
node narzedzia/karta-recenzji.js > "$TMP/karta.md"
if ! diff -q "$TMP/karta.md" recenzja/karta.md >/dev/null; then
  echo "BŁĄD: recenzja/karta.md jest nieaktualna. Uruchom: node narzedzia/karta-recenzji.js > recenzja/karta.md"
  exit 1
fi
echo "Karta recenzji aktualna ($(grep -c '^| [0-9]' recenzja/karta.md) pozycji)."

# Skrypt sprawdzający szczelność RLS — na lokalnym serwerze udającym Supabase
node testy/rls-skrypt.js

# Migracja RLS na prawdziwym PostgreSQL (pomijana, gdy go brak)
./testy/rls-baza.sh

if [ "${1:-}" = "--all" ]; then
  echo "Testy w przeglądarce (Chromium)..."
  NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node testy/przegladarka.js "$APP"
fi
