-- ============================================================================
-- 0021_walkin_customer_and_per_hub_open_shift.sql — Iyanuoluwa Vegetable & Palm Oil Depot
--
-- Two small corrections that only matter once transactional writes start
-- reaching the database, both of which would fail at runtime rather than at
-- migration time.
--
--   1. THE WALK-IN CUSTOMER MUST BE A REAL ROW. The app has a synthetic
--      `ONE_TIME_CUSTOMER_ID = 'cust-walkin'` (src/constants/config.ts:306)
--      that it injects into its local customer list and writes every walk-in
--      sale against. `orders.customer_id` is `references customers(id) on
--      delete restrict`, so without this row EVERY walk-in sale fails its FK
--      and syncs nowhere. Seeded with a 0 credit limit and 0 term days, which
--      matches the app's own rules (a walk-in cannot buy on debt —
--      createSale() rejects `isDebtInvolved` for this id).
--
--   2. ONE OPEN SHIFT PER HUB, NOT PER DATABASE. 0001 created
--      `uniq_one_open_shift on shifts (status) where status = 'open'` when
--      the depot was single-site. 0004 then added `shifts.hub_id`, which
--      silently turned that into a global lock: whichever hub opened a shift
--      first blocked every other hub's startShift() with a unique violation
--      about an index it never mentions.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1a. customers.hub_id — the app's Customer carries one, so without the column
--     every addCustomer()/updateCustomer() payload fails with
--     "column customers.hub_id does not exist". Informational only: customers
--     are depot-wide (they buy from whichever hub they turn up at), so this is
--     deliberately NOT a hub_isolation gate.
-- ---------------------------------------------------------------------------
alter table if exists customers add column if not exists hub_id text;

create index if not exists idx_customers_hub_id on customers(hub_id);

comment on column customers.hub_id is
  'Hub the customer record was created at. Informational — customers are depot-wide and are deliberately not hub-isolated.';

-- ---------------------------------------------------------------------------
-- 1b. The walk-in customer row itself. Idempotent, so re-running is safe.
-- ---------------------------------------------------------------------------
insert into customers (id, name, type, credit_limit, credit_term_days, phone)
values ('cust-walkin', 'Walk-in Customer', 'retail', 0, 0, '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Replace the global open-shift lock with a per-hub one.
-- ---------------------------------------------------------------------------
drop index if exists uniq_one_open_shift;

create unique index if not exists uniq_one_open_shift_per_hub
  on shifts (hub_id) where status = 'open';

comment on index uniq_one_open_shift_per_hub is
  'At most one open shift per hub (was global before hub_id existed in 0004). NULL hub_id rows still share a single slot.';

RESET ROLE;
