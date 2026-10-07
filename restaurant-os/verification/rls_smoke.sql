\set ON_ERROR_STOP on
grant all on all tables in schema public to authenticated;   -- symulacja domyślnych uprawnień Supabase
grant usage on all sequences in schema public to authenticated;

-- dane
insert into restaurants(id,name) values ('00000000-0000-0000-0000-0000000000a1','A'),('00000000-0000-0000-0000-0000000000b1','B');
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003'),('10000000-0000-0000-0000-000000000004');
insert into profiles(id,restaurant_id,full_name,role) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Owner A','owner'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','Manager A','manager'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a1','Pracownik A','employee'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000b1','Pracownik B','employee');
insert into products(id,restaurant_id,name,unit,minimum_stock) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Mleko','l',10),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','Ser','kg',2);

create or replace function t_as(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create or replace function t_ok(c boolean, m text) returns void language plpgsql as $$
begin if not c then raise exception 'FAIL: %', m; end if; raise notice 'ok: %', m; end $$;
create or replace function t_fails(q text, m text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'ok (odrzucone): % [%]', m, left(sqlerrm,60); return; end;
 raise exception 'FAIL (powinno być odrzucone): %', m; end $$;
grant execute on function t_as(text), t_ok(boolean,text), t_fails(text,text) to authenticated, anon;

-- ===== PRACOWNIK A =====
set role authenticated; select t_as('10000000-0000-0000-0000-000000000003');
select report_shortage('20000000-0000-0000-0000-000000000001', 5);
select report_shortage('20000000-0000-0000-0000-000000000001', 3, true);
select report_shortage('20000000-0000-0000-0000-000000000001', 2);
select t_ok((select total_quantity from shopping_list where product_name='Mleko')=10 and (select reports_count from shopping_list where product_name='Mleko')=3 and (select urgent from shopping_list where product_name='Mleko'), 'T3 agregacja 5+3+2 = MLEKO 10 L, 3 zgłoszenia, PILNE');
select t_ok((select count(*) from shopping_list)=1, 'T2 brak jest na liście zakupów');
select t_fails($$select report_shortage('20000000-0000-0000-0000-000000000001', -5)$$, 'ilość ujemna');
select t_fails($$select report_shortage('20000000-0000-0000-0000-000000000001', 0)$$, 'ilość 0');
select t_fails($$select report_shortage('20000000-0000-0000-0000-000000000001', 100001)$$, 'ilość > 100000');
select t_fails($$select report_shortage('20000000-0000-0000-0000-000000000001', -999999)$$, 'ilość -999999');
select t_fails($$select report_shortage('20000000-0000-0000-0000-000000000099', 1)$$, 'nieistniejący produkt');
select report_shortage('20000000-0000-0000-0000-000000000002', 1, false, null, '30000000-0000-0000-0000-000000000001');
select report_shortage('20000000-0000-0000-0000-000000000002', 1, false, null, '30000000-0000-0000-0000-000000000001');
select t_ok((select count(*) from shortages where client_id='30000000-0000-0000-0000-000000000001')=1, 'T18 idempotencja client_id (offline)');
select t_ok((select count(*) from inventory_movements)=0, 'T8 pracownik nie czyta historii ruchów');
select t_ok((select count(*) from product_stock)=2, 'pracownik widzi stany produktów');
select t_fails($$insert into products(name,unit) values ('X','kg')$$, 'pracownik nie dodaje produktów');
select t_fails($$select record_movement('20000000-0000-0000-0000-000000000001','consumption',-1)$$, 'pracownik nie robi ruchów');
select t_fails($$update profiles set role='owner' where id='10000000-0000-0000-0000-000000000003'$$, 'T15 eskalacja roli');
select t_ok((select count(*) from audit_logs)=0, 'pracownik nie czyta audit_logs');
select t_fails($$insert into shortages(product_id,quantity,unit) values ('20000000-0000-0000-0000-000000000001',1,'l')$$, 'bezpośredni INSERT braku zablokowany (tylko RPC)');
reset role;

-- ===== TENANT B =====
set role authenticated; select t_as('10000000-0000-0000-0000-000000000004');
select t_ok((select count(*) from products)=0 and (select count(*) from shortages)=0 and (select count(*) from product_stock)=0, 'T17 izolacja tenantów');
select t_fails($$select report_shortage('20000000-0000-0000-0000-000000000001', 1)$$, 'produkt z cudzej restauracji');
reset role;

-- ===== ANON =====
set role anon; select set_config('request.jwt.claim.sub','',false);
select t_fails($$select * from products$$, 'T16 anon: products');
select t_fails($$select * from product_stock$$, 'T16 anon: widok');
select t_fails($$select report_shortage('20000000-0000-0000-0000-000000000001', 1)$$, 'T16 anon: RPC');
reset role;

-- ===== MANAGER =====
set role authenticated; select t_as('10000000-0000-0000-0000-000000000002');
select record_movement('20000000-0000-0000-0000-000000000001','adjustment',12,'stan początkowy');
select t_ok((select stock from product_stock where name='Mleko')=12, 'stan = suma ruchów (12)');
select record_movement('20000000-0000-0000-0000-000000000001','consumption',-5);
select t_ok((select stock from product_stock where name='Mleko')=7, 'T6 zużycie zmniejsza stan');
select t_ok((select count(*) from notifications where type='low_stock')=1, 'T7 jedno powiadomienie po przekroczeniu minimum');
select record_movement('20000000-0000-0000-0000-000000000001','consumption',-1);
select t_ok((select count(*) from notifications where type='low_stock')=1, 'T7 brak duplikatu powiadomienia');
select t_fails($$select record_movement('20000000-0000-0000-0000-000000000001','purchase',-3)$$, 'zakup z ujemną ilością');
select t_fails($$select record_movement('20000000-0000-0000-0000-000000000001','consumption',3)$$, 'zużycie z dodatnią ilością');
select t_fails($$select record_movement('20000000-0000-0000-0000-000000000001','adjustment',0)$$, 'korekta 0');
do $$ declare n int; begin update inventory_movements set quantity_delta=999; get diagnostics n=row_count; perform t_ok(n=0,'manager: UPDATE ruchów zmienia 0 wierszy (brak policy)'); end $$;
-- zakup
select t_ok(true,'zakup: start');
do $$ declare pid uuid; begin
  insert into suppliers(name) values ('Hurtownia X');
  insert into purchases(supplier_id, document_number) select id,'FV/1' from suppliers returning id into pid;
  insert into purchase_items(purchase_id, product_id, quantity, unit_price_net) values (pid,'20000000-0000-0000-0000-000000000001',20,5.40);
  perform confirm_purchase(pid);
  perform t_ok((select stock from product_stock where name='Mleko')=26, 'T5 zakup +20 L => 6+20 = 26');
  perform t_ok((select count(*) from shortages where status='open' and product_id='20000000-0000-0000-0000-000000000001')=0, 'T5 braki mleka zamknięte');
  perform t_ok((select last_price from price_trend where product_id='20000000-0000-0000-0000-000000000001')=5.40, 'historia cen zapisana');
  perform t_ok((select count(*) from shopping_list)=1, 'lista zakupów: został tylko ser');
  begin perform confirm_purchase(pid); raise exception 'FAIL: podwójne zatwierdzenie przeszło'; exception when others then
    if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok (odrzucone): podwójny confirm_purchase [%]', sqlerrm; end;
  perform t_ok((select count(*) from inventory_movements where type='purchase')=1, 'brak zduplikowanego ruchu zakupu');
end $$;
-- inwentaryzacja
select submit_inventory_count('[{"product_id":"20000000-0000-0000-0000-000000000001","counted_qty":24}]'::jsonb);
select t_ok((select stock from product_stock where name='Mleko')=24, 'inwentaryzacja koryguje stan do 24 (−2)');
select t_ok((select difference from inventory_counts)=-2, 'różnica inwentaryzacji = −2');
select t_fails($$select submit_inventory_count('[{"product_id":"20000000-0000-0000-0000-000000000001","counted_qty":-1}]'::jsonb)$$, 'inwentaryzacja ujemna');
-- zadania
select t_fails($$insert into task_templates(title, days_of_week) values ('X','{1}')$$, 'manager nie tworzy szablonów (tylko owner)');
select t_as('10000000-0000-0000-0000-000000000001');
insert into task_templates(title, days_of_week) values ('Sprzątanie chłodni','{1,3,5}');
select t_fails($$insert into task_templates(title, days_of_week) values ('Y','{8}')$$, 'zły dzień tygodnia');
reset role;
select generate_tasks_for('00000000-0000-0000-0000-0000000000a1','2026-10-07'); -- środa (3)
select generate_tasks_for('00000000-0000-0000-0000-0000000000a1','2026-10-07'); -- powtórka
select generate_tasks_for('00000000-0000-0000-0000-0000000000a1','2026-10-08'); -- czwartek (4)
select t_ok((select count(*) from tasks where due_date='2026-10-07')=1 and (select count(*) from tasks where due_date='2026-10-08')=0, 'T19 generowanie idempotentne + dni tygodnia');
set role authenticated; select t_as('10000000-0000-0000-0000-000000000003');
select t_fails($$select generate_tasks_for('00000000-0000-0000-0000-0000000000a1','2026-10-09')$$, 'pracownik nie wywoła generate_tasks_for');
select complete_task((select id from tasks limit 1));
select t_ok((select done_by from tasks limit 1)='10000000-0000-0000-0000-000000000003' and (select status from tasks limit 1)='done', 'zadanie odhaczone przez pracownika');
select t_ok((select count(*) from task_templates)=0, 'pracownik nie widzi szablonów');
reset role;
-- niezmienność jako superuser (trigger)
select t_fails($$update inventory_movements set quantity_delta=1$$, 'T13 trigger: UPDATE ruchów');
select t_fails($$delete from inventory_movements$$, 'T13 trigger: DELETE ruchów');
-- audyt
select t_ok((select count(*) from audit_logs where table_name='inventory_movements' and actor_id='10000000-0000-0000-0000-000000000002')>0, 'T12 audyt zapisuje autora (manager)');
select t_ok((select count(*) from audit_logs where table_name='shortages' and actor_id='10000000-0000-0000-0000-000000000003')>0, 'T12 audyt zapisuje autora (pracownik)');
set role authenticated; select t_as('10000000-0000-0000-0000-000000000001');
select t_ok((select count(*) from audit_logs)>0, 'owner czyta audit_logs');
reset role;
\echo ALL TESTS PASSED
