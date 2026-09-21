-- ============================================================================
-- 0013_remove_remaining_placeholder_seed_rows.sql — one-time live-data cleanup
--
-- Discovered while pushing 0011/0012: the *old* supabase/seed.sql (before it
-- was cleaned up to match config.ts's already-emptied DEFAULT_SUPPLIERS/
-- DEFAULT_PHYSICAL_TANKS/DEFAULT_PUMPS/SEED_* constants) had already been run
-- against this live database at some point outside the CLI's tracked
-- migration history — verified by direct query, every row below matches the
-- old seed.sql's fake content byte-for-byte: fake suppliers (Presco Oil Plc,
-- Okomu Oil Palm Company, Grand Cereals Mills, Ondo Local Palm Producers),
-- fake yard tanks (pt-1/2/3), fake pumps (p-1/2 "Golden Vegetable Oil"), fake
-- customers (Mr Samson, Arena, Iya Aige, Lekki Agent), fake truck intakes,
-- orders, keg returns, a transfer, a dipstick reading, a shift, and expenses.
--
-- `products` and `app_settings` were checked too and are NOT touched here —
-- their live rows are the real intended catalog/company defaults (matching
-- the still-populated DEFAULT_PRODUCTS/DEFAULT_SETTINGS in config.ts), not
-- fictional placeholders.
--
-- Deliberately matches by exact known id, never a blanket DELETE FROM, in
-- FK-safe order (children before the parents they reference) — a table with
-- unexpected extra real rows is simply left with those rows intact.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

DELETE FROM order_tank_allocations WHERE order_id IN ('ord-101', 'ord-102', 'ord-103', 'ord-104');
DELETE FROM tank_dipstick_readings WHERE id IN ('ds-1');
DELETE FROM pump_readings WHERE id IN ('pr-1', 'pr-2', 'pr-3');
DELETE FROM orders WHERE id IN ('ord-101', 'ord-102', 'ord-103', 'ord-104');
DELETE FROM keg_returns WHERE id IN ('ret-1', 'ret-2');
DELETE FROM transfers WHERE id IN ('trf-1');
DELETE FROM customers WHERE id IN ('cust-1', 'cust-2', 'cust-3', 'cust-4');
DELETE FROM tanks WHERE id IN ('tank-v1', 'tank-v2', 'tank-r1');
DELETE FROM shifts WHERE id IN ('shift-1');
DELETE FROM expenses WHERE id IN ('exp-1', 'exp-2');
DELETE FROM physical_tanks WHERE id IN ('pt-1', 'pt-2', 'pt-3');
DELETE FROM pumps WHERE id IN ('p-1', 'p-2');
DELETE FROM suppliers WHERE id IN ('sup-1', 'sup-2', 'sup-3', 'sup-4');

RESET ROLE;
