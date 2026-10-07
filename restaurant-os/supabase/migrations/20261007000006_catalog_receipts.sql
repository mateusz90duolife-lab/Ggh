-- 006_catalog_receipts.sql — ikony produktów (szybki wybór z ilustracjami) i skaner paragonów.

-- ---------- ikona produktu (emoji) ----------
alter table products add column icon text check (icon is null or length(icon) between 1 and 16);

-- Stan 'none': produkt bez ustawionego minimum i bez stanu (np. dodany z katalogu, jeszcze niekupowany).
-- Nie jest liczony jako brak na pulpicie. Kolumna icon dopisana na końcu (wymóg CREATE OR REPLACE VIEW).
create or replace view product_stock with (security_invoker = true) as
select p.id as product_id, p.restaurant_id, p.name, p.unit, p.category_id, p.minimum_stock, p.active,
       coalesce(s.stock, 0)::numeric(14,3) as stock,
       case when coalesce(s.stock, 0) <= 0 and p.minimum_stock = 0 then 'none'
            when coalesce(s.stock, 0) <= 0 then 'out'
            when coalesce(s.stock, 0) < p.minimum_stock then 'low'
            else 'ok' end as status,
       p.icon
from products p
left join stock_levels() s on s.product_id = p.id
where p.restaurant_id = app_restaurant_id();

-- ---------- odczytane paragony ----------
-- Wiersz zapisuje WYŁĄCZNIE funkcja Edge scan-receipt (service role) po odczycie zdjęcia;
-- manager może poprawić pozycje, a zapis jako zakup idzie przez create_purchase(p_receipt_id).
create table receipt_scans (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  created_by    uuid not null default auth.uid() references profiles(id),
  store         text check (length(store) <= 120),
  receipt_date  date,
  total         numeric(12,2),
  items         jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  model         text,
  purchase_id   uuid references purchases(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on receipt_scans (restaurant_id, created_at desc);

alter table purchases add constraint purchases_receipt_id_fkey
  foreign key (receipt_id) references receipt_scans(id) on delete set null;

-- ---------- zapamiętane dopasowania: nazwa z paragonu -> produkt ----------
create table product_aliases (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  alias         text not null check (length(alias) between 1 and 120),   -- nazwa znormalizowana (bez ogonków, małe litery)
  product_id    uuid not null references products(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, alias)
);

alter table receipt_scans   enable row level security;
alter table product_aliases enable row level security;

create policy rs_sel on receipt_scans for select using (restaurant_id = app_restaurant_id() and app_is_manager());
create policy rs_upd on receipt_scans for update using (restaurant_id = app_restaurant_id() and app_is_manager())
                                             with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy rs_del on receipt_scans for delete using (restaurant_id = app_restaurant_id() and app_is_owner());
create policy pa_sel on product_aliases for select using (restaurant_id = app_restaurant_id() and app_is_manager());
create policy pa_del on product_aliases for delete using (restaurant_id = app_restaurant_id() and app_is_manager());

create trigger receipt_scans_audit after insert or update or delete on receipt_scans
  for each row execute function audit_trigger();

-- Zapamiętanie dopasowań (upsert). p_pairs: [{"alias": "...", "product_id": "..."}]
create or replace function save_receipt_aliases(p_pairs jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare it jsonb; a text; prod uuid; n int := 0;
begin
  if not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  if p_pairs is null or jsonb_typeof(p_pairs) <> 'array' then raise exception 'Nieprawidłowe dane'; end if;
  if jsonb_array_length(p_pairs) > 300 then raise exception 'Za dużo pozycji'; end if;
  for it in select * from jsonb_array_elements(p_pairs) loop
    a := lower(trim(it->>'alias'));
    prod := (it->>'product_id')::uuid;
    if a is null or length(a) = 0 or length(a) > 120 then continue; end if;
    if not exists (select 1 from products where id = prod and restaurant_id = app_restaurant_id()) then
      raise exception 'Produkt nie istnieje'; end if;
    insert into product_aliases (restaurant_id, alias, product_id)
    values (app_restaurant_id(), a, prod)
    on conflict (restaurant_id, alias) do update set product_id = excluded.product_id, created_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- zakup z paragonu: jedna transakcja = zakup + powiązanie ze skanem ----------
-- create_purchase zostaje bez zmian; ta funkcja blokuje skan (brak podwójnego zapisu), tworzy zakup i łączy oba rekordy.
create or replace function create_purchase_from_receipt(
  p_receipt_id uuid, p_supplier_id uuid, p_purchase_date date, p_document_number text, p_note text,
  p_items jsonb, p_confirm boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not app_is_manager() then raise exception 'Brak uprawnień'; end if;
  perform 1 from receipt_scans where id = p_receipt_id and restaurant_id = app_restaurant_id()
     and purchase_id is null for update;   -- blokada: dwa równoległe zapisy tego samego paragonu
  if not found then raise exception 'Paragon nie istnieje albo został już zapisany jako zakup'; end if;
  pid := create_purchase(p_supplier_id, p_purchase_date, p_document_number, p_note, p_items, false);
  update purchases set receipt_id = p_receipt_id where id = pid;
  update receipt_scans set purchase_id = pid where id = p_receipt_id;
  if p_confirm then perform confirm_purchase(pid); end if;
  return pid;
end $$;

revoke execute on function create_purchase_from_receipt(uuid, uuid, date, text, text, jsonb, boolean),
  save_receipt_aliases(jsonb) from public, anon;
grant execute on function create_purchase_from_receipt(uuid, uuid, date, text, text, jsonb, boolean),
  save_receipt_aliases(jsonb) to authenticated;
