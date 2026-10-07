-- ═══════════════════════════════════════════════════════════════
-- Polityki Row Level Security dla powłoki SaaS (index.html)
--
-- Klucz anon jest wpisany w źródło strony, więc każdy może odpytać API
-- z pominięciem interfejsu. Sprawdzenie subskrypcji w przeglądarce tylko
-- ukrywa przyciski. Jedyną realną granicą dostępu są poniższe polityki.
--
-- Migracja jest idempotentna: można ją uruchomić ponownie bez błędów.
-- Zakłada schemat tabel opisany w README.md.
--
-- Wdrożenie:  supabase db push
--        albo: wklej całość w Supabase → SQL Editor → Run
-- Weryfikacja: ./testy/sprawdz-rls.sh
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── questions: treść płatna, tylko dla aktywnej subskrypcji ──────────
alter table public.questions enable row level security;

drop policy if exists "pytania dla subskrybentow" on public.questions;
create policy "pytania dla subskrybentow" on public.questions
  for select
  to authenticated
  using (exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.active
      and (s.expires_at is null or s.expires_at > now())
  ));

-- ── progress: własne wiersze, cudzych nie widać i nie da się podrobić ─
alter table public.progress enable row level security;

drop policy if exists "wlasne postepy" on public.progress;
create policy "wlasne postepy" on public.progress
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Polityka filtruje po user_id przy każdym zapytaniu.
create index if not exists progress_user_id_idx on public.progress (user_id);

-- ── subscriptions: tylko odczyt własnego wiersza ─────────────────────
-- Zapisuje wyłącznie webhook Stripe działający rolą service_role, która
-- pomija RLS. Celowy brak polityk insert, update i delete oznacza, że
-- klient nie nada sobie dostępu PRO.
alter table public.subscriptions enable row level security;

drop policy if exists "odczyt wlasnej subskrypcji" on public.subscriptions;
create policy "odczyt wlasnej subskrypcji" on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

commit;
