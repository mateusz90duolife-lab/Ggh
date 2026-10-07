# 🍽️ RESTAURANT OS — MASTER PROMPT „BUILD MODE”

> Wklej CAŁOŚĆ tego dokumentu do agenta AI (Claude Code / Lovable / Replit / Cursor).
> Dokument jest jedną specyfikacją: zasady, stack, baza danych, RLS, ekrany, formularze, UX, PWA, OCR, e-mail, testy, bramki jakości.
> Agent ma pracować **etapami (FAZA 1 → 6)** i **nie wolno mu przejść dalej, dopóki bramka jakości bieżącej fazy nie jest zielona**.

---

## 0. ROLA I ZASADY NIEŁAMALNE

Jesteś jednocześnie: Senior Full-Stack Developerem, Software Architectem, UX/UI Designerem, QA Engineerem i DevOpsem.
Budujesz **produkcyjną aplikację PWA do wewnętrznego zarządzania restauracją** (magazyn + braki + zakupy + zadania + później OCR, ceny, food cost).

### 0.1 Zasady (twarde)

1. **Etapami.** Pracujesz fazami z sekcji 3. Nie zaczynasz fazy N+1, dopóki faza N nie przeszła bramki jakości (sekcja 18).
2. **Najpierw plan, potem kod.** Na początku każdej fazy wypisz: cel, listę plików do utworzenia/zmiany, ryzyka. Dopiero potem koduj.
3. **Nie psuj działającego kodu.** Nie usuwaj i nie przepisuj działających funkcji bez wyraźnego powodu. Zmiany mają być minimalne i celowe. Przed refaktorem uruchom testy; po refaktorze uruchom je ponownie.
4. **Zero atrap.** Każdy przycisk, formularz, filtr, tabela i akcja ma realnie działać na prawdziwych danych w bazie. Żadnych `TODO`, `placeholder`, `mock`, `lorem ipsum`, `not implemented` w kodzie oznaczonym jako gotowy.
5. **Nie zgaduj.** Jeśli czegoś nie wiesz (np. struktura istniejącego repo, wersja biblioteki), najpierw to sprawdź (przeczytaj pliki, dokumentację). Jeśli decyzja biznesowa jest niejasna, przyjmij najprostsze rozsądne założenie, **zapisz je w `docs/DECISIONS.md`** i idź dalej.
6. **Prawda o stanie prac.** Raportuj uczciwie: co działa, co nie, co pominięto i dlaczego. Nie oznaczaj niczego jako „done”, jeśli nie zostało uruchomione i sprawdzone.
7. **Testuj po każdym module.** Po każdym większym module uruchom testy i wykonaj test ręczny/scenariuszowy (sekcje 16–17). Po całości — pełny audyt (sekcje 20–21).
8. **Sekrety tylko na backendzie.** Żaden klucz (`RESEND_API_KEY`, `AI_API_KEY`, `SERVICE_ROLE_KEY`) nigdy w kodzie frontendu, repo ani logach. Frontend dostaje wyłącznie `SUPABASE_URL` i `SUPABASE_ANON_KEY`.
9. **Bezpieczeństwo domyślnie.** RLS włączone na KAŻDEJ tabeli od pierwszej migracji. Brak policy = brak dostępu.
10. **Historia jest święta.** Ruchy magazynowe są *append-only* (nie edytuje się ich i nie usuwa). Błąd naprawia się ruchem korygującym.

### 0.2 Priorytety (przy konflikcie wygrywa lewa strona)

`STABILNOŚĆ > PROSTOTA > UŻYTECZNOŚĆ > WYGLĄD > DODATKOWE FUNKCJE`

### 0.3 Definicja „GOTOWE” dla dowolnego zadania

Zadanie jest gotowe dopiero, gdy: (a) działa end-to-end na prawdziwej bazie, (b) ma walidację po stronie klienta **i** serwera/bazy, (c) ma obsługę błędów i stanów pustych/ładowania, (d) jest zabezpieczone RLS/rolą, (e) przechodzą `lint`, `typecheck`, testy (sekcja 16), (f) wygląda poprawnie na 360 px.

---

## 1. PRODUKT W PIGUŁCE

- **Użytkownicy:** pracownicy restauracji (telefon, jedna ręka, hałas, pośpiech), manager, właściciel.
- **Cel pracownika:** zrobić 90% rzeczy w **maks. 2–3 kliknięciach** (zgłosić brak, odhaczyć zadanie, sprawdzić stan).
- **Cel właściciela:** w **10 sekund** wiedzieć, co dzieje się w restauracji (braki, zakupy, ceny, zadania).
- **Kluczowa pętla wartości (FAZA 1–2):** pracownik zgłasza brak → system agreguje w listę zakupów → o 21:00 właściciel dostaje e-mail → manager robi zakup → magazyn rośnie.
- **Język UI:** polski (struktura i18n gotowa pod dodanie innych języków, ale tylko PL w v1). **Waluta:** PLN. **Strefa czasu:** `Europe/Warsaw`. **Format:** `DD.MM.RRRR`, liczby `1 234,56`.

### 1.1 Poza zakresem v1 (nie budować, chyba że faza tego wymaga)

Integracja z kasą/POS, płatności, księgowość/KSeF, multi-lokalizacja w UI (schemat DB jest na to gotowy przez `restaurant_id`), aplikacje natywne, pełny offline-ERP.

---

## 2. STACK TECHNICZNY (nie zmieniaj bez zapisania uzasadnienia w `docs/DECISIONS.md`)

| Warstwa | Wybór |
|---|---|
| Frontend | React 18 + TypeScript (strict) + Vite |
| Routing | React Router (lazy loading tras per rola) |
| Stan serwera | TanStack Query (cache, optimistic updates, retry) |
| Formularze/walidacja | React Hook Form + Zod (schematy współdzielone z Edge Functions tam, gdzie się da) |
| UI | Tailwind CSS + shadcn/ui (Radix) + lucide-react |
| Backend | Supabase: PostgreSQL, Auth, Storage, RLS, Realtime, Edge Functions (Deno), pg_cron + pg_net |
| PWA | `vite-plugin-pwa` (Workbox) + manifest |
| Offline (min.) | TanStack Query persist + kolejka mutacji w IndexedDB (idb-keyval) |
| OCR (FAZA 3) | Multimodalny model (Claude Vision) wywoływany WYŁĄCZNIE z Edge Function; interfejs `OcrProvider` pozwalający podmienić silnik |
| E-mail | Resend, wysyłka WYŁĄCZNIE z Edge Function |
| Hosting | Vercel (frontend), Supabase (backend) |
| Testy | Vitest + Testing Library (unit/komponenty), pgTAP lub skrypty SQL (RLS i RPC), Playwright (E2E, viewporty mobilne) |
| Jakość | ESLint, Prettier, `tsc --noEmit`, Husky/lint-staged (opcjonalnie) |

### 2.1 Struktura repo

```
restaurant-os/
├─ src/
│  ├─ app/            # router, providery, guardy ról, layouty
│  ├─ features/
│  │  ├─ auth/ inventory/ shortages/ shopping/ tasks/ purchases/
│  │  ├─ dashboard/ receipts/ prices/ recipes/ reports/ users/ settings/
│  ├─ components/     # współdzielone (BottomNav, StatCard, EmptyState, QtyInput…)
│  ├─ lib/            # supabase client, zod schematy, format (PLN, daty, ilości), offline queue
│  └─ types/          # typy generowane z bazy (supabase gen types)
├─ supabase/
│  ├─ migrations/     # numerowane, idempotentne, po jednej na fazę/temat
│  ├─ functions/      # daily-shopping-summary, generate-daily-tasks, scan-receipt, _shared/
│  ├─ seed.sql        # TYLKO dane referencyjne (kategorie, jednostki) — bez fałszywych kont
│  └─ tests/          # testy SQL (RLS, RPC)
├─ e2e/               # Playwright
├─ docs/              # DECISIONS.md, SCHEMA.md, INSTRUKCJA_*.md, CHECKLIST.md
└─ .env.example       # tylko nazwy zmiennych, bez wartości
```

### 2.2 Zmienne środowiskowe

Frontend (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Sekrety Edge Functions (`supabase secrets set`): `RESEND_API_KEY`, `AI_API_KEY`, `CRON_SECRET`, `APP_BASE_URL`, `MAIL_FROM`.
`SUPABASE_SERVICE_ROLE_KEY` używany wyłącznie w Edge Functions wywoływanych z cron/`CRON_SECRET`.

---

## 3. FAZY I KAMIENIE MILOWE

```
FAZA 1  Login + role + pracownicy + zadania + braki + lista zakupów + magazyn (stany)
          ↓  bramka 1  →  WDROŻENIE DLA PRACOWNIKÓW (obowiązkowe), 1–2 tyg. realnego użycia
FAZA 2  Zakupy + ruchy magazynowe (pełne) + inwentaryzacja + e-mail 21:00 + dashboard
          ↓  bramka 2
FAZA 3  OCR faktur/paragonów + zatwierdzanie → zakupy
          ↓  bramka 3
FAZA 4  Historia cen + alerty wzrostu cen + analityka
          ↓  bramka 4
FAZA 5  Receptury + zużycie + food cost
          ↓  bramka 5
FAZA 6  Raporty + automatyzacje + prognozowanie
          ↓  bramka 6  →  AUDYT KOŃCOWY + dokumentacja
```

**Reguła wdrożenia:** po bramce 1 aplikacja MUSI być opublikowana i użyteczna dla pracowników, zanim zaczniesz FAZĘ 2. Nie buduj FAZ 3–6 „na zapas”.

### 3.1 Zakres funkcji per faza

| Moduł | F1 | F2 | F3 | F4 | F5 | F6 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Auth, role, zarządzanie użytkownikami | ✅ | | | | | |
| Produkty i kategorie | ✅ | | | | | |
| Magazyn (stan = suma ruchów, alerty min.) | ✅ | | | | | |
| Zgłoś brak + lista zakupów (agregacja) | ✅ | | | | | |
| Zadania + realtime | ✅ | | | | | |
| Szablony zadań (cykliczne) | ✅ | | | | | |
| Zakupy (ręczne) + dostawcy | | ✅ | | | | |
| Ruchy: zużycie/odpad/korekta + inwentaryzacja | | ✅ | | | | |
| E-mail z listą zakupów (cron) | | ✅ | | | | |
| Dashboard właściciela/managera | | ✅ | | | | |
| OCR + ekran weryfikacji | | | ✅ | | | |
| Historia cen, wzrosty | | | | ✅ | | |
| Receptury, zużycie z receptur, food cost | | | | | ✅ | |
| Raporty, prognozy, automatyzacje | | | | | | ✅ |
| PWA + offline minimum + audit log | ✅ (PWA, audit) | | | | | |

> PWA, audit log i RLS są częścią FAZY 1, nie dodatkiem na koniec.

---

## 4. BAZA DANYCH (Supabase / PostgreSQL)

**Zasady modelu:**
- Stan magazynowy **nie jest kolumną**. `STAN = SUMA(inventory_movements.quantity_delta)`.
- Ruchy są *append-only* (trigger blokuje UPDATE/DELETE). Korekta = nowy ruch.
- Wszystkie tabele mają `restaurant_id` (gotowość na wiele lokali), a RLS zawsze filtruje po `app_restaurant_id()`.
- Wszystkie ilości: `numeric(12,3)`, ceny: `numeric(12,4)`. Limit ilości `|x| ≤ 100000`.
- Każda ważna tabela ma trigger audytu (`audit_logs`: KTO / CO / KIEDY).
- Operacje wielokrokowe (zakup, inwentaryzacja, zatwierdzenie OCR) realizujesz **funkcjami RPC w jednej transakcji**, nie wieloma zapytaniami z frontendu.

Poniższy SQL jest **punktem wyjścia obowiązującym w strukturze i nazwach**. Przed użyciem uruchom go na czystym projekcie, popraw ewentualne błędy składni i opisz zmiany w `docs/DECISIONS.md`. Każdy blok = osobny plik w `supabase/migrations/`.

### 4.1 Migracja 001 — rdzeń (FAZA 1)

```sql
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
```

### 4.2 Migracja 002 — RLS (FAZA 1, w tym samym wydaniu co 001)

```sql
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
```

### 4.3 Migracja 003 — zakupy, ceny (FAZA 2 i 4)

```sql
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
```

> Uwaga: `purchase_items` nie ma `restaurant_id`, więc `audit_trigger` zapisze `restaurant_id = NULL`. Rozwiąż to w migracji (np. dodaj kolumnę `restaurant_id` do `purchase_items` lub pobieraj ją z `purchases` w triggerze) i opisz wybór w `DECISIONS.md`.

### 4.4 Migracja 004 — OCR (FAZA 3)

```sql
-- 004_receipts.sql
create type receipt_status as enum ('uploaded', 'processing', 'needs_review', 'approved', 'rejected', 'failed');

create table receipts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  storage_path text not null,                         -- '<restaurant_id>/<uuid>.jpg' w PRYWATNYM bucketcie 'receipts'
  status receipt_status not null default 'uploaded',
  ocr_engine text, ocr_raw jsonb, error text,
  supplier_guess text, document_number text, document_date date,
  uploaded_by uuid not null default auth.uid() references profiles(id),
  approved_by uuid references profiles(id), approved_at timestamptz,
  purchase_id uuid references purchases(id),
  created_at timestamptz not null default now()
);
alter table purchases add constraint purchases_receipt_fk foreign key (receipt_id) references receipts(id);

create table receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  raw_name text not null,
  quantity numeric(12,3), unit_raw text,
  unit_price numeric(12,4), line_total numeric(12,2), vat_rate numeric(5,2),
  matched_product_id uuid references products(id),
  confidence numeric(4,3) check (confidence between 0 and 1)
);

alter table receipts      enable row level security;
alter table receipt_items enable row level security;
create policy rc_sel on receipts for select using (restaurant_id = app_restaurant_id() and app_is_manager());
create policy rc_ins on receipts for insert with check (restaurant_id = app_restaurant_id() and app_is_manager() and status = 'uploaded');
create policy ri_all on receipt_items for all
  using (exists (select 1 from receipts r where r.id = receipt_id and r.restaurant_id = app_restaurant_id() and app_is_manager() and r.status = 'needs_review'))
  with check (exists (select 1 from receipts r where r.id = receipt_id and r.restaurant_id = app_restaurant_id() and app_is_manager() and r.status = 'needs_review'));
create policy ri_sel on receipt_items for select
  using (exists (select 1 from receipts r where r.id = receipt_id and r.restaurant_id = app_restaurant_id() and app_is_manager()));

-- Storage: bucket prywatny, dostęp tylko manager+ i tylko do folderu własnej restauracji
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
create policy rcpt_obj_sel on storage.objects for select
  using (bucket_id = 'receipts' and app_is_manager() and (storage.foldername(name))[1] = app_restaurant_id()::text);
create policy rcpt_obj_ins on storage.objects for insert
  with check (bucket_id = 'receipts' and app_is_manager() and (storage.foldername(name))[1] = app_restaurant_id()::text);

create table product_aliases (                          -- zapamiętane dopasowania nazw z dokumentów
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  raw_name_norm text not null,                          -- nazwa znormalizowana (lower, bez diakrytyków)
  product_id uuid not null references products(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  unique (restaurant_id, raw_name_norm, supplier_id)
);
alter table product_aliases enable row level security;
create policy pa_all on product_aliases for all using (restaurant_id = app_restaurant_id() and app_is_manager())
                                              with check (restaurant_id = app_restaurant_id() and app_is_manager());

-- approve_receipt(p_receipt_id, p_supplier_id, p_items jsonb): tworzy purchase(draft)+purchase_items z ZWERYFIKOWANYCH
-- przez człowieka pozycji, wywołuje confirm_purchase, ustawia receipts.status='approved'. Nic nie rusza magazynu wcześniej.
```

### 4.5 Migracja 005 — receptury i food cost (FAZA 5)

```sql
-- 005_recipes.sql
create table recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  name text not null check (length(trim(name)) between 1 and 100),
  sale_price numeric(10,2) not null check (sale_price > 0),     -- cena sprzedaży (jak na menu)
  active boolean not null default true,
  unique (restaurant_id, name)
);
create table recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(12,4) not null check (quantity > 0),          -- w JEDNOSTCE PRODUKTU (UI przelicza g↔kg, ml↔l)
  unique (recipe_id, product_id)
);
create table recipe_sales (                                       -- = tabela „consumption” z planu
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null default app_restaurant_id() references restaurants(id),
  recipe_id uuid not null references recipes(id),
  portions int not null check (portions between 1 and 1000),
  sold_on date not null default current_date,
  created_by uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now()
);
-- Trigger AFTER INSERT na recipe_sales: dla każdej pozycji receptury wstaw ruch 'consumption'
-- (quantity_delta = -portions * recipe_items.quantity, reference_type='sale', reference_id=recipe_sales.id).

create view recipe_costs with (security_invoker = true) as
select r.id as recipe_id, r.restaurant_id, r.name, r.sale_price,
       coalesce(sum(ri.quantity * pt.last_price), 0)::numeric(12,2) as food_cost,
       count(*) filter (where pt.last_price is null) as items_without_price,
       case when r.sale_price > 0
            then round(coalesce(sum(ri.quantity * pt.last_price), 0) / r.sale_price * 100, 2) end as food_cost_pct
from recipes r
left join recipe_items ri on ri.recipe_id = r.id
left join price_trend pt on pt.product_id = ri.product_id
group by r.id;
-- + RLS: recipes/recipe_items/recipe_sales/recipe_costs — owner (zapis), manager (odczyt, sprzedaż); pracownik: brak dostępu.
```

> Food cost liczymy względem ceny sprzedaży tak, jak wpisano na menu (przykład: 9,50 / 39,00 = 24,36 %). Ewentualną opcję „licz od ceny netto” zapisz w `DECISIONS.md` i dodaj jako ustawienie lokalu.

### 4.6 Seed (tylko dane referencyjne)

Kategorie startowe: Nabiał, Warzywa, Owoce, Mięso, Ryby, Pieczywo, Suche, Napoje, Alkohole, Przyprawy, Chemia/Czystość, Inne. **Żadnych fałszywych użytkowników ani produktów w migracjach produkcyjnych.** Pierwszego właściciela tworzysz instrukcją w `docs/SETUP.md` (SQL: wstaw `restaurants` + `profiles` dla konta utworzonego w panelu Auth).

---

## 5. ROLE I UPRAWNIENIA

| Akcja | EMPLOYEE | MANAGER | OWNER |
|---|:-:|:-:|:-:|
| Zobaczyć dzisiejsze zadania, odhaczyć zadanie | ✅ | ✅ | ✅ |
| Zgłosić brak | ✅ | ✅ | ✅ |
| Zobaczyć stany magazynu (bez historii ruchów, bez cen) | ✅ | ✅ | ✅ |
| Zobaczyć listę zakupów | ✅ (tylko odczyt) | ✅ | ✅ |
| Dodawać/edytować produkty i kategorie | ❌ | ✅ | ✅ |
| Usuwać produkty | ❌ | ❌ | ✅ (tylko bez ruchów; zwykle dezaktywacja) |
| Ruchy: zużycie / odpad / korekta, inwentaryzacja | ❌ | ✅ | ✅ |
| Zakupy, dostawcy, skan dokumentów (OCR) | ❌ | ✅ | ✅ |
| Historia ruchów, historia cen, raporty | ❌ | ✅ (bez kosztów receptur) | ✅ |
| Tworzenie zadań jednorazowych | ❌ | ✅ | ✅ |
| Szablony zadań (cykliczne) | ❌ | podgląd | ✅ |
| Receptury, food cost | ❌ | podgląd | ✅ |
| Użytkownicy, role, ustawienia, audit log | ❌ | ❌ | ✅ |

**Egzekwowanie na 3 poziomach (wszystkie wymagane):**
1. **Baza** — RLS + RPC (sekcja 4). To jedyne źródło prawdy.
2. **Router** — `RoleGuard` przekierowuje na ekran „Brak dostępu” albo na stronę domową danej roli.
3. **UI** — ukrywanie niedozwolonych elementów (kosmetyka, nie zabezpieczenie).

**Zarządzanie użytkownikami** (tworzenie kont, reset hasła, zmiana roli, dezaktywacja): Edge Function `admin-users` — weryfikuje JWT, sprawdza `role = owner` w `profiles`, dopiero potem używa service role. Właściciel nie może zdegradować ani dezaktywować samego siebie, jeśli jest jedynym właścicielem. Dezaktywacja (`active=false`) zamiast usuwania; dezaktywowany użytkownik traci dostęp natychmiast (`app_restaurant_id()` zwraca NULL).

---

## 6. MAPA APLIKACJI I EKRANY

```
LOGIN (/login) → przekierowanie wg roli
 ├─ PRACOWNIK  : Dzisiaj · Zadania · Zgłoś brak · Magazyn
 ├─ MANAGER    : Dashboard · Magazyn · Braki/Zakupy · Zadania · Raporty · Więcej
 └─ WŁAŚCICIEL : Dashboard · Magazyn · Zakupy · OCR · Ceny · Food Cost · Zadania · Pracownicy · Ustawienia
```

Dla KAŻDEGO ekranu: stany **ładowanie** (skeleton), **pusty** (komunikat + akcja), **błąd** (komunikat po polsku + „Spróbuj ponownie”), **offline** (baner), **brak uprawnień**.

### 6.1 Wspólne

- **/login** — e-mail + hasło, „Zapomniałem hasła” (reset przez Supabase Auth, ekran `/reset-password`), komunikaty błędów po polsku (nie ujawniaj, czy e-mail istnieje), utrzymanie sesji, wylogowanie w menu „Więcej”. Po zalogowaniu: EMPLOYEE → `/dzisiaj`, MANAGER/OWNER → `/dashboard`.
- **Dolna nawigacja (mobile, ≤ 767 px)** — 4 kafle + „Więcej”, min. wysokość dotyku 48 px, aktywny kafel wyraźnie zaznaczony. Desktop (≥ 1024 px): boczny pasek ze wszystkimi pozycjami danej roli.
  - Pracownik: 🏠 Dzisiaj · 📦 Magazyn · 🛒 Braki · ✅ Zadania · ••• Więcej
  - Manager/Owner: 🏠 Dashboard · 📦 Magazyn · 🛒 Zakupy · ✅ Zadania · ••• Więcej (reszta w „Więcej”)
- **Pływający przycisk „+ ZGŁOŚ BRAK”** dostępny z ekranów Dzisiaj, Magazyn, Zadania.

### 6.2 Pracownik

**/dzisiaj** — nagłówek „Cześć, {imię}” + data; karta „Zadania na dziś: 3/7” (pasek postępu); lista 3 najbliższych niewykonanych zadań z checkboxem; duży przycisk **+ ZGŁOŚ BRAK**; sekcja „Ostatnio zgłoszone braki” (5 ostatnich otwartych, żeby nie dublować).

**/zadania** — lista zadań na dziś (grupy: Do zrobienia / Zrobione). Tap na checkbox = natychmiast zapis (optimistic update przez `complete_task`), cofnięcie możliwe tapem ponownie. Przy wykonanym: kto i o której. Wiersz min. 56 px wysokości, cały wiersz klikalny. Realtime: zmiany innych osób pojawiają się bez odświeżania.

**/braki/nowy (Zgłoś brak)** — NAJPROSTSZY ekran w aplikacji:
1. Pole **Produkt** (wyszukiwarka z autouzupełnianiem po nazwie, ignoruje wielkość liter i polskie znaki; pokazuje kategorię i jednostkę; najczęściej zgłaszane na górze).
2. Pole **Ilość** (klawiatura numeryczna `inputmode="decimal"`, przyciski szybkie `−`/`+`, akceptuje przecinek jako separator) i **jednostka** (tylko do odczytu — z produktu).
3. Przełącznik **PILNE**.
4. Opcjonalna **Uwaga** (zwinięta domyślnie).
5. Przycisk **DODAJ** → wywołanie `report_shortage` → toast „Dodano: Mleko — 10 L”, formularz czyści się i zostaje gotowy do kolejnego zgłoszenia (przycisk „Gotowe” wraca do /dzisiaj).
Walidacja: produkt wybrany z listy; ilość > 0 i ≤ 100000; zablokowany podwójny submit; po błędzie sieci zgłoszenie trafia do kolejki offline (sekcja 12).
Jeśli produktu nie ma w katalogu: link „Nie ma na liście?” → pole tekstowe „Zgłoś nowy produkt” zapisuje zgłoszenie do manager-a jako **zadanie** „Dodać produkt: {nazwa}” (pracownik nie tworzy produktów).

**/magazyn (odczyt)** — lista produktów pogrupowana w kategorie, wyszukiwarka, filtr „Tylko braki/niski stan”. Wiersz: nazwa, stan + jednostka, pasek (zielony/żółty/czerwony wg `status`: ok/low/out), etykieta „Stan OK” / „⚠️ Niski stan” / „🔴 BRAK”. Brak historii i cen.

### 6.3 Manager

**/dashboard** — karty: Niski stan (liczba, klik → magazyn z filtrem), Otwarte braki (liczba pozycji, w tym PILNE), Zadania dziś (x/y), Ostatnie powiadomienia. Brak kwot finansowych w widoku managera poza zakupem dnia (jeśli owner włączy w ustawieniach).

**/magazyn** — jak wyżej + przycisk „+ Produkt”, w wierszu szybkie akcje: Zużycie, Odpad. **Karta produktu** (/magazyn/:id): stan, minimum, kategoria, jednostka, edycja (manager), **Historia ruchów** (typ, ilość ze znakiem, kto, kiedy, uwaga; filtr typ/okres), zakupy tego produktu, (FAZA 4) wykres cen.
- **Dodaj ruch** (modal): typ (Zużycie / Odpad / Korekta), ilość (>0 — znak nadaje aplikacja; dla Korekty wybór +/−), uwaga (obowiązkowa dla Korekty). Podgląd „Stan po: X”. Zapis przez `record_movement`. Blokada ruchu, który zeszłby poniżej zera dla zużycia/odpadu → ostrzeżenie z możliwością potwierdzenia (stan ujemny sygnalizuje błąd danych).
- **Inwentaryzacja** (/magazyn/inwentaryzacja): lista produktów z polem „Stan rzeczywisty”; wiersz pokazuje stan systemowy i różnicę na żywo; przycisk „Zatwierdź” → podsumowanie różnic → `submit_inventory_count`. Można wprowadzać tylko część produktów (pominięte nie są zmieniane).

**/zakupy** — dwie zakładki:
- **Lista zakupów** (z widoku `shopping_list`): grupy wg kategorii; wiersz „MLEKO — 10 L” + znacznik PILNE + „3 zgłoszenia” (rozwija: kto, ile, kiedy). Akcje: „Odznacz jako kupione” → otwiera kreator zakupu z wstępnie wypełnionymi pozycjami; „Anuluj brak” (z powodem). Przycisk **Kopiuj listę / Udostępnij** (tekst do schowka/Web Share API) oraz **Wyślij mailem teraz**.
- **Zakupy** (historia): lista zakupów z filtrem daty/dostawcy, szczegóły.
- **Nowy zakup** (/zakupy/nowy): dostawca (lub „Bez dostawcy” / dodaj nowego), data, nr dokumentu, pozycje (produkt, ilość, cena netto za jednostkę, VAT), suma. Zapis jako szkic, potem **Zatwierdź zakup** → `confirm_purchase` (stan rośnie, braki tego produktu zamykają się, cena trafia do historii). Zatwierdzony zakup jest tylko do odczytu; pomyłkę koryguje się ruchem korygującym + notatką.

**/zadania** (manager) — widok dnia dla wszystkich + dodanie zadania jednorazowego (tytuł, opis, data, opcjonalnie osoba) + podgląd statusu na żywo (kto wykonał i kiedy).

**/raporty** (FAZA 6; wcześniej prosty „Zakupy i braki” z zakresem dat).

### 6.4 Właściciel (wszystko managera, plus)

**/dashboard (owner)** — kolejność kart zgodna z planem: 📦 Magazyn („3 produkty poniżej minimum”), 🛒 Zakupy („12 pozycji na liście”), 💰 Zakupy dzisiaj (suma PLN), 📈 Wzrost cen (liczba produktów z `change_pct` ≥ próg z ustawień, domyślnie 10 %), ✅ Zadania („18/22”), ⚠️ Pilne braki. Każda karta klikalna. Cel: **10 sekund do pełnego obrazu**.
**/ocr** — skan dokumentu (FAZA 3, sekcja 9). **/ceny** — historia cen i wzrosty (FAZA 4). **/foodcost**, **/receptury** (FAZA 5).
**/pracownicy** — lista użytkowników (imię, rola, status), dodaj (imię, e-mail, rola, hasło tymczasowe/zaproszenie), zmień rolę, dezaktywuj, reset hasła (przez `admin-users`).
**/szablony-zadan** — CRUD szablonów: tytuł, opis, dni tygodnia (pn–nd, chipsy), aktywny. Podgląd „Najbliższe wystąpienia”.
**/ustawienia** — nazwa lokalu, godzina podsumowania (domyślnie 21:00), odbiorcy e-mail (lista, walidacja formatu), próg wzrostu ceny, strefa czasu, „Wyślij testowy mail”. **/audyt** — log zmian (KTO · CO · KIEDY, z filtrem użytkownik/tabela/okres, czytelne opisy zamiast surowego JSON, np. „Mateusz zmienił stan mleka −5 L, 07.10.2026 19:42”).

---

## 7. DESIGN SYSTEM (dopiero po działającym szkielecie ekranów)

Styl: **nowoczesny, prosty system restauracyjny — NIE panel korporacyjnego ERP.** Dużo bieli, duże cele dotykowe, jedna główna akcja na ekran.

**Tokeny kolorów** (zdefiniuj jako zmienne CSS/Tailwind, nie rozrzucaj hexów po kodzie):
`--bg #F7F7F5` · `--surface #FFFFFF` · `--primary #1F2937` · `--success #16A34A` · `--warning #F59E0B` · `--danger #DC2626` · `--muted #6B7280` · `--border #E5E7EB`.
Stany magazynu zawsze: OK = success, niski = warning, brak = danger — **kolor ZAWSZE z ikoną i tekstem** (dostępność dla daltonistów).

**Typografia:** system font stack lub Inter; min. 16 px dla treści (zapobiega zoomowi iOS), nagłówki 20–28 px; liczby tabelaryczne (`tabular-nums`).
**Dotyk:** elementy interaktywne ≥ 44×44 px (preferowane 48), odstępy ≥ 8 px, kluczowe akcje w zasięgu kciuka (dół ekranu).
**Komponenty współdzielone:** `BottomNav`, `SideNav`, `StatCard`, `StockBar`, `QtyInput`, `ProductPicker`, `EmptyState`, `ErrorState`, `OfflineBanner`, `ConfirmDialog`, `Toast`, `SectionHeader`, `RoleBadge`.
**Ruch/feedback:** każda akcja daje natychmiastowy feedback (toast / zmiana stanu), operacje > 400 ms pokazują loader, brak „martwych” kliknięć.
**Dostępność:** kontrast WCAG AA, `aria-label` dla ikon, focus ring, obsługa `prefers-reduced-motion`, poprawne etykiety formularzy.
**Tryb ciemny:** poza zakresem v1 (opcjonalnie później).

---

## 8. FORMULARZE I WALIDACJA (obowiązuje WSZĘDZIE)

Walidacja w **trzech miejscach**: Zod w UI (szybki feedback), RPC/Edge Function (autorytatywna), `CHECK` w bazie (ostatnia linia obrony).

Każdy formularz sprawdza: czy produkt istnieje i jest aktywny · ilość `> 0` i `≤ 100000` · jednostka zgodna z produktem · użytkownik ma uprawnienie · edytowany rekord istnieje (obsługa „ktoś już usunął/zmienił”) · długości tekstów · poprawny e-mail · data nie z odległej przyszłości.
**Nie może przejść** np. `ilość = -999999`, `NaN`, pusty tekst z samych spacji, podwójne kliknięcie „Dodaj”.
Liczby: przyjmuj `,` i `.`; zaokrąglaj do 3 miejsc; nigdy nie ufaj wartościom z klienta.
Komunikaty błędów po polsku, przy polu, konkretne („Ilość musi być większa od 0”).

---

## 9. OCR DOKUMENTÓW (FAZA 3)

Przepływ:
```
zdjęcie (kamera/plik) → kompresja po stronie klienta (max ~1600 px, JPEG) → upload do prywatnego Storage
→ Edge Function `scan-receipt` (JWT + rola manager+) → OcrProvider (Claude Vision, klucz tylko na serwerze)
→ ustrukturyzowany JSON (zwalidowany Zod) → receipts + receipt_items (status needs_review)
→ EKRAN WERYFIKACJI → człowiek zatwierdza → approve_receipt → purchase + ruchy + historia cen
```
**ŻELAZNA ZASADA: OCR nigdy nie zmienia magazynu bez zatwierdzenia przez człowieka.** Statusy `uploaded/processing/needs_review` nie tworzą żadnych ruchów.

**Ekran weryfikacji:** miniatura dokumentu (powiększalna) obok tabeli rozpoznanych pozycji. Dla każdej pozycji: tekst z dokumentu, **dopasowany produkt** (select z podpowiedzią i wskaźnikiem pewności; „Dodaj nowy produkt”), ilość, jednostka, cena netto, VAT; pozycje o niskiej pewności (< 0,8) podświetlone; możliwość usunięcia/dodania pozycji; kontrola sumy (suma pozycji vs. suma z dokumentu — ostrzeżenie przy rozbieżności). Dopasowanie nazw: najpierw dokładne/znormalizowane (bez wielkości liter i diakrytyków), potem podobieństwo; zapamiętuj wybory człowieka jako **aliasy** (`product_aliases`: `raw_name` → `product_id`), by kolejne dokumenty dopasowywały się lepiej. Przycisk **ZATWIERDŹ ZAKUP** aktywny dopiero, gdy każda pozycja ma przypisany produkt i poprawne liczby.
Obsługa błędów: nieczytelny dokument → status `failed` z komunikatem i opcją ponowienia/ręcznego wprowadzenia; timeout; duplikat dokumentu (ten sam dostawca + numer + data → ostrzeżenie). Limit rozmiaru pliku i typów (jpg/png/webp/pdf do ustalonego MB). Zdjęcia dokumentów **nigdy** publiczne — dostęp przez krótkotrwałe signed URL.

---

## 10. E-MAIL I AUTOMATYZACJE (Edge Functions)

Wszystkie funkcje: walidacja wejścia, ustrukturyzowane logi (bez sekretów), jawne kody błędów, idempotencja, brak kluczy we frontendzie.

### 10.1 `daily-shopping-summary` (FAZA 2)
- Wywoływana przez **pg_cron + pg_net co 5–15 min** z nagłówkiem `Authorization: Bearer $CRON_SECRET` (sekret w Vault/ustawieniach, nie w repo).
- Dla każdej restauracji: oblicz lokalny czas (`timezone`); jeśli `local_time >= summary_time` **i** brak wpisu w `email_log` na dziś (`unique(restaurant_id, kind, local_date)`) → zbuduj listę z `shopping_list` → wyślij przez Resend → zapisz `email_log` (`sent`/`failed` + błąd).
- Pusta lista: zapisz `skipped` (domyślnie nie wysyłaj; opcja w ustawieniach „wysyłaj też pustą”).
- **Nigdy** nie wysyłaj dwóch maili tego samego dnia (nawet przy równoległym wywołaniu — użyj `insert … on conflict do nothing` jako blokady przed wysyłką).
- Format maila (HTML + wersja tekstowa), temat: `Lista zakupów restauracji — DD.MM.RRRR`
```
Dzień dobry,
poniżej lista zakupów na jutro (08.10.2026):

NABIAŁ
• Mleko — 10 L
• Śmietana — 6 L

WARZYWA
• Pomidor — 12 kg
(⚠️ PILNE oznaczone wyraźnie na górze)

Pozdrawiam, System magazynowy
```
- Dodatkowo `POST /send-now` (manager+) do ręcznej wysyłki z UI.
- Escapuj wszystkie dane użytkownika w HTML maila (nazwy produktów, uwagi).

### 10.2 `generate-daily-tasks` (FAZA 1)
Cron raz dziennie ~04:00 czasu lokalu (oraz leniwie przy otwarciu aplikacji przez managera, jako zabezpieczenie): wywołuje `generate_tasks_for(restaurant, data)`. Idempotentne dzięki unikalnemu indeksowi.

### 10.3 `admin-users` (FAZA 1) — zarządzanie kontami (sekcja 5). `scan-receipt` (FAZA 3) — sekcja 9.

---

## 11. PWA (FAZA 1)

- `manifest.webmanifest`: nazwa, krótka nazwa, `display: standalone`, `start_url`, `theme_color`, `background_color`, ikony 192/512 + maskable, `lang: pl`.
- Service worker (Workbox): precache shell aplikacji, strategia *stale-while-revalidate* dla zasobów, *network-first z fallbackiem do cache* dla danych odczytowych, **nigdy nie cache’uj odpowiedzi autoryzacyjnych ani zdjęć dokumentów**. Aktualizacje: baner „Dostępna nowa wersja — Odśwież”.
- Ikony i ekran startowy (splash) wygeneruj ze źródłowego SVG; meta dla iOS (`apple-touch-icon`, `apple-mobile-web-app-capable`).
- **Prompt instalacji:** Android/Chrome — przechwyć `beforeinstallprompt` i pokaż własny przycisk „Zainstaluj aplikację”; iOS/Safari — krótka instrukcja „Udostępnij → Do ekranu początkowego”; desktop Chrome/Edge — ikona instalacji.
- Test ręczny: Android Chrome („Dodaj do ekranu głównego”), iPhone Safari, desktop Chrome/Edge; Lighthouse PWA/Accessibility/Best-Practices ≥ 90.

---

## 12. OFFLINE / SŁABY INTERNET (wersja minimalna, bez „offline-ERP”)

Wymagane minimum:
1. Aplikacja **otwiera się bez internetu** (shell z cache).
2. Wcześniej pobrane dane (produkty, stany, zadania na dziś, lista zakupów) są **widoczne tylko do odczytu** z persystowanego cache TanStack Query, z banerem „Tryb offline — dane z {godzina}”.
3. **Tylko dwie akcje mogą być zakolejkowane offline:** *zgłoszenie braku* i *odhaczenie zadania*. Zapisują się w IndexedDB z unikalnym `client_id`, widać je na liście ze znaczkiem „oczekuje na wysłanie”.
4. Po odzyskaniu sieci kolejka wysyła się automatycznie, **po kolei i idempotentnie** (zgłoszenie z tym samym `client_id` nie może powstać dwa razy — dodaj kolumnę `client_id uuid unique` do `shortages`, a RPC ma być odporne na powtórkę). Błędy synchronizacji są widoczne dla użytkownika, nigdy cicho gubione.
5. Zakupy, ruchy magazynowe, inwentaryzacja, OCR, zarządzanie użytkownikami: **wymagają internetu** (przyciski nieaktywne z wyjaśnieniem w trybie offline) — zapobiega konfliktom w stanach magazynu.

---

## 13. RESPONSYWNOŚĆ

Mobile-first; priorytet: telefony 360–430 px. Przetestuj i zrób zrzuty ekranu na: **360×800, 390×844, 412×915, 768×1024, 1280×800, 1440×900**. Brak poziomego scrolla, brak ucinania tekstu, formularze nie są zasłaniane przez klawiaturę ekranową (użyj `dvh`, przewijanie do aktywnego pola), pasek dolny uwzględnia `safe-area-inset-bottom`. Na desktopie: boczna nawigacja, tabele zamiast kart tam, gdzie to ma sens.

---

## 14. BEZPIECZEŃSTWO (checklista obowiązkowa)

- RLS włączone na każdej tabeli; zapis tylko przez policy lub RPC; **testy SQL dla każdej tabeli i każdej roli** (sekcja 16).
- `anon` bez dostępu do tabel, widoków i funkcji; funkcje `security definer` mają `set search_path = public` i jawne sprawdzenie roli w środku.
- Storage dokumentów prywatny, ścieżki z `restaurant_id`, dostęp przez signed URL o krótkim TTL.
- Brak sekretów w repo/bundlu (`git grep` + skan bundla: brak `service_role`, `RESEND`, `AI_API_KEY`); `.env` w `.gitignore`.
- Edge Functions: weryfikacja JWT i roli, walidacja Zod, limity rozmiaru, CORS ograniczony do domeny aplikacji, rate-limiting prostych endpointów (np. `send-now`, `scan-receipt`).
- Sesja: krótki access token + refresh, wylogowanie czyści cache zapytań i kolejkę offline.
- Nagłówki (Vercel): CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`.
- Zależności: `npm audit` bez krytycznych, brak nieużywanych bibliotek.
- Dane osobowe: tylko imię i e-mail pracowników; brak zbędnych danych.

---

## 15. KOLEJNOŚĆ PRAC (FAZA 1 i 2 krok po kroku)

Po każdym kroku: uruchom `lint`, `typecheck`, testy; zrób commit z opisem; zaktualizuj `docs/CHECKLIST.md`.

**FAZA 1**
1. Scaffold: Vite + React + TS strict + Tailwind + shadcn/ui + ESLint/Prettier + Vitest + Playwright; skrypty `lint`, `typecheck`, `test`, `build`, `e2e`; `.env.example`; CI (GitHub Actions: lint → typecheck → test → build).
2. Supabase: migracje 001+002, seed kategorii, wygenerowane typy TS, `docs/SETUP.md` (utworzenie pierwszego właściciela).
3. Testy SQL RLS (czerwone → zielone) **zanim** powstanie UI danych.
4. Auth: `/login`, reset hasła, sesja, `RoleGuard`, layouty (BottomNav/SideNav), ekran „Brak dostępu”.
5. Użytkownicy: Edge Function `admin-users` + ekran `/pracownicy`.
6. Produkty i kategorie (CRUD manager+, dezaktywacja).
7. Magazyn (odczyt, stany, statusy, wyszukiwarka, karta produktu).
8. **Zgłoś brak** + `/dzisiaj` + lista zakupów (agregacja, widok `shopping_list`).
9. Zadania: lista dnia, `complete_task`, realtime, zadania jednorazowe, szablony + `generate-daily-tasks`.
10. Audit log (ekran `/audyt`), powiadomienia o niskim stanie.
11. PWA + offline minimum (sekcje 11–12), responsywność (sekcja 13).
12. Testy E2E mobilne, UX review, **bramka 1**, publikacja dla pracowników.

**FAZA 2**
13. Migracja 003 (część zakupów), dostawcy, kreator zakupu, `confirm_purchase`.
14. Ruchy ręczne (zużycie/odpad/korekta) + historia ruchów + inwentaryzacja.
15. `daily-shopping-summary` + ustawienia (godzina, odbiorcy) + `send-now` + `email_log`.
16. Dashboard managera i właściciela. **Bramka 2.**

**FAZY 3–6** według sekcji 3 i migracji 003 (cz. cen), 004, 005; każda kończy się własną bramką.

---

## 16. TESTY (automatyczne — muszą istnieć i przechodzić)

| # | Poziom | Co sprawdza |
|---|---|---|
| T1 | E2E | Pracownik zgłasza brak → pojawia się toast i wiersz w „Ostatnio zgłoszone” |
| T2 | SQL+E2E | Zgłoszony brak jest na liście zakupów |
| T3 | SQL | Zgłoszenia mleka 5 L + 3 L + 2 L → jeden wiersz „MLEKO — 10 L”, `reports_count = 3` |
| T4 | Edge/integr. | Funkcja podsumowania buduje poprawny mail (Resend zamockowany **tylko w teście**), zapisuje `email_log`; drugie wywołanie tego samego dnia → brak drugiego maila |
| T5 | SQL | `confirm_purchase` zwiększa stan o ilość zakupu, zamyka otwarte braki produktu, dodaje wpis ceny; powtórne wywołanie → błąd, brak duplikatu ruchu |
| T6 | SQL | Ruch zużycia zmniejsza stan |
| T7 | SQL | Przekroczenie minimum w dół tworzy dokładnie jedno powiadomienie |
| T8 | E2E+SQL | Pracownik nie wejdzie na trasy managera/właściciela (redirect) **i** zapytania do chronionych tabel zwracają 0 wierszy/błąd |
| T9 | integr. | OCR zwraca poprawnie zwalidowaną strukturę dla dokumentu testowego (dostawca modelu zamockowany w CI, test na realnych próbkach uruchamiany ręcznie) |
| T10 | SQL | Dokument w statusie `needs_review` **nie** ma ruchów magazynowych; ruchy powstają dopiero po `approve_receipt` |
| T11 | E2E+realtime | Zadanie odhaczone przez pracownika widoczne u managera bez odświeżenia |
| T12 | SQL | Każda zmiana w produktach/ruchach/zadaniach zapisuje `audit_logs` z poprawnym `actor_id` |
| T13 | SQL | `UPDATE`/`DELETE` na `inventory_movements` rzuca błąd |
| T14 | SQL | Walidacje: ilość ≤ 0, ≥ 100001, `NaN`, nieistniejący/nieaktywny produkt, produkt z innej restauracji → odrzucone |
| T15 | SQL | Eskalacja uprawnień: manager/pracownik nie zmieni własnej roli, nie utworzy konta, nie odczyta `audit_logs` |
| T16 | SQL | `anon` nie ma dostępu do żadnej tabeli/widoku/funkcji |
| T17 | SQL | Izolacja tenantów: użytkownik restauracji A nie widzi danych restauracji B |
| T18 | unit/E2E | Kolejka offline: zgłoszenie z offline wysyła się raz po powrocie sieci (idempotencja `client_id`) |
| T19 | SQL | `generate_tasks_for` jest idempotentne i uwzględnia dni tygodnia |
| T20 | E2E | Viewporty z sekcji 13: brak poziomego scrolla, kluczowe akcje widoczne |

**Materiał referencyjny:** w `restaurant-os/verification/` leży działający test dymny SQL (`00_supabase_mock.sql` + `rls_smoke.sql`), który uruchomiono na PostgreSQL 16 po migracjach z sekcji 4. Pokrywa T2, T3, T5–T8, T12, T13, T15–T19 oraz walidacje ilości. Przepisz go na pgTAP/skrypty w `supabase/tests/` i rozszerz — nie traktuj go jako kompletu.

Reguły: testy muszą być deterministyczne (stałe dane, kontrolowany czas), niezależne od kolejności; test, który nie przechodzi, naprawiasz **kodem lub testem z uzasadnieniem w commicie** — nigdy nie wyłączasz/pomijasz (`skip`/`xit`) żeby „zazielenić”.

---

## 17. TEST „PRAWDZIWEJ RESTAURACJI” (scenariusz E2E, jeden ciągły przebieg)

Zaimplementuj jako jeden test Playwright (kontrolowany zegar + wywołanie funkcji cron przez endpoint testowy dostępny tylko w środowisku testowym):

```
07:00  Pracownik A loguje się                          → ląduje na /dzisiaj
07:05  Widzi swoje zadania na dziś (z szablonów)       → lista niepusta, poprawny dzień tygodnia
10:00  Odhacza zadanie „Posprzątać chłodnię”           → status done, widać „kto/kiedy”
12:30  Brakuje mleka: zgłasza 10 L                     → toast „Dodano: Mleko — 10 L”
15:00  Pracownik B zgłasza mleko 5 L                   → lista zakupów: MLEKO — 15 L (2 zgłoszenia)
15:01  Manager (druga sesja) widzi zadanie wykonane o 10:00 i braki na żywo, bez odświeżania
18:00  Manager tworzy zakup: mleko 20 L, 5,40 zł/L     → Zatwierdź zakup
18:01  Magazyn: stan mleka +20 L; braki mleka zamknięte; historia cen: wpis 5,40
21:00  Cron podsumowania                               → generuje listę zakupów na jutro
21:01  Właściciel dostaje e-mail (w teście: przechwycony payload do Resend) z poprawną treścią
       Drugie wywołanie crona → NIE wysyła kolejnego maila
```
**Jeśli cały scenariusz przechodzi bez ręcznej ingerencji programisty — MVP jest gotowe.**

---

## 18. BRAMKI JAKOŚCI (musisz „zaliczyć”, żeby przejść dalej)

Każda bramka wymaga: ✅ `lint` + `typecheck` + testy + `build` zielone · ✅ brak `TODO/MOCK/PLACEHOLDER` w kodzie fazy · ✅ ręczne przejście ekranów jako każda rola na 390×844 · ✅ zaktualizowany `docs/CHECKLIST.md` · ✅ krótki raport (sekcja 23).

- **Bramka 1:** login, role, RLS (T8, T15–T17), użytkownicy, produkty, magazyn (odczyt), braki (T1–T3), lista zakupów, zadania + realtime (T11), szablony (T19), audit (T12), PWA instalowalna, offline minimum (T18), responsywność (T20). → **Wdrożenie dla pracowników.**
- **Bramka 2:** zakupy (T5), ruchy (T6, T7, T13), inwentaryzacja, e-mail (T4), dashboard, scenariusz z sekcji 17 przechodzi.
- **Bramka 3:** OCR (T9, T10), ekran weryfikacji, duplikaty dokumentów, prywatny Storage.
- **Bramka 4:** historia cen, wzrosty %, alerty, wykres ceny produktu.
- **Bramka 5:** receptury, zużycie ze sprzedaży porcji, food cost zgodny z przykładem (burger: koszt 9,50 zł / cena 39,00 zł = 24,36 %).
- **Bramka 6:** raporty (Dzisiaj/7 dni/30 dni/własny zakres: zakupy, zużycie, odpady, najdroższe produkty, największe wzrosty cen), automatyzacje, prognoza (np. „zapas wystarczy na N dni” na bazie średniego zużycia z 28 dni).

---

## 19. UX REVIEW (po bramce 1 i przed końcem)

Przejdź aplikację jako każda rola i odpowiedz pisemnie w `docs/UX_REVIEW.md`:
- **Pracownik:** „Czy wiem, co zrobić, nie czytając instrukcji? Ile kliknięć zajmuje zgłoszenie braku? (cel ≤ 3)”.
- **Manager:** „Czy od razu widzę najważniejsze problemy (braki PILNE, niski stan, zaległe zadania)?”.
- **Właściciel:** „Czy w 10 sekund wiem, co dzieje się w restauracji?”.
Jeśli odpowiedź brzmi „nie” — popraw UX i powtórz. Wypisz konkretne zmiany.

---

## 20. CLEANUP I PRODUKCJA

**Cleanup przed publikacją:** usuń `console.log`/debug, mock data, konta testowe, nieużywane komponenty i biblioteki (`depcheck`/`knip`), zoptymalizuj obrazy, sprawdź rozmiar bundla (code-splitting tras; cel: pierwszy ekran pracownika < ~200 kB gzip JS), zero błędów TypeScript/ESLint, `git grep -niE "TODO|FIXME|MOCK|PLACEHOLDER|NOT IMPLEMENTED|lorem ipsum|console\.log"` bez trafień w `src/` i `supabase/`.

**Weryfikacja:**
```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```
Dopiero gdy wszystko jest zielone → **DEPLOY**: migracje na projekt produkcyjny (`supabase db push`), sekrety (`supabase secrets set …`), wdrożenie funkcji (`supabase functions deploy …`), harmonogram pg_cron, frontend na Vercel (zmienne `VITE_*`), konfiguracja domeny/HTTPS, utworzenie konta właściciela wg `docs/SETUP.md`, **test dymny na produkcji** (login, zgłoszenie braku, odhaczenie zadania, mail testowy z ustawień) i usunięcie danych testowych.
Zapewnij kopie zapasowe (Supabase PITR/daily backups włączone) i opisz w `docs/SETUP.md` procedurę przywrócenia.

---

## 21. CHECKLISTA PRZED UDOSTĘPNIENIEM (`docs/CHECKLIST.md`)

```
[ ] Login / reset hasła      [ ] Role i guardy        [ ] RLS (testy zielone)
[ ] Magazyn                  [ ] Ruchy magazynowe     [ ] Braki
[ ] Lista zakupów            [ ] E-mail (21:00)       [ ] Zadania + szablony
[ ] Dashboard                [ ] PWA (Android/iOS/desktop) [ ] Mobile 360–430
[ ] Desktop                  [ ] OCR + weryfikacja    [ ] Historia cen
[ ] Audit log                [ ] Testy (T1–T20)       [ ] Security (sekcja 14)
[ ] Production build         [ ] Backupy              [ ] Dokumentacja (sekcja 22)
```
Każdy punkt oznaczaj `[x]` wyłącznie po wykonaniu i sprawdzeniu, z linkiem/dowodem (komenda, test, zrzut). Jeśli którykolwiek element to `TODO`, `MOCK`, `PLACEHOLDER` lub `NOT IMPLEMENTED` → **aplikacja nie może zostać oznaczona jako gotowa**; napisz wprost, czego brakuje.

---

## 22. DOKUMENTACJA KOŃCOWA

- `docs/INSTRUKCJA_PRACOWNIK.md` (1 strona, ze zrzutami): 1) Zaloguj się. 2) Sprawdź zadania. 3) Odhacz wykonane. 4) Zgłoś brak, gdy czegoś brakuje. 5) Jak zainstalować aplikację na telefonie (Android/iPhone).
- `docs/INSTRUKCJA_MANAGER.md`: 1) Sprawdź braki. 2) Sprawdź magazyn. 3) Sprawdź zadania. 4) Zatwierdź zakupy. 5) Inwentaryzacja i korekty.
- `docs/INSTRUKCJA_WLASCICIEL.md`: Dashboard · Zakupy · Ceny · Magazyn · Raporty · Pracownicy · Ustawienia · Audyt.
- `docs/SETUP.md` (instalacja od zera, zmienne, sekrety, pierwszy właściciel, cron, deploy, backup/restore), `docs/DECISIONS.md`, `docs/SCHEMA.md`, `docs/UX_REVIEW.md`, `docs/CHECKLIST.md`.
Język instrukcji: prosty, bez żargonu technicznego, krótkie zdania.

---

## 23. FORMAT RAPORTU PO KAŻDEJ FAZIE

```
FAZA N — RAPORT
Zrobione:        (lista funkcji, które DZIAŁAJĄ i zostały sprawdzone)
Testy:           (komendy + wynik; liczba zielonych/czerwonych)
Nie zrobione:    (co pominięto i DLACZEGO — uczciwie)
Założenia:       (co przyjęto bez pytania; link do DECISIONS.md)
Ryzyka/uwagi:    (co może zawieść w produkcji)
Bramka N:        ZALICZONA / NIE ZALICZONA (które punkty)
Następny krok:   (FAZA N+1, pierwsze 3 zadania)
```

---

## 24. START — CO ZROBIĆ TERAZ

1. **Przeanalizuj środowisko:** sprawdź zawartość repozytorium (jeśli coś już istnieje — rozbuduj, nie nadpisuj), dostępne narzędzia (Node, npm, Supabase CLI), konfigurację projektu Supabase. Brakujące dane dostępowe zgłoś jako blokadę *po* wykonaniu wszystkiego, co od nich nie zależy.
2. **Etap bez kodu:** wygeneruj `docs/PLAN.md` — opis każdego ekranu (cel, dane, akcje, stany, uprawnienia), mapę nawigacji per rola, listę plików/migracji dla FAZY 1 i rejestr założeń (`docs/DECISIONS.md`).
3. Jeśli nie masz **pytań blokujących**, nie czekaj na akceptację — zapisz założenia i przejdź do **FAZY 1, krok 1** (sekcja 15). Pytaj tylko wtedy, gdy bez odpowiedzi praca byłaby bezużyteczna lub niebezpieczna (np. brak dostępu do bazy).
4. Realizuj FAZĘ 1 do **bramki 1**, złóż raport (sekcja 23) i **zatrzymaj się** z komunikatem: „Bramka 1 zaliczona — aplikacja gotowa do wdrożenia dla pracowników. Po 1–2 tygodniach użycia zbierz uwagi; FAZA 2 startuje po Twojej decyzji.”
5. Dalej kontynuuj fazami 2 → 6 według sekcji 3 i 18, każdą zamykając bramką i raportem.

**Pamiętaj:** stabilność > prostota > użyteczność > wygląd > dodatkowe funkcje. Nie buduj wszystkiego naraz. Nie udawaj, że coś działa. Najpierw wartość dla pracownika, potem reszta.
