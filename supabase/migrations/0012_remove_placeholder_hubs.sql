-- ============================================================================
-- 0012_remove_placeholder_hubs.sql — one-time live-data cleanup
--
-- 0004/0010 (now fixed to seed nothing — see their updated headers) had
-- inserted 3 fictional hubs into the live database: 'hub-los-alaba' (Alaba
-- Central Depot), 'hub-los-ikeja' (Ikeja Industrial Hub), 'hub-oyo-ibadan'
-- (Ibadan Regional Depot), each with an invented manager name. Confirmed
-- with the owner that these are still untouched placeholders, never renamed
-- or customized into real depot records — safe to delete outright. The
-- owner registers their real hub(s) from scratch via Settings -> Hubs &
-- Depots afterward.
--
-- Deliberately matches by id only (not a blanket `DELETE FROM hubs`), so
-- this stays a no-op if any of these three were already removed or renamed
-- to a different id by the time this runs.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

DELETE FROM hubs WHERE id IN ('hub-los-alaba', 'hub-los-ikeja', 'hub-oyo-ibadan');

RESET ROLE;
