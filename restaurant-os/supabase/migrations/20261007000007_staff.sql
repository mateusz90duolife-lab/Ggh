-- 007_staff.sql — konta pracowników na nick + 4-cyfrowy PIN, rejestr godzin pracy,
-- zmiany stanów przez pracowników (pod ich nazwiskiem) i podgląd aktywności dla szefa.

-- ---------- nick i blokada po błędnych PIN-ach ----------
alter table profiles add column nick text
  check (nick is null or nick ~ '^[a-z0-9ąćęłńóśźż._-]{2,24}$');
alter table profiles add column pin_failed int not null default 0;
alter table profiles add column pin_locked_until timestamptz;
create unique index profiles_nick_uq on profiles (nick) where nick is not null;

-- Nick i licznik PIN zmienia tylko właściciel (przez funkcję admin-users) albo serwer (logowanie PIN-em).
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;       -- service role / migracje
  if not app_is_owner() then
    if new.role <> old.role or new.active <> old.active or new.restaurant_id <> old.restaurant_id
       or new.nick is distinct from old.nick or new.pin_failed <> old.pin_failed
       or new.pin_locked_until is distinct from old.pin_locked_until then
      raise exception 'Tylko właściciel może zmieniać rolę, status i dane logowania użytkownika';
    end if;
  end if;
  return new;
end $$;

-- ---------- pracownik zmienia stan magazynu pod swoim nazwiskiem ----------
-- Każdy zalogowany członek zespołu widzi własne ruchy (manager nadal widzi wszystkie).
create policy mov_sel_own on inventory_movements for select
  using (restaurant_id = app_restaurant_id() and created_by = auth.uid());

-- p_delta > 0: przyjęcie towaru (korekta +), p_delta < 0: wydanie / zużycie. Stan nie może spaść poniżej zera.
create or replace function staff_stock_change(p_product_id uuid, p_delta numeric, p_note text default null)
returns inventory_movements language plpgsql security definer set search_path = public as $$
declare row inventory_movements; cur numeric; p products%rowtype;
begin
  if app_restaurant_id() is null then raise exception 'Brak uprawnień'; end if;
  select * into p from products where id = p_product_id and restaurant_id = app_restaurant_id() and active;
  if not found then raise exception 'Produkt nie istnieje lub jest nieaktywny'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then raise exception 'Nieprawidłowa ilość'; end if;
  if length(coalesce(p_note, '')) > 300 then raise exception 'Uwaga jest za długa'; end if;
  perform pg_advisory_xact_lock(hashtext(p_product_id::text));   -- dwa równoczesne odjęcia nie zejdą poniżej zera
  select coalesce(sum(quantity_delta), 0) into cur from inventory_movements where product_id = p_product_id;
  if p_delta < 0 and cur + p_delta < 0 then
    raise exception 'Na stanie jest tylko % %', replace(rtrim(rtrim(round(cur, 3)::text, '0'), '.'), '.', ','), p.unit;
  end if;
  insert into inventory_movements (restaurant_id, product_id, type, quantity_delta, note, reference_type)
  values (app_restaurant_id(), p_product_id, case when p_delta > 0 then 'adjustment'::movement_type else 'consumption'::movement_type end,
          round(p_delta, 3),
          coalesce(nullif(trim(p_note), ''), case when p_delta > 0 then 'Przyjęcie (pracownik)' else 'Wydanie (pracownik)' end),
          'staff')
  returning * into row;
  return row;
end $$;

-- ---------- rejestr godzin pracy ----------
create table work_shifts (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  profile_id    uuid not null references profiles(id),
  started_at    timestamptz not null,
  ended_at      timestamptz,
  note          text check (length(note) <= 200),
  source        text not null default 'clock' check (source in ('clock', 'manual')),
  created_by    uuid not null default auth.uid() references profiles(id),
  created_at    timestamptz not null default now(),
  check (ended_at is null or (ended_at > started_at and ended_at - started_at <= interval '24 hours'))
);
create index on work_shifts (restaurant_id, started_at desc);
create index on work_shifts (profile_id, started_at desc);
create unique index work_shifts_one_open on work_shifts (profile_id) where ended_at is null;

alter table work_shifts enable row level security;
-- pracownik widzi swoje godziny, manager i właściciel — wszystkich; zapis przez funkcje, poprawki — manager
create policy ws_sel on work_shifts for select
  using (restaurant_id = app_restaurant_id() and (profile_id = auth.uid() or app_is_manager()));
create policy ws_upd on work_shifts for update using (restaurant_id = app_restaurant_id() and app_is_manager())
  with check (restaurant_id = app_restaurant_id() and app_is_manager());
-- usuwanie: manager — każdy wpis; pracownik — własny wpis z ostatnich 2 dni (pomyłka)
create policy ws_del on work_shifts for delete using (
  restaurant_id = app_restaurant_id()
  and (app_is_manager() or (profile_id = auth.uid() and started_at > now() - interval '2 days')));
create trigger work_shifts_audit after insert or update or delete on work_shifts
  for each row execute function audit_trigger();

create or replace function clock_in(p_note text default null) returns work_shifts
language plpgsql security definer set search_path = public as $$
declare row work_shifts;
begin
  if app_restaurant_id() is null then raise exception 'Brak uprawnień'; end if;
  if exists (select 1 from work_shifts where profile_id = auth.uid() and ended_at is null) then
    raise exception 'Praca jest już rozpoczęta'; end if;
  insert into work_shifts (restaurant_id, profile_id, started_at, note, source)
  values (app_restaurant_id(), auth.uid(), now(), nullif(trim(p_note), ''), 'clock')
  returning * into row;
  return row;
end $$;

create or replace function clock_out() returns work_shifts
language plpgsql security definer set search_path = public as $$
declare row work_shifts;
begin
  if app_restaurant_id() is null then raise exception 'Brak uprawnień'; end if;
  select * into row from work_shifts where profile_id = auth.uid() and ended_at is null for update;
  if not found then raise exception 'Praca nie jest rozpoczęta'; end if;
  if now() - row.started_at > interval '24 hours' then
    raise exception 'Zmiana trwa ponad 24 godziny — poproś managera o poprawkę godzin'; end if;
  update work_shifts set ended_at = greatest(now(), started_at + interval '1 minute')
   where id = row.id returning * into row;
  return row;
end $$;

-- Ręczny wpis godzin: pracownik — tylko dla siebie i z ostatnich 14 dni; manager — dla każdego z zespołu.
create or replace function add_shift(p_started_at timestamptz, p_ended_at timestamptz,
                                     p_note text default null, p_profile_id uuid default null)
returns work_shifts language plpgsql security definer set search_path = public as $$
declare row work_shifts; who uuid := coalesce(p_profile_id, auth.uid());
begin
  if app_restaurant_id() is null then raise exception 'Brak uprawnień'; end if;
  if who <> auth.uid() and not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  if not exists (select 1 from profiles where id = who and restaurant_id = app_restaurant_id()) then
    raise exception 'Pracownik nie istnieje'; end if;
  if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
    raise exception 'Koniec pracy musi być później niż początek'; end if;
  if p_ended_at - p_started_at > interval '16 hours' then raise exception 'Jedna zmiana może trwać najwyżej 16 godzin'; end if;
  if p_ended_at > now() + interval '5 minutes' then raise exception 'Nie można wpisać godzin z przyszłości'; end if;
  if not app_is_manager() and p_started_at < now() - interval '14 days' then
    raise exception 'Starsze godziny wpisuje manager'; end if;
  if exists (select 1 from work_shifts where profile_id = who
              and tstzrange(started_at, coalesce(ended_at, now())) && tstzrange(p_started_at, p_ended_at)) then
    raise exception 'Te godziny nakładają się na inny wpis'; end if;
  insert into work_shifts (restaurant_id, profile_id, started_at, ended_at, note, source)
  values (app_restaurant_id(), who, p_started_at, p_ended_at, nullif(trim(p_note), ''), 'manual')
  returning * into row;
  return row;
end $$;

revoke execute on function staff_stock_change(uuid, numeric, text), clock_in(text), clock_out(),
  add_shift(timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function staff_stock_change(uuid, numeric, text), clock_in(text), clock_out(),
  add_shift(timestamptz, timestamptz, text, uuid) to authenticated;
