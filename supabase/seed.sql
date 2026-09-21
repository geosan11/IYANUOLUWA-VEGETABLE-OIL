-- ============================================================================
-- seed.sql — real reference data only, mirrors the (already-cleaned) seed
-- constants in src/constants/config.ts. Every depot starts with a genuinely
-- clean transactional ledger — no fictional customers, suppliers, tanks,
-- pumps, orders, or shifts. Run AFTER 0001_init.sql + 0002_auth_rls.sql on a
-- fresh database:
--   supabase db reset            (applies migrations, then this file)
-- or:
--   psql "$SUPABASE_DB_URL" -f supabase/seed.sql
--
-- All INSERTs are ON CONFLICT DO NOTHING so the file is idempotent.
-- ============================================================================

-- profiles / auth.users are intentionally NOT seeded here (created by Supabase
-- Auth signups). Seed an owner manually once a user exists, e.g.:
--   update profiles set role = 'owner' where id = '<auth-user-uuid>';

-- ---------------------------------------------------------------------------
-- products  (DEFAULT_PRODUCTS)
-- ---------------------------------------------------------------------------
insert into products (id, name, supply_model, litres_per_ton, litres_per_keg, keg_sell_price, color_light, color_dark) values
  ('veg', 'Golden Vegetable Oil', 'bulk_truck', 1075, 30, 3500, '#FCD34D', '#B45309'),
  ('red', 'Red / Palm Oil',       'pre_kegged', null, 25, 3000, '#F87171', '#7F1D1D')
on conflict (id) do nothing;

-- product_varieties  (DEFAULT_PRODUCTS[].varieties; sort_order 0 = default)
insert into product_varieties (id, product_id, name, rate_delta_per_litre, sort_order) values
  ('veg-soya',      'veg', 'Pure Soya (Grade A)',           0,   0),
  ('veg-olein',     'veg', 'Triple-Refined Palm Olein',    -100, 1),
  ('veg-groundnut', 'veg', 'Groundnut / Peanut Blend',      250, 2),
  ('veg-corn',      'veg', 'Refined Corn / Maize Oil',      150, 3),
  ('red-edo',       'red', 'Grade-A Edo Spec',              0,   0),
  ('red-ondo',      'red', 'Ondo Local Producer',          -150, 1)
on conflict (id) do nothing;

-- suppliers, physical_tanks: none seeded — each depot registers its own from
-- scratch (Settings -> Tanks, Pumps & Suppliers), matching DEFAULT_SUPPLIERS
-- and DEFAULT_PHYSICAL_TANKS ([] in config.ts).

-- ---------------------------------------------------------------------------
-- rate_cards  (DEFAULT_RATE_CARDS)
-- ---------------------------------------------------------------------------
insert into rate_cards (product_id, tier, rate_per_litre) values
  ('veg', 'retail',    5200),
  ('veg', 'agent',     4800),
  ('veg', 'corporate', 4500),
  ('red', 'retail',    5600),
  ('red', 'agent',     5100),
  ('red', 'corporate', 4800)
on conflict (product_id, tier) do nothing;

-- ---------------------------------------------------------------------------
-- expense_categories  (EXPENSE_CATEGORIES)
-- ---------------------------------------------------------------------------
insert into expense_categories (name, sort_order) values
  ('Diesel/Gen',              0),
  ('Loading & Offloading',    1),
  ('Transport & Logistics',   2),
  ('Depot Maintenance',       3),
  ('Water & Spillage',        4)
on conflict (name) do nothing;

-- customers: none seeded beyond the walk-in placeholder, which the app itself
-- inserts client-side (ONE_TIME_CUSTOMER) — matches DEFAULT_CUSTOMERS.

-- pumps, pump_readings, tanks, orders, order_tank_allocations, keg_returns,
-- transfers, tank_dipstick_readings, shifts, expenses: none seeded — every
-- depot starts with a genuinely clean transactional ledger (matches
-- DEFAULT_PUMPS / SEED_TANKS / SEED_ORDERS / SEED_KEG_RETURNS /
-- SEED_TRANSFERS / SEED_SHIFTS / SEED_EXPENSES, all [] in config.ts). The
-- tank-dipstick feature itself was removed from the app entirely (client
-- asked for outright removal — see MOSCOW.md), so nothing seeds that table.

-- ---------------------------------------------------------------------------
-- app_settings  (DEFAULT_SETTINGS) — single row, id = 1
-- ---------------------------------------------------------------------------
insert into app_settings (id, company_name, company_phone, company_address, company_logo_url,
                          litres_per_keg, total_company_kegs, kegs_at_depot_low_threshold,
                          low_stock_litres_threshold, truck_shortfall_threshold, pump_variance_threshold,
                          dipstick_variance_threshold, default_daily_float, daily_float) values
  (1, 'Iyanuoluwa Vegetable & Palm Oil Depot', '+234 802 000 1122',
   'Plot 14, Commercial Avenue, Alaba Depot, Lagos', null,
   30, 500, 20, 500, 50, 20, 30, 150000, 150000)
on conflict (id) do nothing;
