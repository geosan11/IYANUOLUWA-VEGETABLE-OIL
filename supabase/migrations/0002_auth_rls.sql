-- ============================================================================
-- 0002_auth_rls.sql  —  Auth profiles, role helper, Row Level Security.
-- Depends on 0001_init.sql. PostgreSQL 15 / Supabase (needs the `auth` schema).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles : one row per Supabase auth user, carrying their app role and the
-- per-user preferences that today live only in localStorage.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'staff',   -- least privilege by default (app localStorage default is 'owner')
  full_name       text,
  -- preferences currently persisted client-side only (see Gaps in SCHEMA.md):
  theme           text not null default 'light' check (theme in ('light','dark')),
  ai_provider     text,                                  -- 'gemini' | 'claude'   (iyanuoluwa_ai_provider_pref)
  ai_gemini_model text,                                  -- iyanuoluwa_ai_gemini_model
  ai_claude_model text,                                  -- iyanuoluwa_ai_claude_model
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists set_updated_at on profiles;
create trigger set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helper.
-- The brief calls this `current_role()`, but that name collides with the
-- built-in PostgreSQL function `current_role`, so it is named
-- `app_current_role()`. It MUST be SECURITY DEFINER: it reads `profiles`, and
-- calling it from inside a `profiles` RLS policy would otherwise recurse.
-- Running as the definer bypasses RLS and breaks the cycle.
-- ---------------------------------------------------------------------------
create or replace function app_current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Convenience predicate.
create or replace function app_is_owner()
returns boolean
language sql
stable
as $$
  select app_current_role() = 'owner';
$$;

-- ---------------------------------------------------------------------------
-- Auto-provision a profile row when a new auth user is created.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================
-- Model:
--   * Every authenticated user may SELECT every operational table.
--   * staff + owner may INSERT/UPDATE the operational transaction tables.
--   * owner may INSERT/UPDATE/DELETE the catalogue/config tables.
--   * driver may INSERT into `tanks` (truck intake) and read everything else.
--   * No DELETE on transaction tables (append-only); corrections go through
--     a future SECURITY DEFINER RPC (see stubs at the bottom).
-- app_current_role() returns NULL for a user with no profile row, so every
-- `role in (...)` test fails closed.
-- ===========================================================================

-- 1. Enable RLS + a blanket authenticated-read policy on every operational table.
do $$
declare
  t text;
  all_tables text[] := array[
    'products','product_varieties','suppliers','physical_tanks','rate_cards',
    'expense_categories','customers','tanks','pumps','pump_readings','orders',
    'order_tank_allocations','keg_returns','transfers','customer_credits',
    'tank_dipstick_readings','shifts','expenses','app_settings'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', 'read_all_'||t, t);
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      'read_all_'||t, t
    );
  end loop;
end $$;

-- 2. staff + owner : INSERT/UPDATE on the transaction tables.
do $$
declare
  t text;
  staff_tables text[] := array[
    'orders','order_tank_allocations','keg_returns','transfers',
    'tank_dipstick_readings','pump_readings','expenses','shifts',
    'customer_credits','customers'
  ];
begin
  foreach t in array staff_tables loop
    execute format('drop policy if exists %I on %I', 'staff_insert_'||t, t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (app_current_role() in (''staff'',''owner''))',
      'staff_insert_'||t, t
    );
    execute format('drop policy if exists %I on %I', 'staff_update_'||t, t);
    execute format(
      'create policy %I on %I for update to authenticated using (app_current_role() in (''staff'',''owner'')) with check (app_current_role() in (''staff'',''owner''))',
      'staff_update_'||t, t
    );
  end loop;
end $$;

-- 3. `tanks` : staff + owner + driver may INSERT (intake); staff + owner may UPDATE
--    (FIFO draw decrements, dipstick cache). No driver UPDATE.
drop policy if exists intake_insert_tanks on tanks;
create policy intake_insert_tanks on tanks
  for insert to authenticated
  with check (app_current_role() in ('staff','owner','driver'));

drop policy if exists staff_update_tanks on tanks;
create policy staff_update_tanks on tanks
  for update to authenticated
  using (app_current_role() in ('staff','owner'))
  with check (app_current_role() in ('staff','owner'));

-- 4. owner-only : INSERT/UPDATE/DELETE on catalogue + configuration tables.
do $$
declare
  t text;
  owner_tables text[] := array[
    'products','product_varieties','rate_cards','suppliers','physical_tanks',
    'pumps','app_settings','expense_categories'
  ];
begin
  foreach t in array owner_tables loop
    execute format('drop policy if exists %I on %I', 'owner_insert_'||t, t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (app_current_role() = ''owner'')',
      'owner_insert_'||t, t
    );
    execute format('drop policy if exists %I on %I', 'owner_update_'||t, t);
    execute format(
      'create policy %I on %I for update to authenticated using (app_current_role() = ''owner'') with check (app_current_role() = ''owner'')',
      'owner_update_'||t, t
    );
    execute format('drop policy if exists %I on %I', 'owner_delete_'||t, t);
    execute format(
      'create policy %I on %I for delete to authenticated using (app_current_role() = ''owner'')',
      'owner_delete_'||t, t
    );
  end loop;
end $$;

-- 5. profiles : self-read (+ owner reads all); self-insert; owner manages roles.
alter table profiles enable row level security;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select to authenticated
  using (id = auth.uid() or app_current_role() = 'owner');

drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles
  for insert to authenticated
  with check (id = auth.uid());

-- A user may update their own row (preference columns); the trigger below
-- blocks non-owners from escalating their own `role`.
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_owner_update on profiles;
create policy profiles_owner_update on profiles
  for update to authenticated
  using (app_current_role() = 'owner')
  with check (app_current_role() = 'owner');

drop policy if exists profiles_owner_delete on profiles;
create policy profiles_owner_delete on profiles
  for delete to authenticated
  using (app_current_role() = 'owner');

-- Block non-owners from changing their own role (policy above lets them
-- update their own row for preferences). SECURITY DEFINER so app_current_role()
-- does not recurse through profiles RLS.
create or replace function profiles_guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(app_current_role(), 'staff') <> 'owner' then
    raise exception 'Only an owner can change a profile role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
  before update on profiles
  for each row execute function profiles_guard_role_change();

-- ===========================================================================
-- SECURITY DEFINER RPC STUBS  (signatures only — bodies intentionally deferred)
-- ===========================================================================
-- These operations must be revalidated server-side once the app writes to
-- Postgres. Each should be `security definer`, `set search_path = public`, and
-- perform its own role check via app_current_role().
--
-- -- Recompute the FIFO oil draw authoritatively (client cannot be trusted to
-- -- pick tanks / amounts), decrement tanks, and write order_tank_allocations
-- -- rows, all in one transaction. Returns the allocation breakdown.
-- create or replace function revalidate_fifo_tank_draw(
--   p_order_id       text,
--   p_product_id     text,
--   p_required_litres numeric
-- ) returns table (tank_id text, drawn_litres numeric, remaining_after numeric)
-- language plpgsql security definer set search_path = public as $$ begin
--   -- ... lock product tanks `for update` ordered by date, drain FIFO, insert
--   --     order_tank_allocations, raise on insufficient stock ...
-- end $$;
--
-- -- Owner approves an order whose rate is below the standard rate card, or that
-- -- pushes a customer over their credit limit. Records who/why.
-- create or replace function approve_credit_override(
--   p_order_id text,
--   p_reason   text
-- ) returns void
-- language plpgsql security definer set search_path = public as $$ begin
--   -- ... assert app_current_role() = 'owner'; stamp approval columns / audit_log ...
-- end $$;
--
-- -- Post a customer payment: FIFO-allocate across open invoices into the future
-- -- payments + payment_allocations tables, bump orders.paid_amount, and push any
-- -- leftover to customer_credits — atomically.
-- create or replace function post_customer_payment(
--   p_customer_id text,
--   p_amount      numeric,
--   p_method      payment_method
-- ) returns jsonb
-- language plpgsql security definer set search_path = public as $$ begin
--   -- ... see applyFifoPayment() in src/services/businessLogic.ts ...
-- end $$;
--
-- -- Owner-only "factory reset": truncate operational tables and re-seed demo
-- -- data (server-side equivalent of resetToSeedData()).
-- create or replace function factory_reset() returns void
-- language plpgsql security definer set search_path = public as $$ begin
--   -- ... assert owner; truncate ... restart identity cascade; re-run seed ...
-- end $$;
