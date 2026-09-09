-- ============================================================================
-- 0001_init.sql  —  Iyanuoluwa Vegetable & Palm Oil Depot
-- Core relational schema (operational tables).  PostgreSQL 15 / Supabase.
--
-- ID STRATEGY -----------------------------------------------------------------
-- The React app already generates human-readable ids client-side
-- ('ord-…', 'cust-…', 'tank-…', 'p-1', 'veg', …) and persists them in
-- localStorage.  To keep those ids stable when the data is migrated to Postgres
-- (and to keep receipts / waybills that quote them valid) every primary key is
-- `text`, supplied by the client.
--   Trade-off: `text` PKs are wider than `uuid`, are not guaranteed globally
--   unique across environments, and let a client pick a colliding id. When the
--   app is wired to Supabase the recommended path is to switch inserts to
--   `uuid default gen_random_uuid()` and treat the legacy `*-…` strings as a
--   nullable `legacy_id text unique` column. Until then, `text` PKs are the
--   faithful representation of what the app stores.
--
-- Every table carries `created_at` + `updated_at timestamptz default now()`;
-- `updated_at` is maintained by the shared `set_updated_at()` trigger below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUM TYPES  (mirrors the string unions in src/types/index.ts)
-- ---------------------------------------------------------------------------
do $$ begin create type customer_type      as enum ('retail','agent','corporate');            exception when duplicate_object then null; end $$;
do $$ begin create type unit_type          as enum ('litre','keg','ton');                     exception when duplicate_object then null; end $$;
do $$ begin create type payment_method     as enum ('cash','transfer','credit','pos');        exception when duplicate_object then null; end $$;
do $$ begin create type keg_source         as enum ('company','own','purchased');             exception when duplicate_object then null; end $$;
--   NB: TS `KegSource` also allows `null`; that is modelled by a NULLable column,
--   not an enum member.
do $$ begin create type user_role          as enum ('owner','staff','driver');                exception when duplicate_object then null; end $$;
do $$ begin create type supply_model       as enum ('bulk_truck','pre_kegged');               exception when duplicate_object then null; end $$;
do $$ begin create type shift_status       as enum ('open','closed');                         exception when duplicate_object then null; end $$;
do $$ begin create type transfer_item_type as enum ('keg');                                   exception when duplicate_object then null; end $$;
--   `transfer_item_type` is a 1-value enum today (kegs only) but kept as an
--   enum so 'litres' etc. can be added later without a column rewrite.

-- ---------------------------------------------------------------------------
-- SHARED updated_at TRIGGER FUNCTION
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- CATALOGUE / REFERENCE DATA
-- ===========================================================================

-- products ------------------------------------------------------------------
create table if not exists products (
  id              text primary key,                       -- 'veg' | 'red' | 'prod-<ts>'
  name            text        not null,
  supply_model    supply_model not null default 'bulk_truck',
  litres_per_ton  numeric(10,2),                          -- NULL for pre_kegged products
  litres_per_keg  numeric(10,2) not null,                 -- per-product keg capacity
  keg_sell_price  numeric(12,2),                          -- outright price for the physical container; NULL = not sold
  color_light     text        not null,
  color_dark      text        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint products_litres_per_ton_positive check (litres_per_ton is null or litres_per_ton > 0),
  constraint products_bulk_needs_lpt check (supply_model <> 'bulk_truck' or litres_per_ton is not null)
);
comment on table products is 'Product catalogue. supply_model bulk_truck = dispensed from bulk tanks via pumps; pre_kegged = received & sold as sealed kegs.';

-- product_varieties -------------------------------------------------------------
-- Modelled as a CHILD TABLE rather than a jsonb column on products because:
--   * orders.variety_id needs a real FK (referential integrity + cascade rules);
--   * the pricing math joins varieties to add rate_delta_per_litre;
--   * varieties are edited, reported on, and filtered individually;
--   * a jsonb blob would force every consumer to re-parse and could not be
--     referenced by other rows.
create table if not exists product_varieties (
  id                   text primary key,                  -- 'veg-soya', 'red-edo', …
  product_id           text not null references products(id) on delete cascade,
  name                 text not null,
  rate_delta_per_litre numeric(12,2) not null default 0,  -- added to the tier rate; may be negative
  sort_order           int  not null default 0,           -- lowest sort_order = the product default
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_product_varieties_product on product_varieties(product_id);

-- suppliers ---------------------------------------------------------------------
create table if not exists suppliers (
  id         text primary key,
  name       text not null,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- physical_tanks --------------------------------------------------------------
-- Fixed yard storage vessels (distinct from `tanks`, which are truck intake batches).
create table if not exists physical_tanks (
  id              text primary key,
  label           text not null,
  product_id      text not null references products(id) on delete restrict,
  capacity_litres numeric(12,2) not null check (capacity_litres > 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_physical_tanks_product on physical_tanks(product_id);

-- rate_cards ----------------------------------------------------------------
-- TS interface has no `id`; the natural key is (product_id, tier).
create table if not exists rate_cards (
  product_id     text not null references products(id) on delete cascade,
  tier           customer_type not null,
  rate_per_litre numeric(12,2) not null check (rate_per_litre >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (product_id, tier)
);

-- expense_categories --------------------------------------------------------
-- Was a hard-coded array (EXPENSE_CATEGORIES in config.ts). Promoted to a
-- lookup table so the UI dropdown is data-driven and owners can curate it.
-- expenses.category is intentionally NOT a FK — addExpense() accepts free text.
create table if not exists expense_categories (
  name       text primary key,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- PARTIES
-- ===========================================================================

-- customers ---------------------------------------------------------------------
create table if not exists customers (
  id               text primary key,                      -- 'cust-1', 'cust-<ts>'
  name             text not null,
  type             customer_type not null,
  credit_limit     numeric(14,2) not null default 0,
  credit_term_days int  not null default 14,
  phone            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ===========================================================================
-- INVENTORY / EQUIPMENT
-- ===========================================================================

-- tanks -------------------------------------------------------------------------
-- One row per truck intake batch. FIFO oil draw decrements remaining_litres.
create table if not exists tanks (
  id                     text primary key,                -- 'tank-v1', 'tank-<ts>'
  product_id             text not null references products(id) on delete restrict,
  truck_label            text not null,
  tons                   numeric(10,3) not null default 0, -- 0 for pre_kegged intake
  received_litres        numeric(12,2) not null,
  remaining_litres       numeric(12,2) not null,
  date                   timestamptz not null default now(),
  shortfall              numeric(12,2) not null default 0, -- expected - recovered litres
  supplier_id            text references suppliers(id) on delete set null,
  space_note             text,
  physical_tank_id       text references physical_tanks(id) on delete set null,
  supply_model           supply_model,
  last_dipstick_reading  numeric(12,2),                    -- denormalised cache of newest dipstick
  last_dipstick_variance numeric(12,2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint tanks_remaining_non_negative check (remaining_litres >= 0)
);
create index if not exists idx_tanks_product_date on tanks(product_id, date);   -- FIFO ordering
create index if not exists idx_tanks_supplier     on tanks(supplier_id);

-- pumps -----------------------------------------------------------------------
create table if not exists pumps (
  id                 text primary key,                    -- 'p-1', 'p-2'
  label              text not null,
  product_id         text references products(id) on delete set null,
  last_meter_reading numeric(14,2) not null default 0,    -- monotonic odometer cache
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- pump_readings ---------------------------------------------------------------
-- Append-only audit log of odometer readings (shift open/close, spot checks).
create table if not exists pump_readings (
  id          text primary key,                           -- 'pr-1', 'pr-<ts>'
  pump_id     text not null references pumps(id) on delete cascade,
  reading     numeric(14,2) not null,
  recorded_at timestamptz not null default now(),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_pump_readings_pump      on pump_readings(pump_id);
create index if not exists idx_pump_readings_pump_time on pump_readings(pump_id, recorded_at);

-- ===========================================================================
-- TRANSACTIONS
-- ===========================================================================

-- orders --------------------------------------------------------------------
create table if not exists orders (
  id             text primary key,                        -- 'ord-101', 'ord-<ts>'
  customer_id    text not null references customers(id) on delete restrict,
  product_id     text not null references products(id)  on delete restrict,
  unit           unit_type      not null,
  qty            numeric(12,2)  not null check (qty >= 0),
  litres         numeric(12,2)  not null check (litres >= 0),
  rate           numeric(12,2)  not null,                 -- effective rate/litre actually charged
  amount         numeric(14,2)  not null check (amount >= 0),
  paid_amount    numeric(14,2)  not null default 0 check (paid_amount >= 0),
  payment_method payment_method not null,
  keg_source     keg_source,                              -- NULL for non-keg units / unspecified
  keg_price      numeric(12,2),                           -- per-container price when keg_source='purchased'
  keg_amount     numeric(14,2),                           -- qty * keg_price
  discount_reason text,                                   -- required by app when rate < standard rate card
  pricing_tier   customer_type,                           -- tier the rate was drawn from (may be overridden at counter)
  variety_id     text references product_varieties(id) on delete set null,
  variety_name   text,                                    -- snapshot of the variety label at sale time
  date           timestamptz not null default now(),
  due_date       timestamptz,                             -- set only for payment_method='credit'
  source_tank_id text references tanks(id) on delete set null,  -- FIRST tank of the FIFO draw only (see order_tank_allocations)
  pump_id        text references pumps(id) on delete set null,
  meter_reading  numeric(14,2),
  meter_delta    numeric(14,2),                           -- meter_reading - previous reading
  meter_variance numeric(14,2),                           -- meter_delta - litres
  delivered_qty  numeric(12,3),
  shortfall      numeric(12,3),                            -- qty - delivered_qty
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_orders_date           on orders(date);
create index if not exists idx_orders_customer_id     on orders(customer_id);
create index if not exists idx_orders_payment_method  on orders(payment_method);
create index if not exists idx_orders_pump_id         on orders(pump_id);
create index if not exists idx_orders_due_date        on orders(due_date);
create index if not exists idx_orders_product_id      on orders(product_id);
comment on column orders.source_tank_id is 'Primary (first) tank of the FIFO draw. Full split provenance lives in order_tank_allocations.';

-- order_tank_allocations --------------------------------------------------------
-- NEW. The app''s FIFO draw can span several tanks but only records the first on
-- orders.source_tank_id, so split draws lose provenance. This child table keeps
-- the full per-tank breakdown of every order''s oil draw.
create table if not exists order_tank_allocations (
  id                   bigint generated always as identity primary key,
  order_id             text not null references orders(id) on delete cascade,
  tank_id              text not null references tanks(id)  on delete restrict,
  drawn_litres         numeric(12,2) not null check (drawn_litres > 0),
  remaining_after_draw numeric(12,2),                     -- tank level immediately after this draw; NULL if backfilled
  draw_sequence        int not null default 1,            -- 1 = oldest tank hit first
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (order_id, tank_id)
);
create index if not exists idx_ota_order on order_tank_allocations(order_id);
create index if not exists idx_ota_tank  on order_tank_allocations(tank_id);

-- keg_returns -----------------------------------------------------------------
-- Append-only log of company kegs handed back by customers.
create table if not exists keg_returns (
  id          text primary key,                           -- 'ret-1', 'ret-<ts>'
  customer_id text not null references customers(id) on delete restrict,
  qty         numeric(10,2) not null check (qty > 0),
  date        timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_keg_returns_customer_id on keg_returns(customer_id);

-- transfers -------------------------------------------------------------------
-- Direct customer-to-customer movement of company kegs (no depot yard impact).
create table if not exists transfers (
  id               text primary key,                      -- 'trf-1', 'tr-<ts>'
  from_customer_id text not null references customers(id) on delete restrict,
  to_customer_id   text not null references customers(id) on delete restrict,
  item_type        transfer_item_type not null default 'keg',
  qty              numeric(10,2) not null check (qty > 0),
  product_id       text references products(id) on delete set null,
  date             timestamptz not null default now(),
  note             text,                                  -- TS carried both `note` and `notes`; unified here
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint transfers_distinct_parties check (from_customer_id <> to_customer_id)
);
create index if not exists idx_transfers_from on transfers(from_customer_id);
create index if not exists idx_transfers_to   on transfers(to_customer_id);
create index if not exists idx_transfers_date on transfers(date);

-- customer_credits ----------------------------------------------------------
-- Append-only store-credit ledger. amount > 0 = credit added (overpayment);
-- amount < 0 = credit redeemed against invoices. Balance = SUM(amount), floored at 0.
create table if not exists customer_credits (
  id                text primary key,                     -- 'cc-<ts>'
  customer_id       text not null references customers(id) on delete restrict,
  amount            numeric(14,2) not null,
  source_payment_id text,                                 -- receipt/payment ref string (e.g. 'PAY-123456'); not a FK yet
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  note              text
);
create index if not exists idx_customer_credits_customer_id on customer_credits(customer_id);

-- tank_dipstick_readings --------------------------------------------------------
-- Physical stick measurement of a depot tank, audited against computed litres.
create table if not exists tank_dipstick_readings (
  id             text primary key,                        -- 'ds-1', 'dip-<ts>'
  tank_id        text not null references tanks(id) on delete cascade,
  reading_litres numeric(12,2) not null check (reading_litres >= 0),
  system_litres  numeric(12,2),                           -- tank.remaining_litres at reading time
  recorded_at    timestamptz not null default now(),
  variance       numeric(12,2),                           -- reading_litres - system_litres
  is_flagged     boolean not null default false,          -- |variance| over threshold (TS is_flagged == isOverThreshold)
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_dipstick_tank_id on tank_dipstick_readings(tank_id);
create index if not exists idx_dipstick_tank_time on tank_dipstick_readings(tank_id, recorded_at);

-- shifts --------------------------------------------------------------------
create table if not exists shifts (
  id               text primary key,                      -- 'shift-1', 'shift-<ts>'
  supervisor_name  text,
  cashier_name     text,
  start_time       timestamptz not null default now(),
  end_time         timestamptz,
  opening_float    numeric(14,2) not null default 0,
  opening_readings jsonb not null default '{}'::jsonb,     -- { "<pump_id>": <meter number>, ... }
  cash_sales       numeric(14,2),
  cash_expenses    numeric(14,2),
  expected_cash    numeric(14,2),                          -- opening_float + cash_sales - cash_expenses
  cash_counted     numeric(14,2),
  cash_variance    numeric(14,2),                          -- cash_counted - expected_cash
  note             text,                                   -- TS carried both `note` and `notes`; unified here
  status           shift_status not null default 'open',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_shifts_status on shifts(status);
-- Enforce the app rule "only one shift open at a time" (see startShift()).
create unique index if not exists uniq_one_open_shift on shifts (status) where status = 'open';
comment on column shifts.opening_readings is 'JSON object keyed by pump id -> opening odometer reading for the shift meter gate. Shape: {"p-1": 12450, "p-2": 8920}.';

-- expenses ------------------------------------------------------------------
create table if not exists expenses (
  id         text primary key,                            -- 'exp-1', 'exp-<ts>'
  date       timestamptz not null default now(),
  category   text not null,                               -- free text; expense_categories is a soft lookup only
  amount     numeric(14,2) not null check (amount > 0),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expenses_date     on expenses(date);
create index if not exists idx_expenses_category on expenses(category);

-- app_settings ------------------------------------------------------------------
-- Single-row table. `check (id = 1)` guarantees at most one row.
create table if not exists app_settings (
  id                         int primary key default 1 check (id = 1),
  company_name               text not null,
  company_phone              text not null,
  company_address            text not null,
  company_logo_url           text,
  litres_per_keg             numeric(10,2) not null,
  total_company_kegs         int  not null,
  kegs_at_depot_low_threshold int not null,
  low_stock_litres_threshold numeric(12,2) not null,
  truck_shortfall_threshold  numeric(12,2) not null,
  pump_variance_threshold    numeric(12,2) not null,
  dipstick_variance_threshold numeric(12,2) not null,
  default_daily_float        numeric(14,2) not null,
  daily_float                numeric(14,2) not null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ATTACH set_updated_at() TO EVERY TABLE
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'products','product_varieties','suppliers','physical_tanks','rate_cards',
    'expense_categories','customers','tanks','pumps','pump_readings','orders',
    'order_tank_allocations','keg_returns','transfers','customer_credits',
    'tank_dipstick_readings','shifts','expenses','app_settings'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function set_updated_at()',
      t
    );
  end loop;
end $$;
