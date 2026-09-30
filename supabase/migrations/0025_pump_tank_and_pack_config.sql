-- Pump → yard tank, and the pack sizes a product actually sells.
--
-- pumps.physical_tank_id was kept only in the writing browser, so a reload
-- from Supabase dropped the link and the meter screen fell back to pump names
-- (e.g. "Pump 2 SOYA"). products.pack_config had no column at all, so another
-- device never saw which pack sizes were enabled.
--
-- order_tank_allocations already exists (0001); the app starts writing it in
-- the same change. No extra table here.

alter table pumps
  add column if not exists physical_tank_id text references physical_tanks(id) on delete set null;

create index if not exists idx_pumps_physical_tank on pumps(physical_tank_id);

comment on column pumps.physical_tank_id is
  'Yard tank this pump draws from. Null = unassigned; FIFO then uses any lot of the product.';

alter table products
  add column if not exists pack_config jsonb not null default '[]'::jsonb;

comment on column products.pack_config is
  'Which pack sizes this product sells, plus returnable / container-buy rules. Empty array = none configured yet.';
