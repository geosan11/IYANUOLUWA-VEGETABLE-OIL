# Iyanuoluwa Depot — Supabase schema contract

Schema layer only. The React app is **not** wired to Supabase yet; it still runs
entirely off `localStorage` (see `src/services/store.tsx`). These files define the
Postgres target the app will migrate onto.

| File | Purpose |
|---|---|
| `supabase/migrations/0001_init.sql` | Enum types, 19 operational tables, FKs, indexes, shared `set_updated_at()` trigger. |
| `supabase/migrations/0002_auth_rls.sql` | `profiles` table, `app_current_role()` helper, RLS on every table, role policies, `SECURITY DEFINER` RPC stubs. |
| `supabase/seed.sql` | Demo data mirroring the seed constants in `src/constants/config.ts`. |

> A pre-existing `schema/*.sql` folder in the repo root is an earlier, partial,
> internally inconsistent draft (uuid PKs, only 13 tables, `litres_per_ton`
> values that don't match `config.ts`, no varieties/suppliers/physical_tanks/
> credits/allocations, no RLS). **`supabase/` supersedes it.** Delete `schema/`
> when this lands, or keep it only for reference.

## Key modeling decisions

1. **`text` primary keys, client-supplied.** The app already generates ids like
   `ord-1725…`, `cust-2`, `tank-v1`, `p-1`, `veg`, and prints them on receipts /
   waybills. Keeping `text` PKs makes the localStorage → Postgres migration a
   straight copy and keeps existing document references valid.
   *Trade-off:* wider keys, not globally unique across environments, a client can
   pick a colliding id. When the app is wired up, switch new inserts to
   `uuid default gen_random_uuid()` and demote the `*-…` strings to
   `legacy_id text unique`. Documented at the top of `0001_init.sql`.
2. **`product_varieties` is a child table, not a `jsonb` column on `products`.**
   `orders.variety_id` needs a real FK; the pricing math joins the variety to add
   `rate_delta_per_litre`; varieties are edited / reported / filtered
   individually. A `jsonb` blob would block the FK and force every reader to
   re-parse. `orders` also keeps a denormalized `variety_name` snapshot for the
   receipt.
3. **`order_tank_allocations` added now.** The FIFO draw
   (`executeFifoTankDraw`) can span several tanks but the app only stores the
   *first* on `orders.source_tank_id`, so split draws lose provenance. The new
   child table records every `(order, tank, drawn_litres)` leg. Seed backfills
   one leg per order from `source_tank_id`.
4. **`payments` + `payment_allocations`: recommended, deferred.** Today
   `recordCustomerPayment` / `redeemCustomerCredit` mutate `orders.paid_amount`
   in place — there is no payment record, no way to reverse a payment, no audit
   of *which* invoices a payment touched. Recommended tables are sketched in
   *Gaps* below; deferred because adopting them requires rewriting those two
   store actions (best done together with the Supabase wiring, via the
   `post_customer_payment` RPC stubbed in `0002`).
5. **`app_settings` is a single typed row** (`id int primary key check (id = 1)`),
   not a key/value/jsonb bag — every setting has a known type and NOT NULL.
6. **Enums** for every string union; `KegSource`'s `null` is a NULLable column,
   not an enum member. Duplicated TS fields (`Transfer.note`/`notes`,
   `Shift.note`/`notes`, `TankDipstickReading.is_flagged`/`isOverThreshold`) are
   collapsed to one column each.
7. **`updated_at`** on every table, maintained by one shared `set_updated_at()`
   trigger attached in a `DO` loop.

---

## TS interface → table mapping

Legend: **FK** = foreign key · **derived** = computed in `businessLogic.ts`, not
stored · **null** = nullable column.

### `Product` → `products`
| TS field | column | type | notes |
|---|---|---|---|
| id | id | text PK | `'veg'`, `'red'`, `'prod-<ts>'` |
| name | name | text | |
| supply_model | supply_model | enum `supply_model` | default `bulk_truck` |
| litres_per_ton | litres_per_ton | numeric(10,2) **null** | NULL for `pre_kegged`; CHECK: `bulk_truck` requires a value |
| litres_per_keg | litres_per_keg | numeric(10,2) | per-product |
| keg_sell_price | keg_sell_price | numeric(12,2) **null** | NULL = container not sold outright |
| varieties[] | → `product_varieties` | — | child table, not a column |
| color_light / color_dark | color_light / color_dark | text | hex strings |
| — | created_at / updated_at | timestamptz | |

### `ProductVariety` → `product_varieties`
| TS field | column | type | notes |
|---|---|---|---|
| id | id | text PK | `'veg-soya'` … |
| — | product_id | text | **FK** → products(id) ON DELETE CASCADE |
| name | name | text | |
| rate_delta_per_litre | rate_delta_per_litre | numeric(12,2) | added to tier rate; may be negative |
| (array position 0 = default) | sort_order | int | lowest = product default |

### `Supplier` → `suppliers`
| id | id | text PK | `'sup-1'` |
| name | name | text | |
| phone? | phone | text **null** | |

### `PhysicalTank` → `physical_tanks`
| id | id | text PK | `'pt-1'` |
| label | label | text | |
| product_id | product_id | text | **FK** → products(id) ON DELETE RESTRICT |
| capacity_litres | capacity_litres | numeric(12,2) | CHECK > 0 |
| notes? | notes | text **null** | |

### `RateCard` → `rate_cards`
| TS field | column | type | notes |
|---|---|---|---|
| product_id | product_id | text | **FK** → products(id) ON DELETE CASCADE; part of PK |
| tier | tier | enum `customer_type` | part of PK |
| rate_per_litre | rate_per_litre | numeric(12,2) | CHECK ≥ 0 |
| — | PRIMARY KEY | (product_id, tier) | TS interface has no `id` |

### `Customer` → `customers`
| id | id | text PK | `'cust-1'` |
| name | name | text | |
| type | type | enum `customer_type` | |
| credit_limit | credit_limit | numeric(14,2) | default 0 |
| credit_term_days | credit_term_days | int | default 14 |
| phone | phone | text | default `''` |
| created_at? | created_at | timestamptz | |
| — | currentBalance / creditBalance / agingBadge / openOrders / totalCompanyKegsOut | — | **derived** (`calculateCustomerStats`) |

### `Tank` → `tanks`
| TS field | column | type | notes |
|---|---|---|---|
| id | id | text PK | `'tank-v1'`, `'tank-<ts>'` |
| product_id | product_id | text | **FK** → products(id) RESTRICT |
| truck_label | truck_label | text | |
| tons | tons | numeric(10,3) | 0 for pre-kegged intake |
| received_litres | received_litres | numeric(12,2) | |
| remaining_litres | remaining_litres | numeric(12,2) | CHECK ≥ 0; decremented by FIFO draw |
| date | date | timestamptz | FIFO orders by this |
| shortfall | shortfall | numeric(12,2) | expected − recovered litres |
| supplier_id? | supplier_id | text **null** | **FK** → suppliers(id) SET NULL |
| space_note? | space_note | text **null** | |
| physical_tank_id? | physical_tank_id | text **null** | **FK** → physical_tanks(id) SET NULL |
| supply_model? | supply_model | enum **null** | |
| last_dipstick_reading? | last_dipstick_reading | numeric(12,2) **null** | denormalized cache of newest dipstick |
| last_dipstick_variance? | last_dipstick_variance | numeric(12,2) **null** | denormalized cache |
| index | `idx_tanks_product_date (product_id, date)` | | hot path: FIFO |

### `Pump` → `pumps`
| id | id | text PK | `'p-1'` |
| label | label | text | |
| product_id? | product_id | text **null** | **FK** → products(id) SET NULL |
| last_meter_reading | last_meter_reading | numeric(14,2) | monotonic odometer cache |

### `PumpReading` → `pump_readings`
| id | id | text PK | `'pr-1'`, `'pr-<ts>'` |
| pump_id | pump_id | text | **FK** → pumps(id) CASCADE |
| reading | reading | numeric(14,2) | |
| recorded_at | recorded_at | timestamptz | |
| note? | note | text **null** | |
| index | `idx_pump_readings_pump (pump_id)`, `(pump_id, recorded_at)` | | |

### `PumpVarianceAudit` → *not stored*
Entirely **derived** by `calculatePumpMeterVariance` from `pump_readings` + `orders`.

### `Order` → `orders`
| TS field | column | type | notes |
|---|---|---|---|
| id | id | text PK | `'ord-101'`, `'ord-<ts>'` |
| customer_id | customer_id | text | **FK** → customers(id) RESTRICT; `idx_orders_customer_id` |
| product_id | product_id | text | **FK** → products(id) RESTRICT |
| unit | unit | enum `unit_type` | |
| qty | qty | numeric(12,2) | |
| litres | litres | numeric(12,2) | = `calculateLitres(unit, qty, …)` at write time |
| rate | rate | numeric(12,2) | effective rate/litre charged |
| amount | amount | numeric(14,2) | oil + keg |
| paid_amount | paid_amount | numeric(14,2) | mutated in place by payments today (see Gaps) |
| payment_method | payment_method | enum `payment_method` | `cash`/`transfer`/`credit`/`pos`; `idx_orders_payment_method` |
| keg_source | keg_source | enum `keg_source` **null** | NULL = non-keg / unspecified |
| keg_price? | keg_price | numeric(12,2) **null** | set when `keg_source='purchased'` |
| keg_amount? | keg_amount | numeric(14,2) **null** | qty × keg_price |
| discount_reason? | discount_reason | text **null** | required by app when rate < rate card |
| pricing_tier? | pricing_tier | enum `customer_type` **null** | tier the rate came from (counter can override) |
| variety_id? | variety_id | text **null** | **FK** → product_varieties(id) SET NULL |
| variety_name? | variety_name | text **null** | snapshot label |
| date | date | timestamptz | `idx_orders_date` |
| due_date | due_date | timestamptz **null** | set only for `payment_method='credit'`; `idx_orders_due_date` |
| source_tank_id | source_tank_id | text **null** | **FK** → tanks(id) SET NULL; **first** FIFO tank only — full split in `order_tank_allocations` |
| pump_id | pump_id | text **null** | **FK** → pumps(id) SET NULL; `idx_orders_pump_id`; NULL for pre-kegged |
| meter_reading? | meter_reading | numeric(14,2) **null** | |
| meter_delta? | meter_delta | numeric(14,2) **null** | reading − previous reading |
| meter_variance? | meter_variance | numeric(14,2) **null** | delta − litres |
| delivered_qty? | delivered_qty | numeric(12,3) **null** | |
| shortfall? | shortfall | numeric(12,3) **null** | qty − delivered_qty |
| note? | note | text **null** | |

### `TankDrawAllocation` / `TankDrawResult` → `order_tank_allocations` (**new**)
| concept | column | type | notes |
|---|---|---|---|
| — | id | bigint identity PK | |
| — | order_id | text | **FK** → orders(id) CASCADE |
| tankId | tank_id | text | **FK** → tanks(id) RESTRICT |
| drawnLitres | drawn_litres | numeric(12,2) | CHECK > 0 |
| remainingAfterDraw | remaining_after_draw | numeric(12,2) **null** | NULL when backfilled |
| (order in `allocations[]`) | draw_sequence | int | 1 = oldest tank |
| — | UNIQUE (order_id, tank_id) | | |

### `KegReturn` → `keg_returns`
| id | id | text PK | `'ret-1'` |
| customer_id | customer_id | text | **FK** → customers(id) RESTRICT; `idx_keg_returns_customer_id` |
| qty | qty | numeric(10,2) | CHECK > 0 |
| date | date | timestamptz | |

### `Transfer` → `transfers`
| id | id | text PK | `'trf-1'`, `'tr-<ts>'` |
| from_customer_id | from_customer_id | text | **FK** → customers(id) RESTRICT; `idx_transfers_from` |
| to_customer_id | to_customer_id | text | **FK** → customers(id) RESTRICT; `idx_transfers_to` |
| item_type | item_type | enum `transfer_item_type` | only `'keg'` today |
| qty | qty | numeric(10,2) | CHECK > 0 |
| product_id? | product_id | text **null** | **FK** → products(id) SET NULL |
| date | date | timestamptz | |
| note? / notes? | note | text **null** | two TS fields → one column |
| — | CHECK from ≠ to | | |

### `CustomerCredit` → `customer_credits`
| id | id | text PK | `'cc-<ts>'` |
| customer_id | customer_id | text | **FK** → customers(id) RESTRICT; `idx_customer_credits_customer_id` |
| amount | amount | numeric(14,2) | **> 0 added** (overpayment), **< 0 redeemed**; append-only ledger |
| source_payment_id? | source_payment_id | text **null** | receipt ref string (`'PAY-123456'`) — **not a FK yet** (no payments table) |
| created_at | created_at | timestamptz | |
| note? | note | text **null** | |
| — | balance | — | **derived**: `max(0, SUM(amount))` per customer |

### `TankDipstickReading` → `tank_dipstick_readings`
| id | id | text PK | `'ds-1'`, `'dip-<ts>'` |
| tank_id | tank_id | text | **FK** → tanks(id) CASCADE; `idx_dipstick_tank_id` |
| reading_litres | reading_litres | numeric(12,2) | CHECK ≥ 0 |
| system_litres? | system_litres | numeric(12,2) **null** | `tank.remaining_litres` at reading time |
| recorded_at | recorded_at | timestamptz | |
| variance? | variance | numeric(12,2) **null** | reading − system |
| is_flagged? / isOverThreshold? | is_flagged | boolean | two TS fields (same value) → one column |
| note? / notes? | note | text **null** | two TS fields → one column |

### `Shift` → `shifts`
| id | id | text PK | `'shift-1'` |
| supervisor_name? | supervisor_name | text **null** | |
| cashier_name? | cashier_name | text **null** | free text — **no FK to a user** (see Gaps) |
| start_time | start_time | timestamptz | |
| end_time? | end_time | timestamptz **null** | |
| opening_float | opening_float | numeric(14,2) | |
| opening_readings? | opening_readings | **jsonb** | `{"p-1": 12450, "p-2": 8920}` — pump id → opening odometer |
| cash_sales? | cash_sales | numeric(14,2) **null** | filled at close; `computeShiftCash` |
| cash_expenses? | cash_expenses | numeric(14,2) **null** | |
| expected_cash? | expected_cash | numeric(14,2) **null** | opening_float + cash_sales − cash_expenses |
| cash_counted? | cash_counted | numeric(14,2) **null** | |
| cash_variance? | cash_variance | numeric(14,2) **null** | counted − expected |
| note? / notes? | note | text **null** | two TS fields → one column |
| status | status | enum `shift_status` | `open`/`closed`; partial unique index `uniq_one_open_shift` enforces one open shift |

### `Expense` → `expenses`
| id | id | text PK | `'exp-1'` |
| date | date | timestamptz | `idx_expenses_date` |
| category | category | text | **free text** (app allows arbitrary); `expense_categories` is a soft lookup only; `idx_expenses_category` |
| amount | amount | numeric(14,2) | CHECK > 0 |
| note? | note | text **null** | |

### `EXPENSE_CATEGORIES` (const array) → `expense_categories` (**new lookup**)
| name | name | text PK | the 5 seed categories |
| — | sort_order | int | UI ordering |

### `AppSettings` → `app_settings` (single row, `id = 1`)
Every field maps 1:1 to a NOT NULL typed column: `company_name`, `company_phone`,
`company_address`, `company_logo_url` (**null**), `litres_per_keg`,
`total_company_kegs`, `kegs_at_depot_low_threshold`, `low_stock_litres_threshold`,
`truck_shortfall_threshold`, `pump_variance_threshold`,
`dipstick_variance_threshold`, `default_daily_float`, `daily_float`.

### `UserRole` → `profiles.role` (in `0002`)
| — | id | uuid PK | **FK** → `auth.users(id)` CASCADE |
| role | role | enum `user_role` | default `'staff'` (app localStorage default is `'owner'`; least-privilege wins server-side) |
| — | full_name | text **null** | |
| (localStorage `iyanu_theme_v2`) | theme | text | `light`/`dark` |
| (localStorage `iyanuoluwa_ai_provider_pref`) | ai_provider | text **null** | |
| (localStorage `iyanuoluwa_ai_gemini_model`) | ai_gemini_model | text **null** | |
| (localStorage `iyanuoluwa_ai_claude_model`) | ai_claude_model | text **null** | |

### Derived-only types (no table)
`KegInventorySummary`, `CustomerCalculatedStats`, `PaymentApplicationResult`,
`ReceiptData`, `PumpVarianceAudit`, `IntakeMetrics`, `ShiftOpeningGateStatus` —
all computed at read time in `businessLogic.ts` / `store.tsx`.

---

## Gaps / not yet modeled

| # | Gap | Recommendation | Sketch |
|---|---|---|---|
| 1 | **Split-tank FIFO provenance.** `orders.source_tank_id` keeps only the first tank of a multi-tank draw. | **Add now** — done: `order_tank_allocations`. | see table above |
| 2 | **Payments.** `recordCustomerPayment` / `redeemCustomerCredit` mutate `orders.paid_amount` in place. No payment row, no reversal, no record of which invoices a payment hit, no link from `customer_credits.source_payment_id` to anything real. | **Add (deferred)** — needs the two store actions rewritten; do it with the Supabase wiring via `post_customer_payment()` RPC. | `payments(id text pk, customer_id text fk, amount numeric(14,2), method payment_method, received_at timestamptz, shift_id text fk null, recorded_by uuid fk profiles null, note text)` · `payment_allocations(id bigint identity pk, payment_id text fk cascade, order_id text fk restrict, amount_applied numeric(14,2) check >0, unique(payment_id, order_id))` · then `customer_credits.source_payment_id` → real FK to `payments`. |
| 3 | **Audit log / activity trail.** No history of who created/edited/voided anything; corrections today are silent in-place mutations. | **Add (deferred)** — cheap, high value once multi-user. | `audit_log(id bigint identity pk, actor uuid fk profiles null, action text, entity_table text, entity_id text, before jsonb, after jsonb, at timestamptz default now())`; write via `AFTER` triggers or the RPCs. |
| 4 | **Receipt / waybill documents.** `ReceiptModal` renders two formats — `commercial` (with prices) and `dispatch`/waybill (no prices) — from `ReceiptData` at print time. Nothing records that a document was issued, its number (`REC-…`, `PAY-…`, `CRD-…`), or which format. | **Add (deferred)** — needed for reprints / dispute trail. | `issued_documents(id text pk /* the REC-/PAY- number */, kind text check in ('order_receipt','payment_receipt','waybill'), format text check in ('commercial','dispatch'), order_id text fk null, payment_id text fk null, customer_id text fk, payload jsonb, issued_by uuid fk profiles null, issued_at timestamptz default now())`. |
| 5 | **Per-user preferences** (`theme`, `iyanu_user_role_v2`, `iyanuoluwa_ai_provider_pref`, `iyanuoluwa_ai_gemini_model`, `iyanuoluwa_ai_claude_model`) live only in `localStorage`. | **Add now** — done: folded into `profiles` columns (`theme`, `ai_provider`, `ai_gemini_model`, `ai_claude_model`). AI *report cache* (`iyanuoluwa_ai_last_report`) stays client-side (ephemeral). | see `profiles` above |
| 6 | **Shift ↔ cashier/supervisor is free text.** `shifts.cashier_name` / `supervisor_name` are strings, not user references. | **Deferred** — add `opened_by uuid`, `supervised_by uuid`, `closed_by uuid` (FK → `profiles`) when auth is live; keep the text columns as fallback for pre-auth data. | `alter table shifts add column opened_by uuid references profiles(id), add column closed_by uuid references profiles(id);` |
| 7 | **`EXPENSE_CATEGORIES` was a hard-coded array.** | **Add now** — done: `expense_categories` lookup (seeded). `expenses.category` stays free text (app permits arbitrary categories) — the lookup only drives the dropdown. | see table above |
| 8 | **Keg "outright purchase" vs "loan" is only inferable** from `orders.keg_source` (`'purchased'` vs `'company'`) and there is no keg-container ledger — `kegs_at_depot` etc. are all recomputed from orders + `keg_returns` every render. | **Deferred** — a `keg_ledger(id, customer_id, direction text check in ('out_loan','out_sold','return','transfer_in','transfer_out'), qty, order_id fk null, transfer_id fk null, keg_return_id fk null, at timestamptz)` movement table would make the balance a running total instead of a full re-scan, and make outright sales explicit. Low priority until keg volume hurts. | as above |
| 9 | **No staff/user table beyond `profiles`.** No contact info, employment status, PIN for counter login, assigned pump, etc. | **Deferred** — extend `profiles` (`phone`, `active bool`, `counter_pin_hash`) rather than a new table. | `alter table profiles add column phone text, add column active boolean not null default true;` |
| 10 | **Tank dipstick `last_*` caches on `tanks`** duplicate the newest `tank_dipstick_readings` row. | **Keep** — intentional denormalization for list rendering; refresh in the dipstick RPC / trigger. | — |
| 11 | **`orders.source_tank_id` is also the only thing linking an order to a *physical* tank / supplier.** With #1 fixed the join path is order → allocation → tank → physical_tank / supplier. | **OK** — covered by `order_tank_allocations`. | — |
| 12 | **Credit-limit / discount overrides are not recorded.** The app blocks a below-rate-card sale unless a `discount_reason` is typed, but there is no approver, no over-limit approval record. | **Deferred** — `approve_credit_override()` RPC stub in `0002`; add `orders.override_approved_by uuid`, `orders.override_approved_at timestamptz`. | — |
| 13 | **`resetToSeedData()` ("factory reset")** is a client action that wipes localStorage. | **Deferred** — `factory_reset()` owner-only `SECURITY DEFINER` RPC stub in `0002`. | — |
| 14 | **No product ↔ physical_tank ↔ pump wiring table.** Which pump draws which physical tank is implied by naming only. | **Deferred / low value.** | `pump_tank_links(pump_id, physical_tank_id, primary key(pump_id, physical_tank_id))` if it ever matters. |

---

## RLS summary (`0002_auth_rls.sql`)

- **`app_current_role()`** — the brief's `current_role()`, renamed because
  `current_role` is a built-in Postgres function. `SECURITY DEFINER` + `stable`,
  reads `profiles` for `auth.uid()`; the definer context is required so calling
  it from a `profiles` policy does not recurse.
- **Read:** every `authenticated` user can `SELECT` every operational table.
- **`staff` + `owner`:** `INSERT`/`UPDATE` on `orders`, `order_tank_allocations`,
  `keg_returns`, `transfers`, `tank_dipstick_readings`, `pump_readings`,
  `expenses`, `shifts`, `customer_credits`, `customers`, `tanks`.
- **`owner` only:** `INSERT`/`UPDATE`/`DELETE` on `products`,
  `product_varieties`, `rate_cards`, `suppliers`, `physical_tanks`, `pumps`,
  `app_settings`, `expense_categories`.
- **`driver`:** `INSERT` into `tanks` (truck intake) + read everything. No other
  writes.
- **No `DELETE`** policy on the transaction tables — they are append-only;
  reversals/corrections are meant to go through `SECURITY DEFINER` RPCs.
- **`profiles`:** self-read (owner reads all), self-insert, self-update for
  preferences; only an `owner` can change a `role` (enforced by the
  `profiles_guard_role` trigger).
- The Supabase **`service_role`** key and the table owner bypass RLS — that is
  how `seed.sql` and server-side jobs write freely.
- **RPC stubs** (signatures only, bodies deferred): `revalidate_fifo_tank_draw`,
  `approve_credit_override`, `post_customer_payment`, `factory_reset`.

---

## How to apply

Requires the Supabase CLI (`npm i -g supabase`) or `psql`.

```bash
# One-time
supabase init                         # if this repo has no supabase/config.toml yet

# Local dev DB: apply every migration, then seed.sql, from scratch
supabase db reset

# Apply new migrations to a running/linked project without wiping data
supabase migration up
supabase db push                      # for a linked remote project

# Or straight psql (set SUPABASE_DB_URL — see .env.example)
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_auth_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

`0002` references the `auth.users` table and the `auth.uid()` function, so it
only runs on a real Supabase database (local `supabase start` or hosted), not a
bare Postgres without the `auth` schema.

### Validation done here

All three files were parsed with **libpg_query** (the actual PostgreSQL parser,
via `pglast`): `0001_init.sql` 57 statements, `0002_auth_rls.sql` 29,
`seed.sql` 18 — all parse clean. Full execution against a live PostgreSQL 15 was
**not** possible in this environment (no `psql`, Docker daemon not running, no
`supabase` CLI), so runtime checks — FK resolution order, `auth` schema
references, the dynamic SQL built inside the `DO` blocks — were reviewed by hand
but not executed.
