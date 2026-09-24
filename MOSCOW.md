# Iyanuoluwa Digital Operations — MoSCoW Requirements

No MoSCoW document existed anywhere in this repo before this file — see `README.md`
(empty), `STITCH-UI-BRIEF.md` (a UI/design description, not a requirements doc), and
`supabase/SCHEMA.md` (a database gap-analysis table, not a feature priority list).
This one is reverse-engineered from what's actually built, what the client asked for
and got, and what's been explicitly deferred or ruled out along the way — not copied
from an external spec, because none exists in this project. Correct anything that
doesn't match your intent.

**Status key:** ✅ shipped and live on `main` · 🚧 partially built · ⏳ not started.

---

## Must have

Core to running the depot counter day-to-day. The app doesn't work as a
replacement for pen-and-paper without these.

| Requirement | Status |
|---|---|
| Truck intake — record bulk tanker deliveries and pre-kegged deliveries, track remaining litres per tank, flag shortfall vs. declared tonnage | ✅ |
| Pack-size pricing — price by variety × pack size × tier (not a flat per-litre rate card) | ✅ |
| New Sale — click-first multi-line sale entry (multiple products/pack sizes per sale) | ✅ |
| Transactions ledger — every sale, payment, expense, void, edit, in one place, with an audit trail (who/what/when/why) | ✅ |
| Customer credit — running balance, FIFO payment allocation across outstanding sales, store credit | ✅ |
| Customer statement — printable / WhatsApp-shareable, itemized history | ✅ |
| Receipts & waybills — thermal 80mm commercial (with prices) and dispatch (contents only) formats | ✅ |
| Kegs ledger — loaned vs. outright-purchased containers, returns, outstanding-kegs balance per customer | ✅ |
| Pumps — register, daily meter readings, per-day/per-product reconciliation | ✅ |
| Shift opening-meter gate — block a bulk sale until every pump's opening reading is logged for the day, as a real blocking modal | ✅ |
| Expenses & shift cash reconciliation — petty cash, float, expected-vs-counted cash variance per shift | ✅ |
| Dashboard — stock levels, cash position, credit exposure, low-stock/overdue alerts at a glance | ✅ |
| Depot-correct timestamps — everything keyed to Africa/Lagos time, with backdating support for late entry | ✅ |

## Should have

Materially improves the experience but the depot could still run without them —
mostly already delivered as follow-on polish this session.

| Requirement | Status |
|---|---|
| Light/dark theme, user-toggleable, with a smooth cross-fade transition | ✅ |
| Consistent thin/bold icon language (Phosphor icons, bold only on active/selected/primary) | ✅ |
| Directional screen-slide animation between nav tabs | ✅ |
| Inventory tab — stock overview separate from the dashboard | ✅ |
| Multi-hub architecture — multiple depot locations, hub-scoped data, a hub-manager role | ✅ |
| AI Operations Advisor — plain-language summary of the day's numbers and anomalies | ✅ |
| Settings — editable products, pack sizes/prices, pumps, categories, roles, without touching code | ✅ |
| Server-backed persistence (Supabase/Postgres) instead of `localStorage` only | 🚧 — two layers today: **wired and live** are auth (`auth.users`/`profiles`) plus every Settings-managed master table (`hubs`, `app_settings`, `suppliers`, `physical_tanks`, `pumps`, `products`, `product_varieties`), the logo in Storage, and the public branding RPC. **Still `localStorage`-only** are all transactional tables — `sales`/`orders`/`sale_payments`, `customers`, `customer_credits`, `expenses`, `shifts`, `pump_readings`, `keg_returns`, `transfers`, `tank_dipstick_readings` — plus the pack-price matrix (`pack_prices` table doesn't exist yet), so sales/debts/prices still don't travel between devices. |
| Server-side audit log (`audit_log` table) surviving a browser/device change | 🚧 — client-side `AuditEntry` log exists and is complete; nothing persists past `localStorage` |
| Issued-document registry — record that a receipt/waybill/payment slip was printed, its number, for reprints and disputes | ⏳ |

## Could have

Genuinely useful, explicitly lower priority — worth doing once the above is solid,
not before.

| Requirement | Status |
|---|---|
| Multi-user auth with real login (PIN or password) and per-user attribution instead of a role switch | ⏳ — RLS/`profiles` scaffolding exists in `supabase/migrations/0002_auth_rls.sql`, not wired to the UI |
| Credit-limit / discount-override approval workflow (who approved a below-rate-card sale) | ⏳ — RPC stub exists (`approve_credit_override`), no approver record kept today |
| Keg ledger as a real running-total table instead of recomputed-on-every-render from orders + returns | ⏳ — fine at current volume; flagged as low priority in `supabase/SCHEMA.md` until keg volume grows |
| Installable PWA (add-to-homescreen, offline shell) | ⏳ |
| Pump-to-physical-tank wiring as a formal join table (today it's a direct field on `Pump`, which is enough for one tank per pump) | ⏳ |

## Won't have (this phase)

Considered and explicitly rejected, or replaced and not coming back.

| Requirement | Why not |
|---|---|
| Tank dipstick physical-verification readings | Client asked for outright removal ("its not needed") — fully removed from types, store, UI, and tests |
| Flat per-litre rate-card pricing | Superseded by pack-size pricing; the whole point of that overhaul was to retire it |
| The root `schema/*.sql` draft | Superseded by `supabase/` — inconsistent with `config.ts`, missing tables, no RLS; kept only for reference until deleted |
| Native mobile app | Out of scope — the responsive web app is mobile-first and covers the counter-tablet use case |
