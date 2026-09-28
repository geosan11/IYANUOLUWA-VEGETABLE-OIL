-- ============================================================================
-- 0024_inventory_grant_products.sql — Iyanuoluwa Vegetable & Palm Oil Depot
--
-- Bug: 0011 moved the write policies on products/product_varieties to
-- `app_can_operate('settings')`, but 0020 gave pack_prices — the other half of
-- the very same screen — `app_can_operate('inventory')`. All three tables are
-- edited from Inventory → Products & Pricing, whose client gate is
-- `isOwner || canOperate('inventory')` (InventoryScreen.tsx): a member granted
-- the Inventory screen but not Settings could therefore open the screen and
-- save a pack price, then have the product/variety save it belongs to rejected
-- by RLS with a "didn't sync" toast — a half-applied pricing change.
--
-- Fix: those two tables now accept either grant — the screen that owns the
-- write ('inventory') or the Settings screen's own product editor ('settings',
-- which is exactly 0011's behaviour, unchanged). Nothing else moves:
-- suppliers / physical_tanks / pumps / app_settings stay settings-granted, and
-- creating accounts, creating/deleting hubs and the factory reset stay hard
-- owner-only.
--
-- Deliberately NOT fixed here, so it isn't mistaken for an oversight: the
-- same screen's "Containers" tab saves the company keg price / keg deposit
-- through `updateSettings` (InventoryScreen.tsx `handleSaveContainerPrices`) —
-- i.e. two columns of `app_settings`, which stays settings-granted. Widening
-- that whole table to the 'inventory' grant would also hand an
-- inventory-only member thresholds, company profile, density and the shift
-- schedule over the REST API, not just those two figures. An inventory-granted
-- member saving that one tab therefore still gets "saved on this device only —
-- didn't sync" until the owner decides between: grant Settings as well, scope
-- that tab behind the Settings grant in the UI, or split those two columns out
-- of `app_settings`.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

do $$
declare
  t text;
  inventory_tables text[] := array['products', 'product_varieties'];
begin
  foreach t in array inventory_tables loop
    -- Policy names are kept identical to 0011's so this is a re-point, not a
    -- second silently-permissive policy on the same table.
    execute format('drop policy if exists %I on %I', 'owner_insert_'||t, t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (app_can_operate(''inventory'') or app_can_operate(''settings''))',
      'owner_insert_'||t, t
    );
    execute format('drop policy if exists %I on %I', 'owner_update_'||t, t);
    execute format(
      'create policy %I on %I for update to authenticated using (app_can_operate(''inventory'') or app_can_operate(''settings'')) with check (app_can_operate(''inventory'') or app_can_operate(''settings''))',
      'owner_update_'||t, t
    );
    execute format('drop policy if exists %I on %I', 'owner_delete_'||t, t);
    execute format(
      'create policy %I on %I for delete to authenticated using (app_can_operate(''inventory'') or app_can_operate(''settings''))',
      'owner_delete_'||t, t
    );
  end loop;
end $$;

RESET ROLE;
