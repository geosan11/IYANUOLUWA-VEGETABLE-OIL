-- ============================================================================
-- 0020_pack_prices_and_audit_log.sql — Iyanuoluwa Vegetable & Palm Oil Depot
--
-- Two tables the app writes to but which exist in no migration. 0011 flagged
-- the first one itself: "rate_cards is superseded by the Inventory screen's
-- pack-price matrix, which has no table yet".
--
--   1. `pack_prices` — the matrix the counter actually charges from. The
--      product catalogue syncs to Supabase but its PRICES did not, so two
--      devices showed the same products at different prices. Deliberately has
--      no hub_id: pricing is depot-wide (the app's PackPrice carries none).
--
--   2. `audit_log` — the who/what/when/why trail behind every edit and void.
--      APPEND-ONLY by design: it gets SELECT + INSERT policies and no UPDATE
--      or DELETE policy at all, so RLS denies rewriting history even to a
--      staff member who can otherwise update the record being audited.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- ---------------------------------------------------------------------------
-- 1. Enums for the audit trail (SCHEMA.md decision 6: every string union)
-- ---------------------------------------------------------------------------
do $$ begin create type audit_entity_type as enum ('sale','order_line','payment','expense','tank_intake'); exception when duplicate_object then null; end $$;
do $$ begin create type audit_action      as enum ('create','edit','void','unvoid');                    exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. pack_prices — variety × pack size × tier, PK is the whole tuple
-- ---------------------------------------------------------------------------
create table if not exists pack_prices (
  product_id   text not null references products(id)          on delete cascade,
  variety_id   text not null references product_varieties(id) on delete cascade,
  pack_size_id text not null,                              -- 'sz_25' … (app constants, not a table)
  tier         customer_type not null,
  price        numeric(12,2) not null check (price >= 0),  -- absolute price for ONE pack, NOT per litre
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (product_id, variety_id, pack_size_id, tier)
);
create index if not exists idx_pack_prices_variety on pack_prices(variety_id);

drop trigger if exists set_updated_at on pack_prices;
create trigger set_updated_at before update on pack_prices
  for each row execute function set_updated_at();

comment on table pack_prices is
  'The Inventory price matrix: absolute price for one pack at a (variety, pack size, customer tier). Supersedes rate_cards, which the Settings screen does not manage.';

alter table pack_prices enable row level security;

drop policy if exists read_all_pack_prices on pack_prices;
create policy read_all_pack_prices on pack_prices
  for select to authenticated
  using (true);

-- Written from the Inventory screen, so it follows 0011's pattern of matching
-- the client's own permission model (canOperate('inventory')) rather than a
-- hard owner-only check.
drop policy if exists inventory_insert_pack_prices on pack_prices;
create policy inventory_insert_pack_prices on pack_prices
  for insert to authenticated
  with check (app_can_operate('inventory'));

drop policy if exists inventory_update_pack_prices on pack_prices;
create policy inventory_update_pack_prices on pack_prices
  for update to authenticated
  using (app_can_operate('inventory'))
  with check (app_can_operate('inventory'));

drop policy if exists inventory_delete_pack_prices on pack_prices;
create policy inventory_delete_pack_prices on pack_prices
  for delete to authenticated
  using (app_can_operate('inventory'));

-- ---------------------------------------------------------------------------
-- 3. audit_log — append-only (SELECT + INSERT only, on purpose)
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id          text primary key,                            -- 'aud-<ts>'
  entity_type audit_entity_type not null,
  entity_id   text not null,
  action      audit_action not null,
  changes     jsonb not null default '[]'::jsonb,           -- [{field, old, new}, …]
  actor_role  user_role not null,
  actor_name  text,
  at          timestamptz not null default now(),
  reason      text,
  hub_id      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_audit_log_entity on audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_at     on audit_log(at);
create index if not exists idx_audit_log_hub_id on audit_log(hub_id);

comment on table audit_log is
  'Append-only dispute history. There is intentionally no UPDATE or DELETE policy: RLS denies rewriting the trail, so corrections must be new entries.';

alter table audit_log enable row level security;

drop policy if exists read_all_audit_log on audit_log;
create policy read_all_audit_log on audit_log
  for select to authenticated
  using (true);

-- Any signed-in user may append; nobody may rewrite. `with check (true)` is
-- deliberate — failing to record an action should never itself fail.
drop policy if exists append_audit_log on audit_log;
create policy append_audit_log on audit_log
  for insert to authenticated
  with check (true);

-- Hub-scoped READ only (the 0008 pattern for combining isolation with a
-- broader write policy): a non-owner sees their own hub's trail.
drop policy if exists hub_isolation_audit_log on audit_log;
create policy hub_isolation_audit_log on audit_log
  for select to authenticated
  using (
    app_is_owner() or
    hub_id is null or
    hub_id = app_current_hub_id()
  );

RESET ROLE;
