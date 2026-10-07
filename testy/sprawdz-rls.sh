#!/usr/bin/env bash
# Sprawdza, co widać z zewnątrz samym kluczem anon, czyli tak, jak widzi
# to każdy, kto otworzy źródło strony. Tylko odczyt: pyta o jeden
# identyfikator na tabelę i niczego nie zmienia.
#
#   ./testy/sprawdz-rls.sh
#
# Adres projektu i klucz anon odczytuje z index.html, żeby nie trzymać ich
# w dwóch miejscach.

set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(grep -oE 'SUPABASE_URL *= *"[^"]+"' index.html | sed -E 's/.*"([^"]+)"/\1/')
KEY=$(grep -oE 'SUPABASE_KEY *= *"[^"]+"' index.html | sed -E 's/.*"([^"]+)"/\1/')
# Testy podstawiają tu lokalny serwer udający Supabase (testy/rls-skrypt.js).
URL="${RLS_CHECK_URL:-$URL}"
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "Nie znaleziono SUPABASE_URL albo SUPABASE_KEY w index.html." >&2
  exit 2
fi

echo "Projekt: $URL"
echo "Zapytania bez logowania, kluczem anon."
echo

# Stan końcowy: 0 = wszystko rozstrzygnięte i szczelne,
#               1 = wyciek danych, 2 = wynik nierozstrzygnięty.
# Brak połączenia NIGDY nie może wyglądać jak szczelność — pierwsza wersja
# tego skryptu przy zablokowanej sieci wypisywała „odmowa" i kończyła się
# sukcesem, czyli dawała fałszywie uspokajający wynik.
status=0
any_empty=0
for table in questions progress subscriptions; do
  body=$(mktemp); err=$(mktemp)
  set +e
  code=$(curl -sS --max-time 20 -o "$body" -w '%{http_code}' \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    "$URL/rest/v1/$table?select=*&limit=1" 2>"$err")
  rc=$?
  set -e
  content=$(head -c 300 "$body")
  reason=$(head -c 120 "$err" | tr '\n' ' ')
  rm -f "$body" "$err"

  if [ "$rc" -ne 0 ] || [ "$code" = "000" ]; then
    printf '  %-14s  BRAK POŁĄCZENIA — %s\n' "$table" "${reason:-nieznany błąd}"
    [ "$status" = "1" ] || status=2
  elif [ "$code" = "200" ] && [ "$content" != "[]" ]; then
    printf '  %-14s  NIESZCZELNA — dane widoczne bez logowania\n' "$table"
    status=1
  elif [ "$code" = "200" ]; then
    printf '  %-14s  pusto — polityka blokuje albo tabela nie ma wierszy\n' "$table"
    any_empty=1
  elif [ "$code" = "401" ] || [ "$code" = "403" ]; then
    printf '  %-14s  odmowa dostępu (HTTP %s)\n' "$table" "$code"
  else
    printf '  %-14s  nieoczekiwana odpowiedź (HTTP %s)\n' "$table" "$code"
    [ "$status" = "1" ] || status=2
  fi
done

echo
if [ "$any_empty" = "1" ]; then
  echo "Pusta odpowiedź oznacza albo działającą politykę, albo pustą tabelę."
  echo "Kluczem anon nie da się tych przypadków odróżnić. Wynik jest rozstrzygający"
  echo "dopiero wtedy, gdy tabela questions zawiera co najmniej jedno pytanie."
  echo
fi

case "$status" in
  0) echo "WYNIK: żadna tabela nie ujawnia danych bez logowania." ;;
  1) echo "WYNIK: WYCIEK. Wdróż supabase/migrations/20261007120000_rls_paywall.sql i uruchom ponownie." ;;
  2) echo "WYNIK: NIEROZSTRZYGNIĘTY. Nie udało się połączyć z projektem, więc o szczelności nic nie wiadomo." ;;
esac
exit "$status"
