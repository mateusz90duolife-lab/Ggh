-- Sprawdza zachowanie polityk z perspektywy każdej roli.
-- Użytkownicy: U1 — aktywna subskrypcja, U2 — brak subskrypcji,
--              U3 — subskrypcja wygasła.
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
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
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
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
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
select pg_temp.oczekuj('subskrybent widzi pytania', pg_temp.ile('authenticated', :U1, 'select * from public.questions')::text, '2');
select pg_temp.oczekuj('zalogowany bez subskrypcji nie widzi pytań', pg_temp.ile('authenticated', :U2, 'select * from public.questions')::text, '0');
select pg_temp.oczekuj('wygasła subskrypcja nie daje dostępu', pg_temp.ile('authenticated', :U3, 'select * from public.questions')::text, '0');

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

select pg_temp.oczekuj('anon nie widzi subskrypcji', pg_temp.ile('anon', null, 'select * from public.subscriptions')::text, '0');
select pg_temp.oczekuj('U1 widzi tylko własną subskrypcję', pg_temp.ile('authenticated', :U1, 'select * from public.subscriptions')::text, '1');
select pg_temp.oczekuj('U2 nie nada sobie subskrypcji',
  pg_temp.wykonaj('authenticated', :U2, format('insert into public.subscriptions values (%L, true, null)', :U2)),
  'błąd 42501');
select pg_temp.oczekuj('U3 nie przedłuży sobie wygasłej subskrypcji',
  pg_temp.wykonaj('authenticated', :U3, format('update public.subscriptions set expires_at = null where user_id = %L', :U3)),
  'zmieniono 0');
select pg_temp.oczekuj('wygasła subskrypcja U3 pozostała nienaruszona',
  (select (expires_at is not null)::text from public.subscriptions where user_id = :U3), 'true');

select pg_temp.oczekuj('webhook (service_role) nadaje subskrypcję',
  pg_temp.wykonaj('service_role', null, format('insert into public.subscriptions values (%L, true, null)', :U2)),
  'zmieniono 1');
select pg_temp.oczekuj('po opłaceniu U2 widzi pytania', pg_temp.ile('authenticated', :U2, 'select * from public.questions')::text, '2');
rollback;
