#!/usr/bin/env bash
# Uruchamia migracje + testy SQL na świeżej bazie PostgreSQL (wymaga lokalnego serwera i uprawnień superusera).
# Użycie: scripts/db-test.sh [nazwa_bazy]   (domyślnie ros_sqltest)
set -euo pipefail
DB="${1:-ros_sqltest}"
cd "$(dirname "$0")/.."
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
$P -f supabase/tests/00_supabase_mock.sql 2>&1 | grep -v -E 'wal_level|HINT' || true
for f in supabase/migrations/*.sql; do echo "migracja: $(basename "$f")"; $P -f "$f"; done
$P -f supabase/tests/10_rls_smoke.sql 2>&1 | grep -E 'FAIL|ERROR|PASSED' || true
$P -f supabase/tests/20_app_functions.sql 2>&1 | grep -E 'FAIL|ERROR|PASSED' || true
$P -f supabase/tests/30_catalog_receipts.sql 2>&1 | grep -E 'FAIL|ERROR|PASSED' || true
$P -f supabase/tests/40_staff.sql 2>&1 | grep -E 'FAIL|ERROR|PASSED' || true
