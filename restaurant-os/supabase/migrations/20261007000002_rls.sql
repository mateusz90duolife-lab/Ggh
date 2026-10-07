-- 002_rls.sql
do $$ declare t text; begin
  foreach t in array array['restaurants','profiles','product_categories','products','inventory_movements',
    'inventory_counts','shortages','task_templates','tasks','notifications','audit_logs','email_log']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;

-- anon nie ma dostępu do niczego. UWAGA: funkcje domyślnie mają EXECUTE dla PUBLIC (dziedziczy je anon),
-- więc odbieramy je także od PUBLIC i nadajemy jawnie tylko roli authenticated.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke all on tables from anon;                    -- obejmuje przyszłe migracje
alter default privileges in schema public revoke execute on functions from public, anon;
grant execute on function app_restaurant_id(), app_role(), app_is_manager(), app_is_owner() to authenticated;

-- restaurants: widzi swoją; edytuje tylko owner
create policy rest_sel on restaurants for select using (id = app_restaurant_id());
create policy rest_upd on restaurants for update using (id = app_restaurant_id() and app_is_owner())
                                                with check (id = app_restaurant_id() and app_is_owner());

-- profiles: wszyscy w lokalu widzą imiona/role; sam edytujesz własne imię; owner zarządza wszystkimi
-- (tworzenie/usuwanie kont wyłącznie przez Edge Function `admin-users` z service role)
create policy prof_sel on profiles for select using (restaurant_id = app_restaurant_id());
create policy prof_upd_self on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy prof_upd_owner on profiles for update using (restaurant_id = app_restaurant_id() and app_is_owner())
                                                   with check (restaurant_id = app_restaurant_id() and app_is_owner());

-- katalog: wszyscy czytają; manager+ dodaje/edytuje; usuwa tylko owner (i tak blokuje FK gdy są ruchy)
create policy cat_sel on product_categories for select using (restaurant_id = app_restaurant_id());
create policy cat_ins on product_categories for insert with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy cat_upd on product_categories for update using (restaurant_id = app_restaurant_id() and app_is_manager())
                                                    with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy cat_del on product_categories for delete using (restaurant_id = app_restaurant_id() and app_is_owner());

create policy prod_sel on products for select using (restaurant_id = app_restaurant_id());
create policy prod_ins on products for insert with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy prod_upd on products for update using (restaurant_id = app_restaurant_id() and app_is_manager())
                                              with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy prod_del on products for delete using (restaurant_id = app_restaurant_id() and app_is_owner());

-- ruchy i inwentaryzacje: tylko manager+ czyta; zapis WYŁĄCZNIE przez RPC (brak policy INSERT)
create policy mov_sel on inventory_movements for select using (restaurant_id = app_restaurant_id() and app_is_manager());
create policy cnt_sel on inventory_counts    for select using (restaurant_id = app_restaurant_id() and app_is_manager());

-- braki: wszyscy czytają otwarte/swoje; zapis przez RPC; manager+ zmienia status
create policy sh_sel on shortages for select using (restaurant_id = app_restaurant_id());
create policy sh_upd on shortages for update using (restaurant_id = app_restaurant_id() and app_is_manager())
                                            with check (restaurant_id = app_restaurant_id() and app_is_manager());

-- zadania: wszyscy czytają; manager+ zarządza; pracownik odhacza przez RPC complete_task
create policy tt_sel on task_templates for select using (restaurant_id = app_restaurant_id() and app_is_manager());
create policy tt_all on task_templates for all using (restaurant_id = app_restaurant_id() and app_is_owner())
                                           with check (restaurant_id = app_restaurant_id() and app_is_owner());
create policy tk_sel on tasks for select using (restaurant_id = app_restaurant_id());
create policy tk_ins on tasks for insert with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy tk_upd on tasks for update using (restaurant_id = app_restaurant_id() and app_is_manager())
                                        with check (restaurant_id = app_restaurant_id() and app_is_manager());
create policy tk_del on tasks for delete using (restaurant_id = app_restaurant_id() and app_is_manager());

-- powiadomienia: manager+
create policy nt_sel on notifications for select using (restaurant_id = app_restaurant_id() and app_is_manager());
create policy nt_upd on notifications for update using (restaurant_id = app_restaurant_id() and app_is_manager());

-- audyt i log maili: tylko owner czyta; nikt nie zapisuje ręcznie (triggery / service role)
create policy aud_sel on audit_logs for select using (restaurant_id = app_restaurant_id() and app_is_owner());
create policy eml_sel on email_log  for select using (restaurant_id = app_restaurant_id() and app_is_owner());

grant select on product_stock, shopping_list to authenticated;
grant execute on function report_shortage(uuid, numeric, boolean, text, uuid),
                          complete_task(uuid, boolean),
                          record_movement(uuid, movement_type, numeric, text),
                          submit_inventory_count(jsonb) to authenticated;
