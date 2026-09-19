-- ============================================================================
-- 0010_hubs_id_text.sql — hubs.id: UUID -> TEXT, reseeded with the app's real ids
--
-- Bug: new hubs created in Settings only ever lived in the browser's
-- localStorage (src/services/store.tsx never talked to Supabase for hubs at
-- all), so a hub created on one device/browser was invisible everywhere
-- else, and looked "deleted" after a Vercel redeploy forced a hard reload
-- of a browser that hadn't cached it. Fix (paired with a store.tsx change
-- in the same commit): read/write the `hubs` table for real.
--
-- 0009 already converted every hub_id/from_hub_id/to_hub_id column that
-- POINTS AT hubs.id from uuid to text (and dropped their FKs), because the
-- app's own hub ids are client-supplied text slugs ('hub-los-alaba', etc.),
-- not uuids. It deliberately left `hubs` itself uuid-keyed since nothing
-- wrote to it yet. Now something does, so `hubs.id` gets the same treatment.
--
-- The three existing rows are random-uuid placeholders the app has never
-- referenced (its own ids are always 'hub-los-alaba' / 'hub-los-ikeja' /
-- 'hub-oyo-ibadan' — see DEFAULT_HUBS in src/constants/config.ts) — safe to
-- replace outright, matching the "current data is test data" call made
-- earlier for the rest of this migration.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

ALTER TABLE hubs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE hubs ALTER COLUMN id TYPE TEXT USING id::text;

DELETE FROM hubs;

INSERT INTO hubs (id, name, code, state, address, phone, manager_name, is_active, created_at) VALUES
  ('hub-los-alaba', 'Alaba Central Depot', 'ALB-01', 'Lagos', 'Plot 14, Commercial Avenue, Alaba International, Lagos', '+234 802 000 1122', 'Babatunde Raji', true, '2026-01-01T00:00:00Z'),
  ('hub-los-ikeja', 'Ikeja Industrial Hub', 'IKJ-02', 'Lagos', 'Block B, Industrial Estate, Ikeja, Lagos', '+234 803 444 5566', 'Musa Bello', true, '2026-02-15T00:00:00Z'),
  ('hub-oyo-ibadan', 'Ibadan Regional Depot', 'IBD-01', 'Oyo', 'Ring Road Oil Terminal, Ibadan, Oyo State', '+234 805 777 8899', 'Rasheed Adebayo', true, '2026-03-10T00:00:00Z');

RESET ROLE;
