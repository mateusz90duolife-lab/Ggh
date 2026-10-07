#!/usr/bin/env bash
# Uruchamia komplet testów obu aplikacji: trenera izometryki
# i kursu pomp ciepła i klimatyzacji.
#
#   ./testy/uruchom.sh            testy logiki (Node, bez zależności)
#   ./testy/uruchom.sh --all      dodatkowo testy w przeglądarce (Playwright)
#
# Testy logiki działają na kodzie wyciętym z plików HTML, więc
# aplikacje nie zawierają żadnych ułatwień pod kątem testowania.

set -euo pipefail
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# test_app PLIK.html TESTY_LOGIKI.js TESTY_PRZEGLĄDARKI.js
test_app() {
  local app=$1 logic=$2 browser=$3 name
  name=$(basename "$app" .html)
  echo "════════ $app ════════"
  # Wytnij blok <script> i odetnij linie uruchamiające interfejs (od load(); do render();)
  sed -n '/^<script>$/,/^<\/script>$/p' "$app" | sed '1d;$d' > "$TMP/$name-pelny.js"
  node --check "$TMP/$name-pelny.js"
  echo "Składnia $app: OK"
  sed '/^load();$/,/^render();$/d' "$TMP/$name-pelny.js" > "$TMP/$name-rdzen.js"
  cat "$TMP/$name-rdzen.js" "$logic" > "$TMP/$name-testy.js"
  node "$TMP/$name-testy.js"
  if [ "$ALL" = 1 ]; then
    echo "Testy w przeglądarce (Chromium): $app"
    NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node "$browser" "$app"
  fi
}

ALL=0
[ "${1:-}" = "--all" ] && ALL=1

test_app trener.html testy/logika.js       testy/przegladarka.js
test_app pompy.html  testy/pompy-logika.js testy/pompy-przegladarka.js
