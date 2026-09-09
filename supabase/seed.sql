-- ============================================================================
-- seed.sql  —  demo data, mirrors the seed constants in src/constants/config.ts
-- Run AFTER 0001_init.sql + 0002_auth_rls.sql on a fresh database:
--   supabase db reset            (applies migrations, then this file)
-- or:
--   psql "$SUPABASE_DB_URL" -f supabase/seed.sql
--
-- All INSERTs are ON CONFLICT DO NOTHING so the file is idempotent.
-- NOTE: seed `tanks.remaining_litres` values are hand-authored demo figures
-- from config.ts and are NOT derived from the seed orders below.
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

-- ---------------------------------------------------------------------------
-- suppliers  (DEFAULT_SUPPLIERS)
-- ---------------------------------------------------------------------------
insert into suppliers (id, name, phone) values
  ('sup-1', 'Presco Oil Plc',                '+234 803 100 2000'),
  ('sup-2', 'Okomu Oil Palm Company',        '+234 802 200 3000'),
  ('sup-3', 'Grand Cereals Mills',           '+234 805 300 4000'),
  ('sup-4', 'Ondo Local Palm Producers',     '+234 809 400 5000')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- physical_tanks  (DEFAULT_PHYSICAL_TANKS)
-- ---------------------------------------------------------------------------
insert into physical_tanks (id, label, product_id, capacity_litres, notes) values
  ('pt-1', 'Yard Tank 1 (Bulk Veg - 30,000L)',    'veg', 30000, 'Main East yard bulk vertical tank'),
  ('pt-2', 'Yard Tank 2 (Reserve Veg - 20,000L)', 'veg', 20000, 'Secondary West yard tank'),
  ('pt-3', 'Yard Tank 3 (Palm Decanting - 15,000L)', 'red', 15000, 'Dedicated decanting vessel for palm deliveries')
on conflict (id) do nothing;

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

-- ---------------------------------------------------------------------------
-- customers  (DEFAULT_CUSTOMERS)
-- ---------------------------------------------------------------------------
insert into customers (id, name, type, credit_limit, credit_term_days, phone) values
  ('cust-1', 'Mr Samson',   'corporate', 300000, 30, '+2348031234567'),
  ('cust-2', 'Arena',       'agent',     200000, 14, '+2348022345678'),
  ('cust-3', 'Iya Aige',    'agent',     150000, 14, '+2348053456789'),
  ('cust-4', 'Lekki Agent', 'agent',     100000, 14, '+2348094567890')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- pumps  (DEFAULT_PUMPS)  -- palm oil is pre-kegged, so no palm pump exists
-- ---------------------------------------------------------------------------
insert into pumps (id, label, product_id, last_meter_reading) values
  ('p-1', 'Pump 1 (Golden Vegetable Oil)', 'veg', 12450),
  ('p-2', 'Pump 2 (Golden Vegetable Oil)', 'veg', 8920)
on conflict (id) do nothing;

-- pump_readings  (SEED_PUMP_READINGS)
insert into pump_readings (id, pump_id, reading, recorded_at, note) values
  ('pr-1', 'p-1', 11160, '2026-08-01T06:00:00Z', 'Monthly baseline calibration'),
  ('pr-2', 'p-1', 12450, '2026-09-08T07:00:00Z', 'Morning shift meter verification'),
  ('pr-3', 'p-2', 8920,  '2026-09-08T07:00:00Z', 'Morning shift meter verification')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- tanks  (SEED_TANKS)
-- ---------------------------------------------------------------------------
insert into tanks (id, product_id, truck_label, tons, received_litres, remaining_litres, date, shortfall,
                   supplier_id, physical_tank_id, supply_model, space_note, last_dipstick_reading, last_dipstick_variance) values
  ('tank-v1', 'veg', 'Truck 1 · AAA-123-XB (Alhaji Musa)', 15, 16125, 15435, '2026-09-01T08:00:00Z', 0,
   'sup-1', 'pt-1', 'bulk_truck', null, 15435, 0),
  ('tank-v2', 'veg', 'Truck 2 · KJA-492-XA (Emeka Obi)',   10, 10750, 10750, '2026-09-06T10:30:00Z', 20,
   'sup-3', 'pt-2', 'bulk_truck', null, 10740, -10),
  ('tank-r1', 'red', 'Truck Red · OGL-881-ZZ (Babatunde)',  0, 12500, 12250, '2026-09-03T11:00:00Z', 0,
   'sup-2', 'pt-3', 'pre_kegged', 'Filled 1 decanting tank', 12250, 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- orders  (SEED_ORDERS)
-- ord-103 is a pre-kegged (palm) sale: SEED_ORDERS lists pump_id 'p-3' /
-- meter_reading 5340, but the app nulls pump_id + meter_reading for pre_kegged
-- orders and DEFAULT_PUMPS has no 'p-3'. Seeded here as NULL to match runtime.
-- ---------------------------------------------------------------------------
insert into orders (id, customer_id, product_id, unit, qty, litres, rate, amount, paid_amount, payment_method,
                    keg_source, date, due_date, source_tank_id, pump_id, meter_reading, note) values
  ('ord-101', 'cust-1', 'veg', 'keg', 15, 450, 4500, 67500,  0,     'credit',   'company',
   '2026-08-05T10:00:00Z', '2026-09-04T10:00:00Z', 'tank-v1', 'p-1', 11610, 'Initial supply'),
  ('ord-102', 'cust-2', 'veg', 'keg', 15, 450, 4800, 72000,  0,     'credit',   'company',
   '2026-08-28T14:30:00Z', '2026-09-11T14:30:00Z', 'tank-v1', 'p-1', 12060, 'Depot dispatch'),
  ('ord-103', 'cust-3', 'red', 'keg', 10, 300, 5100, 51000,  51000, 'transfer', 'own',
   '2026-09-07T09:15:00Z', null,                   'tank-r1', null,  null,  'Customer brought own yellow jerrycans'),
  ('ord-104', 'cust-4', 'veg', 'keg', 8,  240, 4800, 38400,  0,     'credit',   'company',
   '2026-09-04T12:00:00Z', '2026-09-18T12:00:00Z', 'tank-v1', 'p-1', 12300, 'Fast agent restock')
on conflict (id) do nothing;

-- order_tank_allocations  (backfilled from orders.source_tank_id; single-tank draws)
insert into order_tank_allocations (order_id, tank_id, drawn_litres, remaining_after_draw, draw_sequence) values
  ('ord-101', 'tank-v1', 450, null, 1),
  ('ord-102', 'tank-v1', 450, null, 1),
  ('ord-103', 'tank-r1', 300, null, 1),
  ('ord-104', 'tank-v1', 450, null, 1)
on conflict (order_id, tank_id) do nothing;

-- ---------------------------------------------------------------------------
-- keg_returns  (SEED_KEG_RETURNS)
-- ---------------------------------------------------------------------------
insert into keg_returns (id, customer_id, qty, date) values
  ('ret-1', 'cust-1', 5, '2026-08-15T15:20:00Z'),
  ('ret-2', 'cust-2', 3, '2026-09-02T11:00:00Z')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- transfers  (SEED_TRANSFERS)
-- ---------------------------------------------------------------------------
insert into transfers (id, from_customer_id, to_customer_id, item_type, qty, date, note) values
  ('trf-1', 'cust-1', 'cust-2', 'keg', 2, '2026-09-03T14:00:00Z', 'Direct market transfer from Samson to Arena')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- customer_credits : none seeded (store initialises the ledger empty).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- tank_dipstick_readings  (SEED_DIPSTICK_READINGS)
-- ---------------------------------------------------------------------------
insert into tank_dipstick_readings (id, tank_id, reading_litres, system_litres, recorded_at, variance, is_flagged, note) values
  ('ds-1', 'tank-v1', 15660, null, '2026-09-08T07:30:00Z', 0, false, 'Morning yard calibration')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- shifts  (SEED_SHIFTS)
-- ---------------------------------------------------------------------------
insert into shifts (id, supervisor_name, start_time, end_time, opening_float, opening_readings,
                    cash_sales, cash_expenses, expected_cash, cash_counted, cash_variance, status, note) values
  ('shift-1', 'Alhaja Sikirat (Owner)', '2026-09-08T07:00:00Z', null, 150000,
   '{"p-1": 12450, "p-2": 8920}'::jsonb, 0, 37000, 113000, null, null, 'open',
   'Morning shift operational run')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- expenses  (SEED_EXPENSES)
-- ---------------------------------------------------------------------------
insert into expenses (id, date, category, amount, note) values
  ('exp-1', '2026-09-08T08:00:00Z', 'Diesel/Gen',           25000, '30L diesel for 40kVA generator'),
  ('exp-2', '2026-09-08T09:30:00Z', 'Loading & Offloading', 12000, 'Depot boys offloading assistance')
on conflict (id) do nothing;

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
