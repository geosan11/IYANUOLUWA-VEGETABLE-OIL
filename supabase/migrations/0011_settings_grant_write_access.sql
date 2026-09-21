-- ============================================================================
-- 0011_settings_grant_write_access.sql
--
-- Bug: RLS on products/product_varieties/suppliers/physical_tanks/pumps/
-- app_settings (0002_auth_rls.sql) and on hubs' UPDATE (0004_multi_hub_hubs.sql)
-- is hard `role = 'owner'` only. That contradicts the app's own already-shipped
-- permission model: an owner can grant a hub_manager/staff member the
-- Settings screen (`profiles.allowed_screens` containing 'settings') and have
-- its ordinary CRUD actually work client-side (`denyIfNoSettingsAccess` in
-- SettingsScreen.tsx = isOwner || canOperate('settings')) — company profile,
-- keg config, products, tanks, pumps, suppliers, thresholds, shift schedule,
-- and *editing* (not creating/deleting) a hub. Reachable today: a
-- settings-granted non-owner's `updateHub` already gets a real
-- "...didn't sync to the database" toast, because hubs_owner_all blocks it.
--
-- Fix: a `app_can_operate(text)` helper mirroring the client's
-- `canOperate(screenId)` — true for the owner, or when that screen id is in
-- the caller's `allowed_screens` — used in place of the strict owner check
-- for these six tables' write policies, plus hubs' UPDATE only (hub
-- INSERT/DELETE, and everything user/profile/factory-reset related, stay
-- hard owner-only — unchanged, matching the client's own hard gates).
--
-- rate_cards and expense_categories are intentionally NOT touched here — the
-- Settings screen doesn't manage either (rate_cards is superseded by the
-- Inventory screen's pack-price matrix, which has no table yet; expense
-- categories are an Expenses-screen concern).
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1. app_can_operate(screen) — SECURITY DEFINER for the same reason as
--    app_current_role(): it reads `profiles`, and calling it from a
--    `profiles` policy would otherwise recurse.
-- ---------------------------------------------------------------------------
create or replace function app_can_operate(screen text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    app_current_role() = 'owner'
    or screen = any(coalesce((select allowed_screens from public.profiles where id = auth.uid()), '{}'));
$$;

-- ---------------------------------------------------------------------------
-- 2. Widen INSERT/UPDATE/DELETE on the six Settings-operable tables.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  settings_tables text[] := array[
    'products', 'product_varieties', 'suppliers', 'physical_tanks',
    'pumps', 'app_settings'
  ];
begin
  foreach t in array settings_tables loop
    execute format('drop policy if exists %I on %I', 'owner_insert_'||t, t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (app_can_operate(''settings''))',
      'owner_insert_'||t, t
    );
    execute format('drop policy if exists %I on %I', 'owner_update_'||t, t);
    execute format(
      'create policy %I on %I for update to authenticated using (app_can_operate(''settings'')) with check (app_can_operate(''settings''))',
      'owner_update_'||t, t
    );
    execute format('drop policy if exists %I on %I', 'owner_delete_'||t, t);
    execute format(
      'create policy %I on %I for delete to authenticated using (app_can_operate(''settings''))',
      'owner_delete_'||t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Hubs: split the single owner-only FOR ALL policy so only UPDATE widens.
--    Standing up or decommissioning a depot stays an owner-only org decision;
--    editing an existing hub's contact details is ordinary Settings work.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS hubs_owner_all ON hubs;

CREATE POLICY hubs_owner_insert ON hubs
  FOR INSERT TO authenticated
  WITH CHECK (app_is_owner());

CREATE POLICY hubs_owner_update ON hubs
  FOR UPDATE TO authenticated
  USING (app_can_operate('settings'))
  WITH CHECK (app_can_operate('settings'));

CREATE POLICY hubs_owner_delete ON hubs
  FOR DELETE TO authenticated
  USING (app_is_owner());

RESET ROLE;
