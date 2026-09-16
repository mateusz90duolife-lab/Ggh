#!/usr/bin/env bash
# Uruchamia komplet testów trenera izometryki.
#
#   ./testy/uruchom.sh            testy logiki (Node, bez zależności)
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
sed '/^load();$/,/^render();$/d' "$TMP/pelny.js" > "$TMP/rdzen.js"

cat "$TMP/rdzen.js" testy/logika.js > "$TMP/testy.js"
node "$TMP/testy.js"

if [ "${1:-}" = "--all" ]; then
  echo "Testy w przeglądarce (Chromium)..."
  NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node testy/przegladarka.js "$APP"
fi
