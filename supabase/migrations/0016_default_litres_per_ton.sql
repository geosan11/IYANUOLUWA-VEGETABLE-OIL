-- 0016_default_litres_per_ton.sql
-- Add a global fallback tons->litres conversion ratio to app_settings, used
-- when a product doesn't have its own litres_per_ton density set.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.

RESET ROLE;

alter table app_settings
  add column if not exists default_litres_per_ton numeric(10,2) not null default 1075;

RESET ROLE;
