-- ============================================================================
-- 0019_sales_header_and_line_alignment.sql — Iyanuoluwa Vegetable & Palm Oil Depot
--
-- 0008_relational_hardening.sql closed with a deliberate deferral, quoted here
-- because this file is that follow-up pass:
--
--   "sale_payments.sale_id has no FK because the `sales` table it should
--    reference doesn't exist in any migration (0007's `alter table if exists
--    sales ...` silently no-ops). Adding that FK means first designing a
--    `sales` header table — a real data-modeling decision, not a mechanical
--    hardening fix — so it's left for a separate pass."
--
-- The React app has always modelled a sale as ONE header (`Sale`) plus N lines
-- (`Order`, grouped by `Order.sale_id`), while the schema only ever had the
-- line table. So a split-tender sale had nowhere to record `amount_tendered` /
-- `change_due` / `cashier_name` / the void audit trail, and every line carried
-- a `sale_id` pointing at nothing.
--
-- The line columns added below MIRROR the app instead of reusing the legacy
-- `keg_source`/`keg_price`/`keg_amount` trio, because they are genuinely
-- different concepts: `KegSource` = ('company','own','purchased') describes
-- WHOSE keg it is, whereas the app's `ContainerMode` = ('taken','bought',
-- 'none') describes WHAT HAPPENED to the container on this sale. The legacy
-- columns are left in place (nullable, unwritten by the app) so nothing that
-- reads them breaks.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1. container_mode — the app's ContainerMode string union
-- ---------------------------------------------------------------------------
do $$ begin create type container_mode as enum ('taken','bought','none'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. sales — the sale header every `orders.sale_id` belongs to
-- ---------------------------------------------------------------------------
create table if not exists sales (
  id               text primary key,                      -- 'sale-<ts>'
  customer_id      text not null references customers(id) on delete restrict,
  date             timestamptz not null default now(),
  payment_method   payment_method not null,               -- cash | transfer | pos | credit | split
  payment_splits   jsonb,                                 -- [{"method":"cash","amount":25000},…] for 'split'
  amount_tendered  numeric(14,2),                         -- cash leg tendered, when recorded
  change_due       numeric(14,2),
  cashier_name     text,
  note             text,
  credit_term_days int,
  due_date         timestamptz,
  voided           boolean not null default false,
  voided_at        timestamptz,
  voided_by        text,
  void_reason      text,
  hub_id           text,                                  -- text, per 0009
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_sales_date        on sales(date);
create index if not exists idx_sales_customer_id on sales(customer_id);
create index if not exists idx_sales_hub_id      on sales(hub_id);

comment on table sales is
  'One row per counter sale (the header). Line items live in `orders`, grouped by orders.sale_id; tender legs in `sale_payments`.';
comment on column sales.payment_splits is
  'Split-tender breakdown, identical in shape to orders.payment_splits: [{"method":"cash","amount":25000},{"method":"credit","amount":10000}].';

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger — 0001 attaches this to every table via a DO loop, so
--    tables created after it must attach it themselves. Without this, sync's
--    last-write-wins merge (keyed on updated_at) would never see an edit.
-- ---------------------------------------------------------------------------
drop trigger if exists set_updated_at on sales;
create trigger set_updated_at before update on sales
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. orders.sale_id — the line → header link the app has always written
-- ---------------------------------------------------------------------------
alter table if exists orders add column if not exists sale_id text;

do $$ begin
  alter table orders add constraint orders_sale_id_fkey
    foreign key (sale_id) references sales(id) on delete cascade;
exception when duplicate_object then null; end $$;

create index if not exists idx_orders_sale_id on orders(sale_id);

comment on column orders.sale_id is
  'Parent sale header. Moved here from 0008''s deferred list, which flagged the missing `sales` table as a data-modeling decision rather than a mechanical fix.';

-- ---------------------------------------------------------------------------
-- 5. orders — pack-priced line fields the app writes
--    (`unit_price` is per PACK, which is why it cannot reuse `rate`)
-- ---------------------------------------------------------------------------
alter table if exists orders
  add column if not exists pack_size_id          text,           -- 'sz_25' … (FK-free: pack sizes are app constants)
  add column if not exists unit_price            numeric(12,2),  -- price for ONE pack at this tier
  add column if not exists original_unit_price   numeric(12,2),  -- matrix price before any counter override
  add column if not exists price_adjusted        boolean not null default false,
  add column if not exists price_adjust_reason   text,           -- required by the app when price_adjusted
  add column if not exists oil_amount            numeric(14,2),  -- qty * unit_price (excludes container)
  add column if not exists returnable            boolean,        -- snapshot of pack_config at sale time
  add column if not exists container_mode        container_mode,
  add column if not exists container_unit_price  numeric(12,2),  -- snapshot of container_buy_price
  add column if not exists container_amount      numeric(14,2),  -- qty * container_unit_price when 'bought'
  add column if not exists credit_term_days      int,
  add column if not exists voided                boolean not null default false,
  add column if not exists voided_at             timestamptz,
  add column if not exists voided_by             text,
  add column if not exists void_reason           text;

create index if not exists idx_orders_pack_size_id on orders(pack_size_id);

-- `unit` was NOT NULL, but a pack-priced line has no litre/keg/ton unit: its
-- unit is a PACK SIZE (pack_size_id + qty). Storing a fabricated 'keg' for a
-- 500ml bottle line would be worse than storing NULL, so the constraint is
-- relaxed and documented rather than satisfied with a lie.
alter table if exists orders alter column unit drop not null;
comment on column orders.unit is
  'Bulk movements only (litre/keg/ton). NULL for pack-priced lines, which are described by pack_size_id + qty.';
comment on column orders.rate is
  'Per-litre equivalent actually charged (oil_amount / litres) for bulk rate cards. The per-PACK price the counter actually uses lives in unit_price.';

-- ---------------------------------------------------------------------------
-- 6. sale_payments.sale_id → sales(id) — the FK 0008 deferred
-- ---------------------------------------------------------------------------
do $$ begin
  alter table sale_payments add constraint sale_payments_sale_id_fkey
    foreign key (sale_id) references sales(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 7. RLS on sales — read-all for authenticated (0002), staff/owner write
--    (0002's transactional pattern), plus hub isolation (0004/0009 shape).
-- ---------------------------------------------------------------------------
alter table sales enable row level security;

drop policy if exists read_all_sales on sales;
create policy read_all_sales on sales
  for select to authenticated
  using (true);

drop policy if exists staff_insert_sales on sales;
create policy staff_insert_sales on sales
  for insert to authenticated
  with check (app_current_role() in ('staff', 'owner'));

drop policy if exists staff_update_sales on sales;
create policy staff_update_sales on sales
  for update to authenticated
  using (app_current_role() in ('staff', 'owner'))
  with check (app_current_role() in ('staff', 'owner'));

drop policy if exists hub_isolation_sales on sales;
create policy hub_isolation_sales on sales
  for all to authenticated
  using (
    app_is_owner() or
    hub_id is null or
    hub_id = app_current_hub_id()
  )
  with check (
    app_is_owner() or
    hub_id is null or
    hub_id = app_current_hub_id()
  );

RESET ROLE;
