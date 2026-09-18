-- ============================================================================
-- 0009_hub_id_text.sql — hub_id columns: UUID FK -> hubs(id), TEXT, client-supplied
--
-- Bug: profiles.hub_id (0004) is a UUID FK into the `hubs` table. `hubs` is
-- one more operational table the app has never actually written to — per
-- SCHEMA.md the app still runs entirely off localStorage, and its own hub
-- records (src/constants/config.ts DEFAULT_HUBS: 'hub-los-alaba', etc.) are
-- plain client-supplied text ids, same convention as every other id in this
-- schema (see SCHEMA.md "Key modeling decisions" #1). `profiles` is the one
-- table that IS live (real Supabase auth), so the moment an owner invites a
-- teammate and assigns one of the app's real hubs, the Edge Function tries to
-- write e.g. 'hub-los-alaba' into a uuid column and Postgres rejects it:
--   invalid input syntax for type uuid: "hub-los-alaba"
--
-- Fix: make every hub_id/from_hub_id/to_hub_id column TEXT, client-supplied,
-- matching every other id in the schema — not a FK into the still-unused
-- `hubs` table. app_current_hub_id() and every hub_isolation_* policy have to
-- change together since they all type-depend on each other; safe to do as one
-- migration because none of these operational tables have live data yet
-- (localStorage is still the source of truth for all of them except profiles).
--
-- The `hubs` table itself is left in place (still uuid-keyed) — nothing
-- references it any more after this migration; it's dormant until a real
-- hubs migration happens, same as every other operational table.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1. Drop every policy that reads app_current_hub_id() or a hub_id column,
--    so the column type changes below aren't blocked by a dependent policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS hub_isolation_orders ON orders;
DROP POLICY IF EXISTS hub_isolation_tanks ON tanks;
DROP POLICY IF EXISTS hub_isolation_physical_tanks ON physical_tanks;
DROP POLICY IF EXISTS hub_isolation_pumps ON pumps;
DROP POLICY IF EXISTS hub_isolation_pump_readings ON pump_readings;
DROP POLICY IF EXISTS hub_isolation_shifts ON shifts;
DROP POLICY IF EXISTS hub_isolation_expenses ON expenses;
DROP POLICY IF EXISTS hub_isolation_keg_returns ON keg_returns;
DROP POLICY IF EXISTS hub_isolation_transfers ON transfers;

-- ---------------------------------------------------------------------------
-- 2. Drop the FKs into hubs(id) and convert every column to TEXT.
-- ---------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_hub_id_fkey;
ALTER TABLE profiles ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE physical_tanks DROP CONSTRAINT IF EXISTS physical_tanks_hub_id_fkey;
ALTER TABLE physical_tanks ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE tanks DROP CONSTRAINT IF EXISTS tanks_hub_id_fkey;
ALTER TABLE tanks ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE pumps DROP CONSTRAINT IF EXISTS pumps_hub_id_fkey;
ALTER TABLE pumps ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE pump_readings DROP CONSTRAINT IF EXISTS pump_readings_hub_id_fkey;
ALTER TABLE pump_readings ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_hub_id_fkey;
ALTER TABLE orders ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_hub_id_fkey;
ALTER TABLE shifts ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_hub_id_fkey;
ALTER TABLE expenses ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE keg_returns DROP CONSTRAINT IF EXISTS keg_returns_hub_id_fkey;
ALTER TABLE keg_returns ALTER COLUMN hub_id TYPE TEXT USING hub_id::text;

ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_from_hub_id_fkey;
ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_to_hub_id_fkey;
ALTER TABLE transfers ALTER COLUMN from_hub_id TYPE TEXT USING from_hub_id::text;
ALTER TABLE transfers ALTER COLUMN to_hub_id TYPE TEXT USING to_hub_id::text;

-- ---------------------------------------------------------------------------
-- 3. app_current_hub_id() now returns TEXT.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app_current_hub_id();

CREATE FUNCTION app_current_hub_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hub_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 4. Recreate every hub_isolation_* policy — same logic as 0004/0008, now
--    comparing TEXT to TEXT. pumps/physical_tanks stay read-only (0008's
--    narrowing); the rest stay FOR ALL as in 0004; transfers as in 0008.
-- ---------------------------------------------------------------------------
CREATE POLICY hub_isolation_orders ON orders
  FOR ALL TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  )
  WITH CHECK (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_tanks ON tanks
  FOR ALL TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  )
  WITH CHECK (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_physical_tanks ON physical_tanks
  FOR SELECT TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_pumps ON pumps
  FOR SELECT TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_pump_readings ON pump_readings
  FOR ALL TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  )
  WITH CHECK (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_shifts ON shifts
  FOR ALL TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  )
  WITH CHECK (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_expenses ON expenses
  FOR ALL TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  )
  WITH CHECK (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_keg_returns ON keg_returns
  FOR ALL TO authenticated
  USING (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  )
  WITH CHECK (
    app_is_owner() OR
    hub_id IS NULL OR
    hub_id = app_current_hub_id()
  );

CREATE POLICY hub_isolation_transfers ON transfers
  FOR ALL TO authenticated
  USING (
    app_is_owner() OR
    (from_hub_id IS NULL AND to_hub_id IS NULL) OR
    from_hub_id = app_current_hub_id() OR
    to_hub_id = app_current_hub_id()
  )
  WITH CHECK (
    app_is_owner() OR
    (from_hub_id IS NULL AND to_hub_id IS NULL) OR
    from_hub_id = app_current_hub_id() OR
    to_hub_id = app_current_hub_id()
  );

RESET ROLE;
