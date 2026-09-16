-- ============================================================================
-- 0004_multi_hub_hubs.sql — Multi-Hub Architecture, Hub Scoping & Access Control
-- Depends on 0001_init.sql, 0002_auth_rls.sql, and 0003_multi_hub.sql (the
-- 'hub_manager' enum value must already be committed — see that file's header).
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1. Hubs table (Depots / Distribution Centres across Nigeria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hubs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  state           TEXT NOT NULL,
  address         TEXT NOT NULL,
  phone           TEXT NOT NULL,
  manager_name    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON hubs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hubs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Link operational tables and profiles to Hubs
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL;
ALTER TABLE physical_tanks ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE CASCADE;
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;
ALTER TABLE pumps ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE CASCADE;
ALTER TABLE pump_readings ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;
ALTER TABLE keg_returns ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS from_hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS to_hub_id UUID REFERENCES hubs(id) ON DELETE RESTRICT;

-- Indices for rapid hub-scoped querying
CREATE INDEX IF NOT EXISTS idx_profiles_hub_id ON profiles(hub_id);
CREATE INDEX IF NOT EXISTS idx_physical_tanks_hub_id ON physical_tanks(hub_id);
CREATE INDEX IF NOT EXISTS idx_tanks_hub_id ON tanks(hub_id);
CREATE INDEX IF NOT EXISTS idx_pumps_hub_id ON pumps(hub_id);
CREATE INDEX IF NOT EXISTS idx_pump_readings_hub_id ON pump_readings(hub_id);
CREATE INDEX IF NOT EXISTS idx_orders_hub_id ON orders(hub_id);
CREATE INDEX IF NOT EXISTS idx_shifts_hub_id ON shifts(hub_id);
CREATE INDEX IF NOT EXISTS idx_expenses_hub_id ON expenses(hub_id);
CREATE INDEX IF NOT EXISTS idx_keg_returns_hub_id ON keg_returns(hub_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_hub_id ON transfers(from_hub_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_hub_id ON transfers(to_hub_id);

-- ---------------------------------------------------------------------------
-- 3. Hub helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_hub_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hub_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app_is_hub_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_role() = 'hub_manager';
$$;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security for Hubs & Hub-Scoped Operational Records
-- ---------------------------------------------------------------------------
ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active hubs for routing and reference
CREATE POLICY hubs_read ON hubs
  FOR SELECT TO authenticated
  USING (true);

-- Only owners can register, update, or decommission hubs
CREATE POLICY hubs_owner_all ON hubs
  FOR ALL TO authenticated
  USING (app_is_owner())
  WITH CHECK (app_is_owner());

-- RLS Scoping policies for operational tables:
-- Owners have universal visibility across all hubs.
-- Hub managers, cashiers, and staff are strictly restricted to their assigned hub.
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

CREATE POLICY hub_isolation_pumps ON pumps
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

-- Seed default initial hubs
INSERT INTO hubs (id, name, code, state, address, phone, manager_name, is_active)
VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Alaba Central Depot', 'ALABA-01', 'Lagos', 'Km 18 Badagry Expressway, Alaba International', '+234 803 111 2222', 'Babajide Sanwo', true),
  ('b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e', 'Ikeja Industrial Hub', 'IKEJA-02', 'Lagos', 'Plot 12 Commercial Avenue, Ikeja Industrial Estate', '+234 802 333 4444', 'Funke Adeleke', true),
  ('c3d4e5f6-a7b8-4c7d-0e1f-2a3b4c5d6e7f', 'Ibadan Regional Depot', 'IBADAN-01', 'Oyo', 'Iwo Road Interchange, Ibadan', '+234 805 555 6666', 'Rasheed Olalekan', true)
ON CONFLICT (code) DO NOTHING;

RESET ROLE;
