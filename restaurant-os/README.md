# Restaurant OS — master prompt

- `MASTER_PROMPT.md` — kompletna specyfikacja „BUILD MODE” do wklejenia w agenta AI (Claude Code, Lovable, Replit, Cursor). Pracuje fazami 1–6, z bramkami jakości.
- `verification/` — dowód, że SQL z sekcji 4 działa: atrapa schematu Supabase (`auth`, `storage`, role) oraz test dymny RLS/RPC.

Uruchomienie testu (PostgreSQL 16, pusta baza):

```bash
createdb ros_test
psql -v ON_ERROR_STOP=1 ros_test -f verification/00_supabase_mock.sql
# wyciągnij bloki ```sql z sekcji 4 MASTER_PROMPT.md do migracji 001–005 i wykonaj je po kolei
psql -v ON_ERROR_STOP=1 ros_test -f verification/rls_smoke.sql   # na końcu: ALL TESTS PASSED
```

Test nie jest powtarzalny na tej samej bazie — przed każdym uruchomieniem twórz pustą bazę.
