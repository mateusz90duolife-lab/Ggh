-- 001_core.sql
create extension if not exists pgcrypto;

create type user_role      as enum ('owner', 'manager', 'employee');
create type unit_type      as enum ('kg', 'g', 'l', 'ml', 'szt', 'opak', 'but');
create type movement_type  as enum ('purchase', 'consumption', 'waste', 'adjustment', 'count_correction');
create type shortage_status as enum ('open', 'resolved', 'cancelled');
create type task_status    as enum ('todo', 'done');

-- ---------- tenancy + profile ----------
create table restaurants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  timezone      text not null default 'Europe/Warsaw',
  summary_time  time not null default '21:00',        -- lokalna godzina wysyłki listy zakupów
  summary_emails text[] not null default '{}',        -- odbiorcy maila
  created_at    timestamptz not null default now()
);

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id),
  full_name     text not null check (length(trim(full_name)) between 2 and 80),
  role          user_role not null default 'employee',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on profiles (restaurant_id);

-- ---------- helpery (security definer, żeby RLS nie rekurencjował) ----------
create or replace function app_restaurant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select restaurant_id from profiles where id = auth.uid() and active
$$;
create or replace function app_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;
create or replace function app_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() in ('owner', 'manager'), false)
$$;
create or replace function app_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'owner', false)
$$;

-- ---------- katalog ----------
create table product_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  name          text not null check (length(trim(name)) between 1 and 60),
  sort_order    int  not null default 0,
  unique (restaurant_id, name)
);

create table products (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  category_id   uuid references product_categories(id) on delete set null,
  name          text not null check (length(trim(name)) between 1 and 80),
  unit          unit_type not null,
  minimum_stock numeric(12,3) not null default 0 check (minimum_stock >= 0 and minimum_stock <= 100000),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index products_name_uq on products (restaurant_id, lower(name));
create index on products (restaurant_id, category_id);

-- ---------- ruchy magazynowe (append-only) ----------
create table inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null default app_restaurant_id() references restaurants(id),
  product_id     uuid not null references products(id) on delete restrict,
  type           movement_type not null,
  quantity_delta numeric(12,3) not null,
  note           text check (length(note) <= 500),
  reference_type text,                 -- 'purchase' | 'count' | 'sale' | 'manual'
  reference_id   uuid,
  created_by     uuid not null default auth.uid() references profiles(id),
  created_at     timestamptz not null default now(),
  constraint qty_nonzero check (quantity_delta <> 0),
  constraint qty_bounds  check (abs(quantity_delta) <= 100000),
  constraint qty_sign    check (
    (type = 'purchase'    and quantity_delta > 0) or
    (type in ('consumption', 'waste') and quantity_delta < 0) or
    (type in ('adjustment', 'count_correction'))
  )
);
create index on inventory_movements (product_id, created_at desc);
create index on inventory_movements (restaurant_id, created_at desc);

create or replace function forbid_change() returns trigger language plpgsql as $$
begin raise exception 'Rekordy w % są niezmienne (append-only)', tg_table_name; end $$;
create trigger movements_immutable before update or delete on inventory_movements
  for each row execute function forbid_change();

-- stan = suma ruchów. Widok bez security_invoker, ale filtrowany po restauracji użytkownika
-- (pracownik widzi stany, NIE widzi historii ruchów).
create view product_stock as
select p.id as product_id, p.restaurant_id, p.name, p.unit, p.category_id, p.minimum_stock, p.active,
       coalesce(sum(m.quantity_delta), 0)::numeric(14,3) as stock,
       case when coalesce(sum(m.quantity_delta), 0) <= 0 then 'out'
            when coalesce(sum(m.quantity_delta), 0) < p.minimum_stock then 'low'
            else 'ok' end as status
from products p
left join inventory_movements m on m.product_id = p.id
where p.restaurant_id = app_restaurant_id()
group by p.id;

-- ---------- inwentaryzacja ----------
create table inventory_counts (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  session_id    uuid not null,                      -- jedna inwentaryzacja = wiele wierszy
  product_id    uuid not null references products(id) on delete restrict,
  system_qty    numeric(14,3) not null,
  counted_qty   numeric(12,3) not null check (counted_qty >= 0 and counted_qty <= 100000),
  difference    numeric(14,3) generated always as (counted_qty - system_qty) stored,
  created_by    uuid not null default auth.uid() references profiles(id),
  created_at    timestamptz not null default now()
);
create index on inventory_counts (session_id);

-- ---------- braki ----------
create table shortages (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  product_id    uuid not null references products(id) on delete restrict,
  quantity      numeric(12,3) not null check (quantity > 0 and quantity <= 100000),
  unit          unit_type not null,                 -- kopia jednostki produktu w chwili zgłoszenia
  urgent        boolean not null default false,
  note          text check (length(note) <= 300),
  status        shortage_status not null default 'open',
  reported_by   uuid not null default auth.uid() references profiles(id),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references profiles(id),
  client_id     uuid unique                 -- idempotencja zgłoszeń z kolejki offline
);
create index on shortages (restaurant_id, status);
create index on shortages (product_id) where status = 'open';

-- lista zakupów = agregacja otwartych braków (3 zgłoszenia mleka = 1 wiersz)
create view shopping_list with (security_invoker = true) as
select s.restaurant_id, s.product_id, p.name as product_name,
       coalesce(c.name, 'Inne') as category_name, c.sort_order as category_order,
       s.unit,
       sum(s.quantity)::numeric(14,3) as total_quantity,
       bool_or(s.urgent) as urgent,
       count(*)::int as reports_count,
       min(s.created_at) as first_reported_at
from shortages s
join products p on p.id = s.product_id
left join product_categories c on c.id = p.category_id
where s.status = 'open'
group by s.restaurant_id, s.product_id, p.name, c.name, c.sort_order, s.unit;

-- ---------- zadania ----------
create table task_templates (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  title         text not null check (length(trim(title)) between 1 and 120),
  description   text check (length(description) <= 500),
  days_of_week  smallint[] not null check (cardinality(days_of_week) > 0
                                            and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]), -- ISO: 1=pn … 7=nd
  active        boolean not null default true,
  created_by    uuid not null default auth.uid() references profiles(id),
  created_at    timestamptz not null default now()
);

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  template_id   uuid references task_templates(id) on delete set null,
  title         text not null check (length(trim(title)) between 1 and 120),
  description   text check (length(description) <= 500),
  due_date      date not null,
  status        task_status not null default 'todo',
  assigned_to   uuid references profiles(id),
  done_by       uuid references profiles(id),
  done_at       timestamptz,
  created_by    uuid not null default auth.uid() references profiles(id),
  created_at    timestamptz not null default now()
);
create unique index tasks_template_day_uq on tasks (template_id, due_date) where template_id is not null;
create index on tasks (restaurant_id, due_date);

-- ---------- powiadomienia, audyt, log maili ----------
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  for_role      user_role not null default 'manager',   -- manager = manager + owner
  type          text not null,
  title         text not null,
  body          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on notifications (restaurant_id, created_at desc);

create table audit_logs (
  id            bigint generated always as identity primary key,
  restaurant_id uuid,
  actor_id      uuid,
  action        text not null,                      -- INSERT | UPDATE | DELETE
  table_name    text not null,
  record_id     uuid,
  old_data      jsonb,
  new_data      jsonb,
  created_at    timestamptz not null default now()
);
create index on audit_logs (restaurant_id, created_at desc);
create index on audit_logs (table_name, record_id);

create table email_log (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  kind          text not null,                      -- 'shopping_summary'
  local_date    date not null,
  status        text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, kind, local_date)          -- idempotencja: max 1 mail dziennie danego rodzaju
);

-- ---------- generyczny trigger audytu ----------
create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into audit_logs (restaurant_id, actor_id, action, table_name, record_id, old_data, new_data)
  values ((rec->>'restaurant_id')::uuid, auth.uid(), tg_op, tg_table_name, (rec->>'id')::uuid,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['restaurants', 'profiles', 'product_categories', 'products',
                           'inventory_movements', 'shortages', 'tasks', 'task_templates']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I
                    for each row execute function audit_trigger()', t, t);
  end loop;
end $$;

-- ---------- ochrona profili przed eskalacją uprawnień ----------
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;       -- service role / migracje
  if not app_is_owner() then
    if new.role <> old.role or new.active <> old.active or new.restaurant_id <> old.restaurant_id then
      raise exception 'Tylko właściciel może zmieniać rolę/status użytkownika';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on profiles for each row execute function guard_profile_update();

-- ---------- alert niskiego stanu (tylko przy PRZEKROCZENIU progu) ----------
create or replace function notify_low_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare cur numeric; prev numeric; p products%rowtype;
begin
  select * into p from products where id = new.product_id;
  select coalesce(sum(quantity_delta), 0) into cur from inventory_movements where product_id = new.product_id;
  prev := cur - new.quantity_delta;
  if p.minimum_stock > 0 and cur < p.minimum_stock and prev >= p.minimum_stock then
    insert into notifications (restaurant_id, for_role, type, title, body)
    values (p.restaurant_id, 'manager', 'low_stock',
            case when cur <= 0 then 'BRAK: ' || p.name else 'Niski stan: ' || p.name end,
            'Stan ' || cur || ' ' || p.unit || ', minimum ' || p.minimum_stock || ' ' || p.unit);
  end if;
  return new;
end $$;
create trigger movements_low_stock after insert on inventory_movements
  for each row execute function notify_low_stock();

-- ---------- RPC: zgłoszenie braku (jedyna droga INSERT dla pracownika) ----------
create or replace function report_shortage(
  p_product_id uuid, p_quantity numeric, p_urgent boolean default false, p_note text default null,
  p_client_id uuid default null)
returns shortages language plpgsql security definer set search_path = public as $$
declare prod products%rowtype; row shortages;
begin
  if app_restaurant_id() is null then raise exception 'Brak uprawnień'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100000 then
    raise exception 'Ilość musi być większa od 0 i nie większa niż 100000'; end if;
  select * into prod from products
   where id = p_product_id and restaurant_id = app_restaurant_id() and active;
  if not found then raise exception 'Produkt nie istnieje lub jest nieaktywny'; end if;
  insert into shortages (restaurant_id, product_id, quantity, unit, urgent, note, client_id)
  values (prod.restaurant_id, prod.id, round(p_quantity, 3), prod.unit, coalesce(p_urgent, false), nullif(trim(p_note), ''), p_client_id)
  on conflict (client_id) do nothing
  returning * into row;
  if row.id is null then                                  -- powtórka z kolejki offline: zwróć istniejący rekord
    select * into row from shortages where client_id = p_client_id and restaurant_id = app_restaurant_id();
  end if;
  return row;
end $$;

-- ---------- RPC: odhaczenie zadania ----------
create or replace function complete_task(p_task_id uuid, p_done boolean default true)
returns tasks language plpgsql security definer set search_path = public as $$
declare row tasks;
begin
  if app_restaurant_id() is null then raise exception 'Brak uprawnień'; end if;
  update tasks set status = case when p_done then 'done'::task_status else 'todo'::task_status end,
                   done_by = case when p_done then auth.uid() end,
                   done_at = case when p_done then now() end
   where id = p_task_id and restaurant_id = app_restaurant_id()
   returning * into row;
  if not found then raise exception 'Zadanie nie istnieje'; end if;
  return row;
end $$;

-- ---------- RPC: ruch magazynowy (manager+) ----------
create or replace function record_movement(
  p_product_id uuid, p_type movement_type, p_quantity_delta numeric, p_note text default null)
returns inventory_movements language plpgsql security definer set search_path = public as $$
declare row inventory_movements;
begin
  if not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  if not exists (select 1 from products where id = p_product_id and restaurant_id = app_restaurant_id()) then
    raise exception 'Produkt nie istnieje'; end if;
  insert into inventory_movements (restaurant_id, product_id, type, quantity_delta, note, reference_type)
  values (app_restaurant_id(), p_product_id, p_type, round(p_quantity_delta, 3), nullif(trim(p_note), ''), 'manual')
  returning * into row;
  return row;
end $$;

-- ---------- RPC: inwentaryzacja (manager+) ----------
-- p_items: [{"product_id":"…","counted_qty":13.5}, …]
create or replace function submit_inventory_count(p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid := gen_random_uuid(); it jsonb; sys numeric; cnt numeric; pid uuid;
begin
  if not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    pid := (it->>'product_id')::uuid; cnt := (it->>'counted_qty')::numeric;
    if cnt is null or cnt < 0 or cnt > 100000 then raise exception 'Nieprawidłowa ilość'; end if;
    if not exists (select 1 from products where id = pid and restaurant_id = app_restaurant_id()) then
      raise exception 'Produkt nie istnieje'; end if;
    select coalesce(sum(quantity_delta), 0) into sys from inventory_movements where product_id = pid;
    insert into inventory_counts (restaurant_id, session_id, product_id, system_qty, counted_qty)
    values (app_restaurant_id(), sid, pid, sys, round(cnt, 3));
    if round(cnt, 3) <> sys then
      insert into inventory_movements (restaurant_id, product_id, type, quantity_delta, note, reference_type, reference_id)
      values (app_restaurant_id(), pid, 'count_correction', round(cnt, 3) - sys, 'Inwentaryzacja', 'count', sid);
    end if;
  end loop;
  return sid;
end $$;

-- ---------- RPC: wygenerowanie dzisiejszych zadań z szablonów (idempotentne) ----------
create or replace function generate_tasks_for(p_restaurant uuid, p_date date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into tasks (restaurant_id, template_id, title, description, due_date, created_by)
  select t.restaurant_id, t.id, t.title, t.description, p_date, t.created_by
    from task_templates t
   where t.restaurant_id = p_restaurant and t.active
     and extract(isodow from p_date)::smallint = any (t.days_of_week)
  on conflict (template_id, due_date) where template_id is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function generate_tasks_for(uuid, date) from public, anon, authenticated; -- tylko service role / cron

-- ---------- realtime ----------
alter publication supabase_realtime add table tasks, shortages, notifications;
