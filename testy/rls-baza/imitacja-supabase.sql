-- Minimalna imitacja tych elementów Supabase, od których zależą polityki:
-- role klienckie, schemat auth z funkcją auth.uid() i domyślne uprawnienia.
-- Supabase nadaje rolom anon i authenticated szerokie GRANT-y na schemat
-- public i polega na RLS jako jedynym filtrze — dokładnie tak jest tutaj,
-- bo tylko wtedy test sprawdza polityki, a nie przypadkowy brak uprawnień.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key);

-- Supabase odczytuje identyfikator użytkownika z tokenu JWT; tu z ustawienia sesji.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Schemat aplikacji zgodny z README.md
create table public.questions (
  id            bigserial primary key,
  question      text    not null,
  answers       jsonb   not null,
  correct_index int     not null,
  fail_message  text,
  image_url     text
);
create table public.progress (
  id          bigserial primary key,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  question_id bigint  not null references public.questions(id) on delete cascade,
  correct     boolean not null,
  created_at  timestamptz default now()
);
create table public.subscriptions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  active     boolean     not null default false,
  expires_at timestamptz
);

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
