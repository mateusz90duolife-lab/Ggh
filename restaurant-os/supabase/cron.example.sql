-- Harmonogram (pg_cron + pg_net) — uruchom RĘCZNIE w SQL Editor Supabase po wdrożeniu funkcji.
-- Zastąp: <PROJECT_REF> (np. abcdefghijklmnop) i <CRON_SECRET> (ta sama wartość co w `supabase secrets set CRON_SECRET=…`).
-- Wymaga włączonych rozszerzeń: Database → Extensions → pg_cron, pg_net.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Sekret w Vault (nie wpisuj go w treści zadania ani w repozytorium).
select vault.create_secret('<CRON_SECRET>', 'ros_cron_secret');

-- 2) Zadania z szablonów: co godzinę (idempotentne; uwzględnia strefę czasu każdego lokalu).
select cron.schedule(
  'ros-generate-tasks',
  '5 * * * *',
  $$ select public.generate_tasks_for(id, (now() at time zone timezone)::date) from public.restaurants $$
);

-- 3) E-mail z listą zakupów: co 10 minut funkcja sprawdza, czy minęła godzina wysyłki lokalu (domyślnie 21:00)
--    i czy mail na dziś już wyszedł. Najwyżej jeden mail dziennie (zabezpiecza tabela email_log).
select cron.schedule(
  'ros-daily-shopping-summary',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-shopping-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ros_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Podgląd i usuwanie zadań:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('ros-generate-tasks');
