\set ON_ERROR_STOP on
-- Wymaga wcześniejszego uruchomienia 10_rls_smoke.sql (dane: restauracje A/B, użytkownicy, produkty).
-- Testuje funkcje z migracji 004: dashboard_summary, create_purchase, ensure_today_tasks, widok purchases_overview.

-- właściciel A: kwota zakupów widoczna; manager: kwota ukryta; pracownik: brak dostępu
set role authenticated; select t_as('10000000-0000-0000-0000-000000000001');
select t_ok((dashboard_summary()->>'low_stock') is not null, 'dashboard: owner dostaje podsumowanie');
select t_ok((dashboard_summary()->'purchases_today_gross') is not null, 'dashboard: owner widzi klucz kwoty zakupów');

select t_as('10000000-0000-0000-0000-000000000002');
select t_ok((dashboard_summary()->'purchases_today_gross') = 'null'::jsonb, 'dashboard: manager NIE widzi kwoty zakupów');

-- create_purchase: atomowo, walidacje
do $$ declare pid uuid; st_before numeric; st_after numeric; d jsonb; begin
  select stock into st_before from product_stock where name = 'Ser';
  pid := create_purchase(null, current_date, 'FV/2', null,
          '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":5,"unit_price_net":30,"vat_rate":5}]'::jsonb, true);
  select stock into st_after from product_stock where name = 'Ser';
  perform t_ok(st_after - st_before = 5, 'create_purchase: potwierdzony zakup zwiększa stan o 5 kg');
  perform t_ok((select total_gross from purchases_overview where id = pid) = 157.50, 'purchases_overview: brutto = 5*30*1.05 = 157,50');
  perform t_ok((select status from purchases_overview where id = pid) = 'confirmed', 'create_purchase: status confirmed');
  perform t_ok((select count(*) from shopping_list where product_name = 'Ser') = 0, 'create_purchase: brak sera zamknięty');
end $$;
select t_fails($$select create_purchase(null, current_date, null, null, '[]'::jsonb, true)$$, 'create_purchase: pusta lista pozycji');
select t_fails($$select create_purchase(null, current_date, null, null, '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":-1,"unit_price_net":3}]'::jsonb, true)$$, 'create_purchase: ujemna ilość');
select t_fails($$select create_purchase(null, current_date + 30, null, null, '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":1,"unit_price_net":3}]'::jsonb, true)$$, 'create_purchase: data z odległej przyszłości');
select t_fails($$select create_purchase(null, current_date, null, null, '[{"product_id":"20000000-0000-0000-0000-000000000099","quantity":1,"unit_price_net":3}]'::jsonb, true)$$, 'create_purchase: nieistniejący produkt');
select t_ok((select count(*) from purchases) = 2, 'create_purchase: nieudane próby nie zostawiają szkiców (rollback)');
-- szkic bez zatwierdzenia nie zmienia stanu
do $$ declare pid uuid; a numeric; b numeric; begin
  select stock into a from product_stock where name = 'Ser';
  pid := create_purchase(null, current_date, 'SZKIC', null,
          '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":1,"unit_price_net":30}]'::jsonb, false);
  select stock into b from product_stock where name = 'Ser';
  perform t_ok(a = b and (select status from purchases where id = pid) = 'draft', 'create_purchase(confirm=false): szkic nie rusza magazynu');
end $$;
-- audyt pozycji zakupu ma restaurant_id
reset role;
select t_ok((select count(*) from audit_logs where table_name = 'purchase_items' and restaurant_id is null) = 0, 'audyt purchase_items zapisuje restaurant_id');

-- pracownik: brak dashboardu i zakupów, ale ensure_today_tasks działa
set role authenticated; select t_as('10000000-0000-0000-0000-000000000003');
select t_fails($$select dashboard_summary()$$, 'dashboard: pracownik odrzucony');
select t_fails($$select create_purchase(null, current_date, null, null, '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":1,"unit_price_net":3}]'::jsonb, true)$$, 'create_purchase: pracownik odrzucony');
select t_ok((select count(*) from purchases_overview) = 0, 'pracownik nie widzi zakupów');
select ensure_today_tasks();
select t_ok(app_today() is not null, 'app_today zwraca datę lokalu');
select request_new_product('  Szafran   górski ');
select request_new_product('Szafran górski');
select t_ok((select count(*) from tasks where title = 'Dodać produkt: Szafran górski') = 1, 'request_new_product: prośba tworzy jedno zadanie (bez duplikatów)');
select t_fails($$select request_new_product('   ')$$, 'request_new_product: pusta nazwa');
select t_fails($$select request_new_product(repeat('x', 81))$$, 'request_new_product: zbyt długa nazwa');
reset role;

-- tenant B nie widzi niczego z A
set role authenticated; select t_as('10000000-0000-0000-0000-000000000004');
select t_ok((select count(*) from purchases_overview) = 0 and (select count(*) from tasks) = 0, 'tenant B: izolacja zakupów i zadań');
reset role;
\echo APP FUNCTIONS TESTS PASSED
