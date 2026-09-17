-- ============================================================================
-- 0008_relational_hardening.sql — Iyanuoluwa Vegetable & Palm Oil Depot
-- Closes gaps found in a full relational-integrity audit of 0001–0007:
--   1. sale_payments (added in 0007) never had RLS enabled — the only
--      created table in the whole schema left that way.
--   2. transfers got hub_id columns + indexes in 0004 but never got the
--      hub_isolation policy every other hub-scoped table received.
--   3. hub_isolation_pumps / hub_isolation_physical_tanks (0004) are FOR ALL
--      policies that stack (OR) with 0002's owner-only write policies for
--      those same tables, silently letting any hub-matched non-owner write
--      to what 0002 documents as owner-only catalogue/config tables. Narrowed
--      to FOR SELECT so hub-scoped read visibility stays, owner-only write
--      is restored. (This resolves an apparent oversight, not a stated
--      requirement — easy to revert to FOR ALL below if the wider write
--      access was actually intended.)
--   4. Several FK columns were missing an index (Postgres does not auto-index
--      foreign keys): tanks.physical_tank_id, pumps.product_id,
--      orders.variety_id, orders.source_tank_id, transfers.product_id,
--      expenses.customer_id.
--
-- Deliberately NOT addressed here: sale_payments.sale_id has no FK because
-- the `sales` table it should reference doesn't exist in any migration
-- (0007's `alter table if exists sales ...` silently no-ops). Adding that FK
-- means first designing a `sales` header table — a real data-modeling
-- decision, not a mechanical hardening fix — so it's left for a separate pass.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on sale_payments, mirroring the staff-writable transactional
--    table pattern from 0002 (read-all authenticated; staff/owner insert+update).
-- ---------------------------------------------------------------------------
alter table sale_payments enable row level security;

drop policy if exists read_all_sale_payments on sale_payments;
create policy read_all_sale_payments on sale_payments
  for select to authenticated
  using (true);

drop policy if exists staff_insert_sale_payments on sale_payments;
create policy staff_insert_sale_payments on sale_payments
  for insert to authenticated
  with check (app_current_role() in ('staff', 'owner'));

drop policy if exists staff_update_sale_payments on sale_payments;
create policy staff_update_sale_payments on sale_payments
  for update to authenticated
  using (app_current_role() in ('staff', 'owner'))
  with check (app_current_role() in ('staff', 'owner'));

-- ---------------------------------------------------------------------------
-- 2. hub_isolation_transfers — transfers already has from_hub_id/to_hub_id
--    (+ indexes) from 0004, it just never got the isolation policy.
-- ---------------------------------------------------------------------------
drop policy if exists hub_isolation_transfers on transfers;
create policy hub_isolation_transfers on transfers
  for all to authenticated
  using (
    app_is_owner() or
    (from_hub_id is null and to_hub_id is null) or
    from_hub_id = app_current_hub_id() or
    to_hub_id = app_current_hub_id()
  )
  with check (
    app_is_owner() or
    (from_hub_id is null and to_hub_id is null) or
    from_hub_id = app_current_hub_id() or
    to_hub_id = app_current_hub_id()
  );

-- ---------------------------------------------------------------------------
-- 3. Narrow hub_isolation_pumps / hub_isolation_physical_tanks to read-only.
--    0002's owner_insert_/owner_update_/owner_delete_ policies for these two
--    tables remain the sole write gate; the hub_isolation policies from 0004
--    only add hub-scoped read visibility now, instead of also granting write
--    access to any hub-matched non-owner.
-- ---------------------------------------------------------------------------
drop policy if exists hub_isolation_pumps on pumps;
create policy hub_isolation_pumps on pumps
  for select to authenticated
  using (
    app_is_owner() or
    hub_id is null or
    hub_id = app_current_hub_id()
  );

drop policy if exists hub_isolation_physical_tanks on physical_tanks;
create policy hub_isolation_physical_tanks on physical_tanks
  for select to authenticated
  using (
    app_is_owner() or
    hub_id is null or
    hub_id = app_current_hub_id()
  );

-- ---------------------------------------------------------------------------
-- 4. Missing indexes on foreign key columns.
-- ---------------------------------------------------------------------------
create index if not exists idx_tanks_physical_tank_id on tanks(physical_tank_id);
create index if not exists idx_pumps_product_id on pumps(product_id);
create index if not exists idx_orders_variety_id on orders(variety_id);
create index if not exists idx_orders_source_tank_id on orders(source_tank_id);
create index if not exists idx_transfers_product_id on transfers(product_id);
create index if not exists idx_expenses_customer_id on expenses(customer_id);

RESET ROLE;
