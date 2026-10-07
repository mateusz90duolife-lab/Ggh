-- 004_app.sql — funkcje i widoki potrzebne aplikacji (FAZA 1–2)

-- ---------- audyt: restaurant_id także dla tabel bez tej kolumny (purchase_items) ----------
create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb := to_jsonb(coalesce(new, old)); rid uuid;
begin
  rid := (rec->>'restaurant_id')::uuid;
  if rid is null and rec ? 'purchase_id' then
    select restaurant_id into rid from purchases where id = (rec->>'purchase_id')::uuid;
  end if;
  insert into audit_logs (restaurant_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (rid, auth.uid(), tg_op, tg_table_name, (rec->>'id')::uuid,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ---------- email_log: stan „sending” + znacznik przejęcia (retry po awarii) ----------
alter table email_log drop constraint email_log_status_check;
alter table email_log add constraint email_log_status_check check (status in ('sending', 'sent', 'failed', 'skipped'));
alter table email_log add column claimed_at timestamptz not null default now();

-- ---------- dzisiejsza data w strefie lokalu ----------
create or replace function app_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone r.timezone)::date from restaurants r where r.id = app_restaurant_id()
$$;

-- zabezpieczenie dla crona: dzisiejsze zadania z szablonów (idempotentne), dostępne dla każdego zalogowanego
create or replace function ensure_today_tasks() returns int
language plpgsql security definer set search_path = public as $$
declare rid uuid := app_restaurant_id();
begin
  if rid is null then raise exception 'Brak uprawnień'; end if;
  return generate_tasks_for(rid, app_today());
end $$;

-- ---------- dashboard (manager+; kwota zakupów tylko dla właściciela) ----------
create or replace function dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare rid uuid := app_restaurant_id(); d date := app_today(); res jsonb;
begin
  if not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  select jsonb_build_object(
    'today', d,
    'low_stock',      (select count(*) from product_stock where active and status = 'low'),
    'out_of_stock',   (select count(*) from product_stock where active and status = 'out'),
    'shopping_items', (select count(distinct product_id) from shortages where restaurant_id = rid and status = 'open'),
    'urgent_items',   (select count(distinct product_id) from shortages where restaurant_id = rid and status = 'open' and urgent),
    'tasks_total',    (select count(*) from tasks where restaurant_id = rid and due_date = d),
    'tasks_done',     (select count(*) from tasks where restaurant_id = rid and due_date = d and status = 'done'),
    'unread_notifications', (select count(*) from notifications where restaurant_id = rid and read_at is null),
    'purchases_today_gross', case when app_is_owner() then (
        select coalesce(sum(i.quantity * i.unit_price_net * (1 + i.vat_rate / 100)), 0)::numeric(14,2)
          from purchases p join purchase_items i on i.purchase_id = p.id
         where p.restaurant_id = rid and p.status = 'confirmed' and p.purchase_date = d) end
  ) into res;
  return res;
end $$;

-- ---------- „Nie ma na liście?”: pracownik prosi o dodanie produktu → zadanie dla managera ----------
create or replace function request_new_product(p_name text) returns tasks
language plpgsql security definer set search_path = public as $$
declare rid uuid := app_restaurant_id(); nm text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
        t text; row tasks; who text;
begin
  if rid is null then raise exception 'Brak uprawnień'; end if;
  if length(nm) < 1 or length(nm) > 80 then raise exception 'Nazwa produktu: od 1 do 80 znaków'; end if;
  t := 'Dodać produkt: ' || nm;
  select * into row from tasks
   where restaurant_id = rid and title = t and status = 'todo' and due_date >= app_today() - 7 limit 1;
  if found then return row; end if;                         -- nie mnożymy identycznych próśb
  select full_name into who from profiles where id = auth.uid();
  insert into tasks (restaurant_id, title, description, due_date)
  values (rid, t, 'Zgłosił(a): ' || coalesce(who, 'pracownik'), app_today())
  returning * into row;
  return row;
end $$;

-- ---------- zakup atomowo: szkic + pozycje (+ zatwierdzenie) ----------
-- p_items: [{"product_id":"…","quantity":20,"unit_price_net":5.4,"vat_rate":5}, …]
create or replace function create_purchase(
  p_supplier_id uuid, p_purchase_date date, p_document_number text, p_note text,
  p_items jsonb, p_confirm boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; it jsonb; prod uuid;
begin
  if not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  if p_supplier_id is not null and not exists
     (select 1 from suppliers where id = p_supplier_id and restaurant_id = app_restaurant_id()) then
    raise exception 'Dostawca nie istnieje'; end if;
  if p_purchase_date is null or p_purchase_date > current_date + 1 then
    raise exception 'Nieprawidłowa data zakupu'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Dodaj co najmniej jedną pozycję'; end if;

  insert into purchases (restaurant_id, supplier_id, purchase_date, document_number, note)
  values (app_restaurant_id(), p_supplier_id, p_purchase_date, nullif(trim(p_document_number), ''), nullif(trim(p_note), ''))
  returning id into pid;

  for it in select * from jsonb_array_elements(p_items) loop
    prod := (it->>'product_id')::uuid;
    if not exists (select 1 from products where id = prod and restaurant_id = app_restaurant_id() and active) then
      raise exception 'Produkt nie istnieje lub jest nieaktywny'; end if;
    insert into purchase_items (purchase_id, product_id, quantity, unit_price_net, vat_rate)
    values (pid, prod, round((it->>'quantity')::numeric, 3), round((it->>'unit_price_net')::numeric, 4),
            coalesce((it->>'vat_rate')::numeric, 0));
  end loop;

  if p_confirm then perform confirm_purchase(pid); end if;
  return pid;
end $$;

-- ---------- widok zakupów z sumami ----------
create view purchases_overview with (security_invoker = true) as
select p.id, p.restaurant_id, p.purchase_date, p.document_number, p.status, p.supplier_id,
       s.name as supplier_name, p.created_at, p.confirmed_at,
       count(i.id)::int as items_count,
       coalesce(sum(i.quantity * i.unit_price_net), 0)::numeric(14,2) as total_net,
       coalesce(sum(i.quantity * i.unit_price_net * (1 + i.vat_rate / 100)), 0)::numeric(14,2) as total_gross
from purchases p
left join suppliers s on s.id = p.supplier_id
left join purchase_items i on i.purchase_id = p.id
group by p.id, s.name;

grant select on purchases_overview to authenticated;
grant execute on function app_today(), ensure_today_tasks(), dashboard_summary(),
  create_purchase(uuid, date, text, text, jsonb, boolean), request_new_product(text) to authenticated;
