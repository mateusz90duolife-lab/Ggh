#!/usr/bin/env bash
# Uruchamia migrację RLS na tymczasowym klastrze PostgreSQL z imitacją
# Supabase i sprawdza zachowanie polityk z perspektywy każdej roli.
# Wymaga PostgreSQL (initdb, pg_ctl, psql) i użytkownika systemowego postgres.
#
#   ./testy/rls-baza.sh

set -euo pipefail
cd "$(dirname "$0")/.."
MIG=${RLS_MIGRATION:-supabase/migrations/20261007120000_rls_paywall.sql}

BIN=$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | tail -1)")
if [ ! -x "$BIN/pg_ctl" ]; then echo "Brak PostgreSQL — test pominięty."; exit 0; fi

AS=""; [ "$(id -u)" = "0" ] && AS="runuser -u postgres --"
WORK=$(mktemp -d); chmod 755 "$WORK"
[ -n "$AS" ] && chown postgres:postgres "$WORK"
PORT=$(( 20000 + RANDOM % 20000 ))
cleanup() { $AS "$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

$AS "$BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
$AS "$BIN/pg_ctl" -D "$WORK/data" -o "-k $WORK -p $PORT -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL="$AS psql -h $WORK -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
echo "Migracja RLS na tymczasowej bazie (PostgreSQL $($AS "$BIN/postgres" --version | awk '{print $3}'))"
# Komunikaty informacyjne migracji („policy does not exist, skipping") to szum,
# więc dla przygotowania i migracji podnosimy próg komunikatów.
quiet() { { echo "set client_min_messages = warning;"; cat "$1"; } | $PSQL; }
quiet testy/rls-baza/imitacja-supabase.sql
quiet "$MIG"
echo "  ok    migracja wykonana"
quiet "$MIG"
echo "  ok    migracja wykonana ponownie bez błędów (idempotentna)"
# Wyniki zapytań idą do /dev/null; sprawdzenia raportują przez NOTICE,
# a każde niespełnione kończy skrypt błędem dzięki ON_ERROR_STOP.
set +e
$PSQL -o /dev/null < testy/rls-baza/zachowanie.sql 2>&1 | sed -E 's/^(psql:[^ ]+ )?NOTICE:  /  /; s/^(psql:[^ ]+ )?ERROR:  /  /'
rc=${PIPESTATUS[0]}
set -e
[ "$rc" -eq 0 ] || { echo; echo "Polityki RLS NIE zachowują się zgodnie z założeniami."; exit 1; }
echo
echo "Polityki RLS zachowują się zgodnie z założeniami."
