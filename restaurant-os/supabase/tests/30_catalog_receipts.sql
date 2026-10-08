\set ON_ERROR_STOP on
-- Wymaga 10_rls_smoke.sql i 20_app_functions.sql. Testuje migrację 006: ikony, status 'none', paragony, aliasy.
grant all on receipt_scans, product_aliases to authenticated;

-- status 'none': produkt bez minimum i bez stanu nie jest brakiem; ikona widoczna w widoku stanów
set role authenticated; select t_as('10000000-0000-0000-0000-000000000002');
insert into products(name, unit, icon) values ('Papryka czerwona', 'kg', '🫑');
select t_ok((select status from product_stock where name = 'Papryka czerwona') = 'none', 'produkt bez minimum i stanu ma status none');
select t_ok((select icon from product_stock where name = 'Papryka czerwona') = '🫑', 'product_stock zwraca ikonę');
select t_fails($$insert into products(name, unit, icon) values ('Za długa ikona', 'kg', repeat('x', 17))$$, 'ikona dłuższa niż 16 znaków');
select t_ok((dashboard_summary()->>'out_of_stock')::int = (select count(*) from product_stock where active and status = 'out'), 'pulpit nie liczy statusu none jako braku');

-- paragony: klient nie wstawia skanu sam (tylko funkcja Edge z service role)
select t_fails($$insert into receipt_scans(items) values ('[]')$$, 'manager nie wstawia skanu bezpośrednio');
reset role;
insert into receipt_scans(id, restaurant_id, created_by, store, receipt_date, total, items) values
 ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000002',
  'Makro', current_date, 24.60, '[{"name":"MLEKO 3,2% 1L","quantity":2,"unit":"l","unit_price":4.10,"total":8.20}]'),
 ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000004',
  'Lidl', current_date, 5, '[]');

set role authenticated; select t_as('10000000-0000-0000-0000-000000000002');
select t_ok((select count(*) from receipt_scans) = 1, 'manager A widzi tylko paragony swojego lokalu');
update receipt_scans set items = '[{"name":"MLEKO","quantity":3}]' where id = '40000000-0000-0000-0000-000000000001';
select t_ok((select items->0->>'quantity' from receipt_scans where id = '40000000-0000-0000-0000-000000000001') = '3', 'manager poprawia pozycje paragonu');
select t_fails($$select create_purchase_from_receipt('40000000-0000-0000-0000-000000000002', null, current_date, null, null, '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1,"unit_price_net":3}]'::jsonb, true)$$, 'zakup z paragonu: paragon innego lokalu odrzucony');
do $$ declare pid uuid; a numeric; b numeric; begin
  select stock into a from product_stock where name = 'Mleko';
  pid := create_purchase_from_receipt('40000000-0000-0000-0000-000000000001', null, current_date, 'Paragon Makro', null,
          '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":2,"unit_price_net":3.80,"vat_rate":5}]'::jsonb, true);
  select stock into b from product_stock where name = 'Mleko';
  perform t_ok(b - a = 2, 'zakup z paragonu zwiększa stan');
  perform t_ok((select purchase_id from receipt_scans where id = '40000000-0000-0000-0000-000000000001') = pid
           and (select receipt_id from purchases where id = pid) = '40000000-0000-0000-0000-000000000001', 'paragon i zakup są powiązane w obie strony');
end $$;
select t_fails($$select create_purchase_from_receipt('40000000-0000-0000-0000-000000000001', null, current_date, null, null, '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1,"unit_price_net":3}]'::jsonb, true)$$, 'paragonu nie można zapisać drugi raz');
select t_fails($$select create_purchase_from_receipt(null, null, current_date, null, null, '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1,"unit_price_net":3}]'::jsonb, true)$$, 'zakup z paragonu wymaga paragonu');

-- aliasy
-- pracownik nie zapisze zakupu z paragonu
select t_as('10000000-0000-0000-0000-000000000003');
select t_fails($$select create_purchase_from_receipt('40000000-0000-0000-0000-000000000001', null, current_date, null, null, '[]'::jsonb, true)$$, 'pracownik nie zapisuje zakupu z paragonu');
select t_as('10000000-0000-0000-0000-000000000002');
select t_ok(save_receipt_aliases('[{"alias":"  MLEKO 3,2% 1L ","product_id":"20000000-0000-0000-0000-000000000001"}]') = 1, 'save_receipt_aliases zapisuje alias');
select save_receipt_aliases('[{"alias":"mleko 3,2% 1l","product_id":"20000000-0000-0000-0000-000000000002"}]');
select t_ok((select count(*) from product_aliases) = 1 and (select product_id from product_aliases) = '20000000-0000-0000-0000-000000000002', 'alias jest nadpisywany (upsert), znormalizowany');
select t_fails($$select save_receipt_aliases('[{"alias":"x","product_id":"20000000-0000-0000-0000-000000000099"}]')$$, 'alias do nieistniejącego produktu');
select t_fails($$insert into product_aliases(alias, product_id) values ('y', '20000000-0000-0000-0000-000000000001')$$, 'bezpośredni INSERT aliasu zablokowany (tylko RPC)');

-- pracownik: brak dostępu do paragonów i aliasów
select t_as('10000000-0000-0000-0000-000000000003');
select t_ok((select count(*) from receipt_scans) = 0 and (select count(*) from product_aliases) = 0, 'pracownik nie widzi paragonów ani aliasów');
select t_fails($$select save_receipt_aliases('[]')$$, 'pracownik nie zapisuje aliasów');
reset role;
select t_ok(not has_function_privilege('anon', 'save_receipt_aliases(jsonb)', 'execute')
        and not has_function_privilege('anon', 'create_purchase_from_receipt(uuid,uuid,date,text,text,jsonb,boolean)', 'execute'), 'anon nie wykona nowych funkcji');
select t_ok((select count(*) from audit_logs where table_name = 'receipt_scans') >= 2, 'audyt paragonów');
\echo CATALOG RECEIPTS TESTS PASSED
