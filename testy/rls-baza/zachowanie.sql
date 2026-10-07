-- Sprawdza zachowanie polityk z perspektywy każdej roli.
-- Dostęp jest bezpłatny: U1, U2 i U3 to zwykli zalogowani użytkownicy.
-- Tabela subscriptions to pozostałość po płatnym dostępie — sprawdzamy,
-- że po migracji jest zamknięta dla klientów.
\set ON_ERROR_STOP on
\set U1 '''11111111-1111-1111-1111-111111111111'''
\set U2 '''22222222-2222-2222-2222-222222222222'''
\set U3 '''33333333-3333-3333-3333-333333333333'''

insert into auth.users values (:U1), (:U2), (:U3);
insert into public.questions (question, answers, correct_index) values
  ('pytanie 1', '["a","b"]', 0), ('pytanie 2', '["a","b"]', 1);
insert into public.subscriptions values
  (:U1, true, null), (:U3, true, now() - interval '1 day');
insert into public.progress (user_id, question_id, correct) values
  (:U1, 1, true), (:U2, 1, false);

-- Zlicza wiersze zapytania wykonanego w imieniu roli i użytkownika.
create function pg_temp.ile(rola text, uid text, zapytanie text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', rola)::text, true);
  execute format('set local role %I', rola);
  execute 'select count(*) from (' || zapytanie || ') t' into n;
  execute 'reset role';
  return n;
end $$;

-- Wykonuje polecenie w imieniu roli; zwraca 'ok', kod błędu albo liczbę zmienionych wierszy.
create function pg_temp.wykonaj(rola text, uid text, polecenie text) returns text
language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', rola)::text, true);
  execute format('set local role %I', rola);
  begin
    execute polecenie;
    get diagnostics n = row_count;
    execute 'reset role';
    return 'zmieniono ' || n;
  exception when others then
    execute 'reset role';
    return 'błąd ' || sqlstate;
  end;
end $$;

-- Plan zapytania wykonanego w imieniu roli — do sprawdzenia, czy auth.uid()
-- liczy się raz na zapytanie (InitPlan), czy dla każdego wiersza.
create function pg_temp.plan(rola text, uid text, zapytanie text) returns text
language plpgsql as $$
declare r record; wynik text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', rola)::text, true);
  execute format('set local role %I', rola);
  for r in execute 'explain ' || zapytanie loop wynik := wynik || r."QUERY PLAN" || E'\n'; end loop;
  execute 'reset role';
  return wynik;
end $$;

create function pg_temp.oczekuj(opis text, wynik text, oczekiwany text) returns void
language plpgsql as $$
begin
  if wynik is distinct from oczekiwany then
    raise exception 'BŁĄD: % — otrzymano %, oczekiwano %', opis, wynik, oczekiwany;
  end if;
  raise notice 'ok    %', opis;
end $$;

begin;
select pg_temp.oczekuj('anon nie widzi pytań', pg_temp.ile('anon', null, 'select * from public.questions')::text, '0');
select pg_temp.oczekuj('U1 widzi wszystkie pytania', pg_temp.ile('authenticated', :U1, 'select * from public.questions')::text, '2');
select pg_temp.oczekuj('U2 bez subskrypcji widzi wszystkie pytania', pg_temp.ile('authenticated', :U2, 'select * from public.questions')::text, '2');
select pg_temp.oczekuj('U3 z wygasłą subskrypcją widzi wszystkie pytania', pg_temp.ile('authenticated', :U3, 'select * from public.questions')::text, '2');
select pg_temp.oczekuj('zalogowany nie doda pytania',
  pg_temp.wykonaj('authenticated', :U1, 'insert into public.questions (question, answers, correct_index) values (''x'', ''["a"]'', 0)'),
  'błąd 42501');
select pg_temp.oczekuj('zalogowany nie zmieni pytania',
  pg_temp.wykonaj('authenticated', :U1, 'update public.questions set correct_index = 1'),
  'zmieniono 0');
select pg_temp.oczekuj('zalogowany nie usunie pytania',
  pg_temp.wykonaj('authenticated', :U1, 'delete from public.questions'),
  'zmieniono 0');
select pg_temp.oczekuj('pytania pozostały nienaruszone',
  (select count(*) filter (where correct_index = 0)::text || '/' || count(*)::text from public.questions), '1/2');

select pg_temp.oczekuj('anon nie widzi postępów', pg_temp.ile('anon', null, 'select * from public.progress')::text, '0');
select pg_temp.oczekuj('U1 widzi wyłącznie własne postępy', pg_temp.ile('authenticated', :U1, 'select * from public.progress')::text, '1');
select pg_temp.oczekuj('U2 widzi wyłącznie własne postępy', pg_temp.ile('authenticated', :U2, 'select * from public.progress')::text, '1');

select pg_temp.oczekuj('U1 zapisuje własny postęp',
  pg_temp.wykonaj('authenticated', :U1, format('insert into public.progress (user_id, question_id, correct) values (%L, 2, true)', :U1)),
  'zmieniono 1');
select pg_temp.oczekuj('U2 nie podrobi postępu w imieniu U1',
  pg_temp.wykonaj('authenticated', :U2, format('insert into public.progress (user_id, question_id, correct) values (%L, 2, true)', :U1)),
  'błąd 42501');
select pg_temp.oczekuj('U2 nie zmieni cudzego postępu',
  pg_temp.wykonaj('authenticated', :U2, format('update public.progress set correct = false where user_id = %L', :U1)),
  'zmieniono 0');

select pg_temp.oczekuj('anon nie widzi dawnych subskrypcji', pg_temp.ile('anon', null, 'select * from public.subscriptions')::text, '0');
select pg_temp.oczekuj('zalogowany nie widzi dawnych subskrypcji', pg_temp.ile('authenticated', :U1, 'select * from public.subscriptions')::text, '0');
select pg_temp.oczekuj('zalogowany nie zapisze subskrypcji',
  pg_temp.wykonaj('authenticated', :U2, format('insert into public.subscriptions values (%L, true, null)', :U2)),
  'błąd 42501');
select pg_temp.oczekuj('dane dawnych subskrypcji nie zostały usunięte',
  (select count(*)::text from public.subscriptions), '2');

-- Wydajność: zalecenie Supabase (lint 0003_auth_rls_initplan).
select pg_temp.oczekuj('progress: auth.uid() liczone raz na zapytanie (InitPlan)',
  (pg_temp.plan('authenticated', :U1, 'select * from public.progress') like '%InitPlan%')::text, 'true');
rollback;
