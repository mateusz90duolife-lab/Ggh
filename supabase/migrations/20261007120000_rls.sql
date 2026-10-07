-- ═══════════════════════════════════════════════════════════════
-- Polityki Row Level Security dla powłoki SaaS (index.html)
--
-- Dostęp jest bezpłatny: każdy zalogowany użytkownik czyta wszystkie
-- pytania. Klucz anon jest jednak wpisany w źródło strony, więc każdy może
-- odpytać API z pominięciem interfejsu — dlatego polityki nadal pilnują,
-- żeby nikt nie czytał ani nie podrabiał cudzych postępów i żeby klient nie
-- mógł zmieniać treści pytań.
--
-- Migracja jest idempotentna: można ją uruchomić ponownie bez błędów.
-- Zakłada schemat tabel opisany w README.md.
--
-- auth.uid() jest zawsze opakowane w (select ...). Dzięki temu Postgres
-- liczy je raz na zapytanie (InitPlan), a nie dla każdego wiersza.
-- Bez tego doradca Supabase zgłasza ostrzeżenie 0003_auth_rls_initplan.
--
-- Wdrożenie:  supabase db push
--        albo: wklej całość w Supabase → SQL Editor → Run
-- Weryfikacja: ./testy/sprawdz-rls.sh
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── questions: odczyt dla każdego zalogowanego, zapis tylko z panelu ──
-- Brak polityk insert, update i delete: pytania dodaje się w panelu
-- Supabase albo rolą service_role, która pomija RLS.
alter table public.questions enable row level security;

drop policy if exists "pytania dla subskrybentow" on public.questions;
drop policy if exists "pytania dla zalogowanych" on public.questions;
create policy "pytania dla zalogowanych" on public.questions
  for select
  to authenticated
  using (true);

-- ── progress: własne wiersze, cudzych nie widać i nie da się podrobić ─
alter table public.progress enable row level security;

drop policy if exists "wlasne postepy" on public.progress;
create policy "wlasne postepy" on public.progress
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Polityka filtruje po user_id przy każdym zapytaniu.
create index if not exists progress_user_id_idx on public.progress (user_id);

-- ── subscriptions: pozostałość po płatnym dostępie ───────────────────
-- Aplikacja już z niej nie korzysta. Jeśli tabela istnieje w bazie, zostaje
-- zamknięta dla klientów: RLS bez żadnej polityki oznacza brak dostępu dla
-- anon i authenticated. Danych nie usuwamy — to decyzja właściciela bazy.
do $$
begin
  if to_regclass('public.subscriptions') is not null then
    execute 'alter table public.subscriptions enable row level security';
    execute 'drop policy if exists "odczyt wlasnej subskrypcji" on public.subscriptions';
  end if;
end $$;

commit;
