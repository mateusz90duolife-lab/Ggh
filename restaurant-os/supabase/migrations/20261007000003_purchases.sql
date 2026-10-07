-- 003_purchases.sql
create type purchase_status as enum ('draft', 'confirmed', 'cancelled');

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  name text not null check (length(trim(name)) between 1 and 120),
  tax_id text, phone text, email text, active boolean not null default true,
  unique (restaurant_id, name)
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  supplier_id uuid references suppliers(id),
  purchase_date date not null default current_date,
  document_number text,
  status purchase_status not null default 'draft',
  note text check (length(note) <= 500),
  receipt_id uuid,                                   -- FK dodany w migracji OCR
  created_by uuid not null default auth.uid() references profiles(id),
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0 and quantity <= 100000),
  unit_price_net numeric(12,4) not null check (unit_price_net >= 0 and unit_price_net <= 100000),
  vat_rate numeric(5,2) not null default 0 check (vat_rate between 0 and 100)
);
create index on purchase_items (purchase_id);

create table price_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  product_id uuid not null references products(id) on delete restrict,
  supplier_id uuid references suppliers(id),
  unit_price_net numeric(12,4) not null check (unit_price_net >= 0),
  purchase_item_id uuid unique references purchase_items(id) on delete set null,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index on price_history (product_id, recorded_at desc, created_at desc);

create view price_trend with (security_invoker = true) as
with ranked as (
  select *, row_number() over (partition by product_id order by recorded_at desc, created_at desc) rn
  from price_history)
select r1.restaurant_id, r1.product_id, r1.unit_price_net as last_price, r1.recorded_at as last_date,
       r2.unit_price_net as previous_price,
       case when r2.unit_price_net > 0
            then round((r1.unit_price_net - r2.unit_price_net) / r2.unit_price_net * 100, 1) end as change_pct
from ranked r1 left join ranked r2 on r2.product_id = r1.product_id and r2.rn = 2
where r1.rn = 1;

-- Zatwierdzenie zakupu: JEDNA transakcja = ruchy magazynowe + historia cen + zamknięcie braków
create or replace function confirm_purchase(p_purchase_id uuid) returns purchases
language plpgsql security definer set search_path = public as $$
declare pu purchases%rowtype; it record;
begin
  if not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  select * into pu from purchases where id = p_purchase_id and restaurant_id = app_restaurant_id() for update;
  if not found then raise exception 'Zakup nie istnieje'; end if;
  if pu.status <> 'draft' then raise exception 'Zakup został już przetworzony'; end if;     -- idempotencja
  if not exists (select 1 from purchase_items where purchase_id = pu.id) then
    raise exception 'Zakup nie ma pozycji'; end if;

  for it in select * from purchase_items where purchase_id = pu.id loop
    insert into inventory_movements (restaurant_id, product_id, type, quantity_delta, note, reference_type, reference_id)
    values (pu.restaurant_id, it.product_id, 'purchase', it.quantity, 'Zakup ' || coalesce(pu.document_number, ''), 'purchase', pu.id);
    insert into price_history (restaurant_id, product_id, supplier_id, unit_price_net, purchase_item_id, recorded_at)
    values (pu.restaurant_id, it.product_id, pu.supplier_id, it.unit_price_net, it.id, pu.purchase_date);
    update shortages set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
     where product_id = it.product_id and status = 'open' and restaurant_id = pu.restaurant_id;
  end loop;

  update purchases set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
   where id = pu.id returning * into pu;
  return pu;
end $$;

alter table suppliers      enable row level security;
alter table purchases      enable row level security;
alter table purchase_items enable row level security;
alter table price_history  enable row level security;

create policy sup_all on suppliers for all using (restaurant_id = app_restaurant_id() and app_is_manager())
                                         with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy pur_sel on purchases for select using (restaurant_id = app_restaurant_id() and app_is_manager());
create policy pur_ins on purchases for insert with check (restaurant_id = app_restaurant_id() and app_is_manager() and status = 'draft');
create policy pur_upd on purchases for update using (restaurant_id = app_restaurant_id() and app_is_manager() and status = 'draft')
                                              with check (status in ('draft', 'cancelled'));   -- 'confirmed' tylko przez RPC
create policy pi_all on purchase_items for all
  using (exists (select 1 from purchases p where p.id = purchase_id and p.restaurant_id = app_restaurant_id()
                 and app_is_manager() and p.status = 'draft'))
  with check (exists (select 1 from purchases p where p.id = purchase_id and p.restaurant_id = app_restaurant_id()
                 and app_is_manager() and p.status = 'draft'));
create policy pi_sel on purchase_items for select
  using (exists (select 1 from purchases p where p.id = purchase_id and p.restaurant_id = app_restaurant_id() and app_is_manager()));
create policy ph_sel on price_history for select using (restaurant_id = app_restaurant_id() and app_is_manager());
-- price_history: brak INSERT/UPDATE/DELETE dla klientów (zapis tylko w confirm_purchase)

grant execute on function confirm_purchase(uuid) to authenticated;
grant select on price_trend to authenticated;

create trigger purchases_audit      after insert or update or delete on purchases      for each row execute function audit_trigger();
create trigger purchase_items_audit after insert or update or delete on purchase_items for each row execute function audit_trigger();
create trigger suppliers_audit      after insert or update or delete on suppliers      for each row execute function audit_trigger();
