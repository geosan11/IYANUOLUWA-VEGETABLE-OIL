-- 0023_default_litres_per_ton_not_invented.sql
-- 0016 shipped a database-level `default 1075` on the depot-wide tons→litres
-- ratio. 1,075 L/ton is one palm-oil-typical figure stamped onto every depot,
-- and it is exactly the kind of invented magnitude this codebase is being
-- cleaned of: a brand-new `app_settings` row (or any insert that omits the
-- column) silently converted metric tons with a ratio the owner never chose.
--
-- The app already reads 0/blank as "not configured" (see `resolveLitresPerTon`
-- in `src/services/businessLogic.ts`, and `config.ts`'s defaults), so the
-- neutral database default is 0. Existing owner-set values are left untouched —
-- a stored 1075 is indistinguishable from a typed 1075, so clearing it stays an
-- owner decision in Settings → Density & Conversions.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.

RESET ROLE;

alter table app_settings
  alter column default_litres_per_ton set default 0;

RESET ROLE;
