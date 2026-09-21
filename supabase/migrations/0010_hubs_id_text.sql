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
-- The three existing rows (from 0004's original seed) were fictional
-- placeholders the app never referenced by id — deleted outright rather than
-- reseeded with different fake data. A fresh database now ends up with an
-- empty `hubs` table, matching DEFAULT_HUBS ([] in config.ts) — the owner
-- registers each real depot from scratch via Settings -> Hubs & Depots.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

ALTER TABLE hubs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE hubs ALTER COLUMN id TYPE TEXT USING id::text;

DELETE FROM hubs;

RESET ROLE;
