-- ============================================================================
-- 0007_double_split_payments.sql — Iyanuoluwa Vegetable & Palm Oil Depot
-- Support for split / double payment modes, partial customer payments,
-- customer debt logging from expenses, and container pricing configuration.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

-- 1. Add 'split' to the payment_method enum if not already present
alter type payment_method add value if not exists 'split';

-- 2. Add payment_splits jsonb column to orders (and sales if present)
alter table if exists orders
  add column if not exists payment_splits jsonb;

comment on column orders.payment_splits is 'Detailed breakdown of split tender lines (e.g. cash + transfer, deposit + credit debt remainder). Shape: [{"method": "cash", "amount": 25000}, {"method": "transfer", "amount": 15000}].';

alter table if exists sales
  add column if not exists payment_splits jsonb;

-- 3. Normalized child table for querying multi-tender payments and auditing splits
create table if not exists sale_payments (
  id                text primary key,
  sale_id           text not null,
  method            text not null,
  amount            numeric(14,2) not null check (amount >= 0),
  amount_tendered   numeric(14,2),
  change_due        numeric(14,2),
  reference         text,
  credit_term_days  int,
  due_date          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_sale_payments_sale_id on sale_payments(sale_id);
create index if not exists idx_sale_payments_method  on sale_payments(method);

-- 4. Add expense-to-customer debt tracking and staff metadata to expenses
alter table if exists expenses
  add column if not exists recorded_by text,
  add column if not exists customer_id text references customers(id) on delete set null,
  add column if not exists charge_to_customer boolean not null default false;

comment on column expenses.charge_to_customer is 'True when the expense voucher is directly charged/billed to a customer debt balance (demurrage, offloading surcharge, etc.).';

-- 5. Add standard 25L company keg outright purchase and loan deposit pricing to app_settings
alter table if exists app_settings
  add column if not exists outright_keg_price numeric(12,2) not null default 3500,
  add column if not exists keg_deposit_price numeric(12,2) not null default 2000;

comment on column app_settings.outright_keg_price is 'Standard purchase price billed to customers who buy company 25L kegs outright.';
comment on column app_settings.keg_deposit_price is 'Standard deposit refund rate credited to customers upon returning loaned 25L company kegs.';

RESET ROLE;
