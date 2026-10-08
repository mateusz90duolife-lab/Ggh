\set ON_ERROR_STOP on
-- Wymaga 10–30. Testuje migrację 007: nick/PIN w profilu, zmiany stanu przez pracownika, godziny pracy.
grant all on work_shifts to authenticated;
reset role; select t_as('');

-- nick: format, unikalność; pracownik nie zmieni sobie nicka ani licznika PIN
update profiles set nick = 'ewa', pin_failed = 3, pin_locked_until = now() + interval '1 hour' where id = '10000000-0000-0000-0000-000000000003';
select t_fails($$update profiles set nick = 'ewa' where id = '10000000-0000-0000-0000-000000000004'$$, 'nick jest unikalny');
select t_fails($$update profiles set nick = 'Zły Nick!' where id = '10000000-0000-0000-0000-000000000004'$$, 'nick: tylko małe litery, cyfry, . _ -');
set role authenticated; select t_as('10000000-0000-0000-0000-000000000003');
select t_fails($$update profiles set nick = 'ewka' where id = '10000000-0000-0000-0000-000000000003'$$, 'pracownik nie zmienia swojego nicka');
select t_fails($$update profiles set pin_failed = 0, pin_locked_until = null where id = '10000000-0000-0000-0000-000000000003'$$, 'pracownik nie zdejmuje sobie blokady PIN');
update profiles set full_name = 'Ewa Pracownik' where id = '10000000-0000-0000-0000-000000000003';
reset role; select t_as('');
update profiles set pin_failed = 0, pin_locked_until = null where id = '10000000-0000-0000-0000-000000000003';
set role authenticated; select t_as('10000000-0000-0000-0000-000000000003');
select t_ok(true, 'pracownik nadal może zmienić swoje imię');

-- pracownik dodaje i odejmuje stan pod swoim nazwiskiem
do $$ declare a numeric; b numeric; begin
  select stock into a from product_stock where name = 'Ser';
  perform staff_stock_change('20000000-0000-0000-0000-000000000002', 3, null);
  perform staff_stock_change('20000000-0000-0000-0000-000000000002', -1.5, 'na pizzę');
  select stock into b from product_stock where name = 'Ser';
  perform t_ok(b - a = 1.5, 'pracownik: +3 i -1,5 kg sera');
  perform t_ok((select count(*) from inventory_movements where created_by = '10000000-0000-0000-0000-000000000003' and reference_type = 'staff') = 2, 'pracownik widzi własne ruchy');
  perform t_ok((select count(*) from inventory_movements where created_by <> '10000000-0000-0000-0000-000000000003') = 0, 'pracownik nie widzi cudzych ruchów');
  perform t_ok((select note from inventory_movements where quantity_delta = -1.5 and reference_type = 'staff') = 'na pizzę', 'uwaga zapisana');
end $$;
select t_fails($$select staff_stock_change('20000000-0000-0000-0000-000000000002', -100000, null)$$, 'stan nie może spaść poniżej zera');
select t_fails($$select staff_stock_change('20000000-0000-0000-0000-000000000002', 0, null)$$, 'ilość 0 odrzucona');
select t_fails($$select staff_stock_change('20000000-0000-0000-0000-000000000099', 1, null)$$, 'nieistniejący produkt');

-- godziny pracy: start/stop, ręczny wpis, nakładanie, usuwanie
select clock_in();
select t_fails($$select clock_in()$$, 'nie można zacząć pracy dwa razy');
select clock_out();
select t_fails($$select clock_out()$$, 'nie można skończyć niezaczętej pracy');
select t_ok((select count(*) from work_shifts where profile_id = '10000000-0000-0000-0000-000000000003' and ended_at is not null) = 1, 'zmiana zapisana');
select add_shift(date_trunc('day', now()) - interval '1 day' + interval '8 hours', date_trunc('day', now()) - interval '1 day' + interval '16 hours', 'zmiana poranna');
select t_ok((select round(extract(epoch from sum(ended_at - started_at)) / 3600) from work_shifts where source = 'manual') = 8, 'ręczny wpis: 8 godzin');
select t_fails($$select add_shift(date_trunc('day', now()) - interval '1 day' + interval '15 hours', date_trunc('day', now()) - interval '1 day' + interval '18 hours')$$, 'nakładające się godziny odrzucone');
select t_fails($$select add_shift(now() - interval '2 hours', now() - interval '3 hours')$$, 'koniec przed początkiem');
select t_fails($$select add_shift(now() - interval '20 hours', now())$$, 'zmiana dłuższa niż 16 h');
select t_fails($$select add_shift(now() + interval '1 hour', now() + interval '2 hours')$$, 'godziny z przyszłości');
select t_fails($$select add_shift(now() - interval '20 days', now() - interval '20 days' + interval '2 hours')$$, 'pracownik nie wpisuje starych godzin');
select t_fails($$select add_shift(now() - interval '5 hours', now() - interval '4 hours', null, '10000000-0000-0000-0000-000000000002')$$, 'pracownik nie wpisuje godzin innym');
select t_fails($$insert into work_shifts(profile_id, started_at) values ('10000000-0000-0000-0000-000000000003', now())$$, 'bezpośredni zapis godzin zablokowany');
do $$ declare n int; begin
  update work_shifts set note = 'x';
  get diagnostics n = row_count;
  perform t_ok(n = 0, 'UPDATE godzin przez pracownika nic nie zmienia');
end $$;
delete from work_shifts where source = 'manual';
do $$ declare n int; begin
  delete from work_shifts where source = 'clock' and started_at < now() - interval '3 days';
  get diagnostics n = row_count;
  perform t_ok(n = 0, 'starszych wpisów pracownik nie usuwa');
end $$;
select t_ok((select count(*) from work_shifts where source = 'manual') = 0, 'pracownik usuwa własny świeży wpis');

-- manager: widzi godziny wszystkich, wpisuje i poprawia
select t_as('10000000-0000-0000-0000-000000000002');
select t_ok((select count(*) from work_shifts where profile_id = '10000000-0000-0000-0000-000000000003') = 1, 'manager widzi godziny pracownika');
select add_shift(now() - interval '30 days', now() - interval '30 days' + interval '6 hours', 'uzupełnione', '10000000-0000-0000-0000-000000000003');
update work_shifts set note = 'poprawione' where source = 'manual';
select t_ok((select note from work_shifts where source = 'manual') = 'poprawione', 'manager poprawia wpis');
select t_ok((select count(*) from inventory_movements where reference_type = 'staff') = 2, 'manager widzi ruchy pracownika');
select t_fails($$select add_shift(now() - interval '5 hours', now() - interval '4 hours', null, '10000000-0000-0000-0000-000000000004')$$, 'manager nie wpisuje godzin osobie z innego lokalu');
-- tenant B nie widzi godzin A
select t_as('10000000-0000-0000-0000-000000000004');
select t_ok((select count(*) from work_shifts) = 0, 'tenant B nie widzi godzin A');
reset role;
select t_ok(not has_function_privilege('anon', 'clock_in(text)', 'execute')
        and not has_function_privilege('anon', 'staff_stock_change(uuid,numeric,text)', 'execute'), 'anon nie wykona funkcji zespołu');
select t_ok((select count(*) from audit_logs where table_name = 'work_shifts') >= 4, 'audyt godzin pracy');
\echo STAFF TESTS PASSED
