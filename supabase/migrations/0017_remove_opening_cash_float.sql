-- ============================================================================
-- 0017_remove_opening_cash_float.sql
--
-- The depot doesn't keep any cash in the box at the start of the day, so the
-- "opening cash float" feature is being removed app-wide: the editable card
-- on the Expenses screen, the "Default Opening Cash Float" setting, the
-- required "Cash for Customer Change" input on Start Shift (both the
-- Dashboard modal and the New Order screen's shift gate), and the float
-- readouts on the Dashboard.
--
-- default_daily_float/daily_float on app_settings are NOT NULL columns, so
-- they can't be dropped without a bigger migration for zero benefit — the
-- client now always writes 0 to both (see store.tsx's toAppSettingsRow,
-- same treatment as the already-removed dipstick_variance_threshold). This
-- migration zeroes the existing live row so it matches immediately instead
-- of waiting for the next settings save.
--
-- shifts.opening_float is untouched: it's a real per-shift business figure
-- (computeShiftCash: expected_cash = opening_float + cash_sales -
-- cash_expenses) that the client now always starts at 0 rather than
-- prompting for a value — the formula and column stay valid unchanged.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

update app_settings set default_daily_float = 0, daily_float = 0 where id = 1;

RESET ROLE;
