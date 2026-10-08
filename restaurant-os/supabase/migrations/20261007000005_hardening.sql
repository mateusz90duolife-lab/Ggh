-- 005_hardening.sql — wynik doradcy bezpieczeństwa Supabase (database linter).
-- Supabase nadaje roli anon domyślne EXECUTE na nowych funkcjach (domyślne uprawnienia innej roli niż ta,
-- która uruchamia migracje), więc odbieramy je jawnie dla każdej funkcji API.

revoke execute on function app_today(), confirm_purchase(uuid),
  create_purchase(uuid, date, text, text, jsonb, boolean), dashboard_summary(), ensure_today_tasks(),
  request_new_product(text) from public, anon;

-- funkcje wyzwalaczy nie są częścią API (wyzwalacz nie wymaga EXECUTE od użytkownika)
revoke execute on function audit_trigger(), guard_profile_update(), notify_low_stock(), forbid_change()
  from public, anon, authenticated;

-- Stan magazynu: widok działa teraz z uprawnieniami użytkownika (security_invoker), a sumy ruchów liczy
-- funkcja ograniczona do restauracji zalogowanego użytkownika. Pracownik nadal widzi stany, ale nie historię.
create or replace function stock_levels() returns table (product_id uuid, stock numeric)
language sql stable security definer set search_path = public as $$
  select m.product_id, sum(m.quantity_delta)
    from inventory_movements m
   where m.restaurant_id = app_restaurant_id()
   group by m.product_id
$$;
revoke execute on function stock_levels() from public, anon;
grant execute on function stock_levels() to authenticated;

create or replace view product_stock with (security_invoker = true) as
select p.id as product_id, p.restaurant_id, p.name, p.unit, p.category_id, p.minimum_stock, p.active,
       coalesce(s.stock, 0)::numeric(14,3) as stock,
       case when coalesce(s.stock, 0) <= 0 then 'out'
            when coalesce(s.stock, 0) < p.minimum_stock then 'low'
            else 'ok' end as status
from products p
left join stock_levels() s on s.product_id = p.id
where p.restaurant_id = app_restaurant_id();
