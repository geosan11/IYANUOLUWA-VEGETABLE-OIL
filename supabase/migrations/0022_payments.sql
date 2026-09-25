-- ============================================================================
-- 0022_payments.sql — Iyanuoluwa Vegetable & Palm Oil Depot
--
-- The last missing table in the transactional layer. A live REST probe of the
-- deployed project returned 404 for both `payments` and `payment_allocations`:
-- neither has ever existed in any migration, so the app's `Payment` type — a
-- CUSTOMER RECEIPT, recorded so a fully-applied settlement still leaves a
-- trace — has had nowhere to go since it was introduced.
--
-- Why this is not `sale_payments` (0007): that table is one sale's TENDER LEGS
-- (cash leg + credit remainder of a split), keyed by `sale_id` and FK'd to
-- `sales` by 0019. A `Payment` is a different grain entirely — a customer hands
-- over money ONCE and the app allocates it across `applied_to: [{order_id,
-- amount}]`, which can span several sales, plus an overpayment leg that becomes
-- store credit (`overpayment_to_credit`). Forcing that into `sale_payments`
-- would mean inventing a single `sale_id` it doesn't have.
--
-- `applied_to` is stored as jsonb (the app's exact shape) rather than
-- normalised into `payment_allocations`. Normalising would let reports join
-- allocations by FK, which is worth doing when something actually needs it —
-- but jsonb is lossless today and costs one less table to keep in sync.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

create table if not exists payments (
  id                    text primary key,                 -- 'pay-<ts>'
  customer_id           text not null references customers(id) on delete restrict,
  amount                numeric(14,2) not null check (amount >= 0),
  -- cash | transfer | pos — never 'credit' (payment_method's 'credit'/'split'
  -- values describe a SALE's tender, not a receipt), hence text to match
  -- sale_payments.method (0007) rather than the wider enum.
  method                text not null,
  date                  timestamptz not null default now(),
  applied_to            jsonb not null default '[]'::jsonb,  -- [{"order_id":"line-…","amount":25000},…]
  overpayment_to_credit numeric(14,2) not null default 0,    -- pushed to customer_credits, 0 if none
  source                text not null default 'payment'
                          check (source in ('payment', 'credit_redeem')),
  recorded_by           text,
  note                  text,
  voided                boolean not null default false,
  voided_at             timestamptz,
  void_reason           text,
  hub_id                text,                                -- text, per 0009
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_payments_customer_id on payments(customer_id);
create index if not exists idx_payments_date        on payments(date);
create index if not exists idx_payments_hub_id      on payments(hub_id);

comment on table payments is
  'One customer receipt: money handed over once, allocated across one or more sale lines via applied_to, with any overpayment pushed to store credit. Distinct from sale_payments (0007), which holds the tender legs of a single sale.';

comment on column payments.applied_to is
  'Line-level allocation: [{"order_id":"line-<ts>-<n>","amount":25000},…]. Line (not sale) level because that is the grain the app allocates at and what its aging/FIFO reducers consume.';

-- 0001 attaches set_updated_at to every table via a DO loop, so tables created
-- after it must attach it themselves.
drop trigger if exists set_updated_at on payments;
create trigger set_updated_at before update on payments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — same three-layer shape as `sales` in 0019: platform-wide read for
-- signed-in staff, staff/owner write, hub isolation on top.
-- ---------------------------------------------------------------------------
alter table payments enable row level security;

drop policy if exists read_all_payments on payments;
create policy read_all_payments on payments
  for select to authenticated
  using (true);

drop policy if exists staff_insert_payments on payments;
create policy staff_insert_payments on payments
  for insert to authenticated
  with check (app_current_role() in ('staff', 'owner'));

-- UPDATE exists because a receipt can be voided (voided/voided_at/void_reason)
-- or have its date corrected — both are app features that write the same row.
-- There is no DELETE policy on purpose: a voided receipt must stay visible as
-- the correction trail for the money it once moved.
drop policy if exists staff_update_payments on payments;
create policy staff_update_payments on payments
  for update to authenticated
  using (app_current_role() in ('staff', 'owner'))
  with check (app_current_role() in ('staff', 'owner'));

drop policy if exists hub_isolation_payments on payments;
create policy hub_isolation_payments on payments
  for all to authenticated
  using (
    app_is_owner() or
    hub_id is null or
    hub_id = app_current_hub_id()
  )
  with check (
    app_is_owner() or
    hub_id is null or
    hub_id = app_current_hub_id()
  );

RESET ROLE;
