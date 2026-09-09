# Iyanuoluwa Digital Operations — UI Brief (current state)

A design description of the app as it stands today, for regenerating / redesigning the UI in Google Stitch. Everything below reflects the built app, not a proposal.

---

## 1. Product

**What it is:** an internal operations console for a Lagos vegetable-oil and palm-oil depot. One depot, a handful of staff. It runs the counter: receiving oil by truck, dispensing sales, tracking customer credit, tracking returnable kegs, logging petty-cash expenses, and reconciling the cash drawer per shift.

**Platform:** responsive web app, mobile-first, also used on desktop. Installable-PWA is planned but not built. Light and dark themes, user-toggleable.

**Primary users:** counter staff (cashiers), a driver/loader, and the owner. Non-technical. Fast, glanceable, few taps.

**Currency & units:** Nigerian Naira `₦` (grouped thousands, 0–2 decimals). Volume in litres `L`. Bulk in metric tons. Containers are 30 L "kegs" (yellow jerrycans). All numbers use tabular (monospaced) figures.

---

## 2. Design system

### Color

| Role | Value | Use |
|---|---|---|
| Brand / primary | `#00B749` (green) | primary buttons, active nav, key figures, focus |
| Brand scale | `#ecfdf5` → `#064e3b` | tints and hovers |
| Golden Vegetable Oil | `#F59E0B` (amber), light `#FCD34D`, dark `#B45309` | veg product accents, veg tank liquid |
| Red / Palm Oil | `#EF4444` (red), light `#F87171`, dark `#7F1D1D` | palm product accents, palm tank liquid |
| Danger / money owed / expense | rose (`rose-500/600`) | credit outstanding, overdue, expenses, destructive |
| Warning | amber (`amber-500`) | soft warnings, near-threshold variance |
| Positive / cash in | emerald (`emerald-500/600`) | cash & transfer sales, success, "settled", store credit |
| Pump / meter / transfers | purple (`purple-600`) | pump metering, inter-customer transfers |
| Wholesale / tonnage | blue (`blue-500`) | bulk-ton sale card |
| Bank transfer | sky (`sky-500`) | transfer payment dot |
| Neutrals | slate scale | text, borders, surfaces |

**Surfaces:** light page background `slate-50` / `slate-100`; cards white. Dark page `slate-950`; cards `slate-900`. Borders 1px, `slate-200` light / `slate-800` dark.

**Special surface:** the New Sale screen uses a kraft-paper noise texture (`bg-rough-paper`, warm off-white `#f7f4ed` with SVG grain; dark variant `#0f172a`). Used only on that screen today.

### Typography

- **Headings:** "Plus Jakarta Sans", weights 600/700/800.
- **Body / labels:** "IBM Plex Sans", 400–700.
- **Numbers, codes, meters, money:** "IBM Plex Mono" with `tabular-nums`.
- **Sizes in use** (the app hard-codes pixel sizes): page title 24px bold; section heading 18px semibold; card KPI number 32px mono bold; body 14px; field label 12px uppercase with wide letter-spacing; metadata 11px; micro tags 10–11px.

### Shape, elevation, spacing

- Radius: cards `16px` (rounded-2xl), inputs & buttons `12px` (rounded-xl), small chips `8px`, pills fully round.
- Elevation: cards get a soft `shadow-sm`; modals/sheets `shadow-2xl`; a few elements request a non-standard `shadow-xs` that currently renders flat.
- Rhythm: 24px between major blocks, 16–20px card padding, 8–12px between controls.
- Content max width 1280px, centered, 16–32px gutters.

### Iconography

Lucide icons, 16–20px, tinted to the semantic color of their context (e.g. rose clock for overdue, purple gauge for pump, emerald check for success).

### Motion

- Tank liquid: continuous horizontal/vertical wave animation.
- Critical alerts (low keg stock, overdue): gentle `pulse`.
- Sheets slide up; drawers slide in from the right; modals fade + zoom.
- No reduced-motion handling today.

---

## 3. Global layout & navigation

### Desktop (wide)

- **Left icon rail**, 72px wide, expands to ~288px on hover. Shows: brand mark (droplet) + "IYANUOLUWA / Digital Operations", then nav items with icon + label, a collapsible alert summary card at the bottom, and a user card with a 3-way role switch (Owner / Staff / Driver — currently cosmetic).
- **Top header**, 64px: breadcrumb ("Depot Counter / <tab>") + page title on the left; on the right a "Total Stock … L" pill, a "Depot Kegs …" pill (turns rose when critical), a live date-time clock with "Lagos Depot Online" status dot, a theme toggle, and a prominent green "Quick Dispense" button.
- **Main area:** single scrolling column, centered, generous padding.

### Mobile

- **Top header:** hamburger, small logo + "Iyanuoluwa", theme toggle.
- **Bottom tab bar**, fixed, 64px, 5 items: Dashboard, Intake, **Dispense** (center, raised circular FAB in brand green), Customers, Kegs. Badges appear on Customers when invoices are overdue.
- **Hamburger drawer:** left slide-in with the full 7-item menu (adds Expenses, Settings) plus the role switch.

### Nav destinations

Dashboard · Truck Intake · New Sale (a.k.a. Dispense) · Customers · Kegs Ledger · Expenses · Settings.

### Responsive breakpoint

Screen-internal layouts switch between mobile and desktop at **900px** (a custom `split:` breakpoint), while the app shell switches at ~1024px. (These two lines don't coincide — a known inconsistency to fix in redesign.)

---

## 4. Screens

### 4.1 Dashboard — "Depot overview"

Vertical stack:

1. **Welcome / action banner:** big title with a "Live Real-Time" pill, one-line subtitle, and two quick actions ("Log Truck Intake" neutral, "Quick Dispense" green).
2. **Shift banner:** shield icon + "Counter Cashier Shift Active" / "No Active Counter Shift" with a status pill; cashier name + start time. When a shift is open, a 4-cell mini-grid: Opening Float, Cash Sales (+), Cash Expenses (−), Expected Cash. Right side: "Start New Shift" or "Reconcile & Close Shift". Inline green success / rose error messages appear above.
3. **KPI grid** — 6 tappable cards (2 columns mobile, 3 tablet, 6 desktop). Each: 12px uppercase label, small icon top-right, 32px mono value, a sub-line. Cards: **Cash & Transfer** (emerald value), **Credit Ledger** (rose-tinted card), **Company Kegs Out**, **Kegs at Depot** (rose card + pulse when below threshold), **Customer Kegs** filled today, **Expenses Today** (rose-tinted). Tapping a card opens a detail panel (drawer on desktop, bottom sheet on mobile) with a breakdown list and a "go to full screen" button.
4. **Depot pumps:** purple-accented section, one card per pump — pump name with a color dot, cumulative meter reading, litres dispensed today, and a badge: "Meter Normal" (emerald) or "Variance Alert (+NL)" (rose).
5. **Volumetric tanks:** two panels side-by-side (Golden Vegetable Oil, Red / Palm Oil). Each: a large vertical **tank gauge** with animated liquid, total litres and keg-equivalent, and a list of active in-feed tanks (truck label, intake date, received litres, % full).
6. **Risk signals:** heading + count. Mobile shows a condensed prioritized list (top 3 + "view all N" sheet). Desktop shows a grid of six alert-stream cards, each with a count badge, a list of rows, and an empty state: Overdue Invoices, Credit Cap Breaches, Truck Shortfall, Pump Meter Variance, Tank Dipstick Variance, Shift Drawer Discrepancy.

**Modals:** Start Shift (cashier, opening float, notes); Reconcile & Close Shift (opening float / cash sales / cash expenses / expected breakdown, physical count input, live variance feedback that turns emerald/rose/amber, handover notes).

### 4.2 Truck Intake — "Receive oil by truck"

- **Banner** + a "Depot Kegs" pill. Sticky green success message after logging.
- **Two columns (desktop):**
  - **Left form:** product picker (2 chips showing L/Ton), truck plate, driver name, delivery weight in tons (with "TONS" suffix), actual kegs filled, leftover recovered litres. An amber "Depot Keg Capacity Warning" banner appears if expected kegs exceed empties on hand. Submit: "Complete Offload & Animate Tank Fill".
  - **Right:** a **Live Volumetric Conversion** card (expected litres, expected 30 L kegs, recovered volume, and a colored "Delivery Variance" gauge — emerald clean / amber minor / rose flagged). Below it, a **Live Tanker Simulation**: a detailed SVG side-view tanker truck with a horizontal left-to-right liquid fill, driver silhouette in the cab, a green leader line to a driver-name pill, capacity plate, a color-coded product placard ("VEG-1090" / "PALM-1085"), a discharge valve, and a connected-pump badge.
- **Fleet history:** all storage tanks as cards. Mobile: compact rows with a thin fill bar. Desktop: 2-column grid of full tanker illustrations, each with a **Physical Dipstick Audit** strip — status badge (Verified / Variance ±NL / Awaiting First Stick) and a "Record Dipstick" button.
- **Modal:** Record Physical Tank Dipstick — ledger balance vs. product, a physical reading input, a live variance preview (emerald within tolerance / rose over threshold), optional notes.
- **Tank detail** drawer/sheet: the tanker illustration, intake capacity vs. available stock, dipstick status + action, a dipstick audit log, and recent orders drawn from that product batch.

### 4.3 New Sale — "Dispense & invoice"

Layout: **60 / 40 split at ≥900px.** Left form is on the kraft-paper texture; right is a fixed, sticky "Customer Sale Ticket".

**Left form (in order):**
- Error banner (when validation fails).
- **Customer Account** dropdown (name, tier, credit limit).
- **Product Type** — two chips (amber = veg, rose = palm).
- **Dispense Pump Meter Line:**
  - a collapsible inline "Log Pump Meter" tool (pump select, new cumulative reading, note, Save) for routine calibration;
  - three pump buttons — pumps for the *other* product are shown disabled at 40% opacity with a "Locked" tag and "Golden Oil Only" / "Palm Oil Only" caption;
  - once a pump is chosen: a per-order meter reading input with a "Fill Expected (+N L)" helper and live **delta / variance** feedback (emerald ok, amber flagged).
- **Volume & Unit** — a 3-way toggle (Keg / Litres / Tons) plus a right-aligned quantity input; live "= N Litres" readout. When Tons: a blue wholesale card with an optional "delivered tons" field and a shortfall calc. Quick-add chips (+1/+5/+10/…).
- **Container / Jerrycan Source** (only for Keg) — two cards: Company-Owned Keg (returnable, logged) vs Customer-Owned Keg (bypasses return ledger).
- **Payment Terms / Method** — three chips: Credit / Cash / Transfer.
- **Soft warnings:** an amber "Depot Keg Shortage" panel and/or a rose "Credit Limit Breach" panel, each with a "Review & Authorize Override →" action that opens a blocking decision modal. Once authorized, an "Override Authorized" chip shows and can be revoked.
- Optional sale note.
- Submit: "Complete Sale & Issue Official Receipt".

**Right "Customer Sale Ticket" panel (sticky, paper texture):**
- Header: receipt icon + "Customer Sale" + customer-type pill.
- Customer + payment method row.
- Line breakdown: product, volume dispensed (with keg/litre count), price per litre, rate per 30 L keg, keg packaging, pump line, credit due date.
- Dashed divider, then a large emerald **Total Sale Value** (28px).
- A primary action button repeated inside the panel.
- On mobile the panel collapses to just the total + a "View Sale Details" toggle.

**Modals:** Keg Shortage authorization and Credit Cap Breach authorization — each shows the full numbers (requested vs available, projected balance vs limit, excess) and offers Cancel/adjust vs Authorize & Dispense.

### 4.4 Customers — "Ledger & credit aging"

- **Banner:** title + "Inter-Customer Transfer" and "Add New Customer" buttons.
- **Filter row:** chips (All / Overdue / High Balance / Corporate / Agent) + a name/phone search.
- **Master–detail:** desktop = a customer list (≈60%) beside a sticky detail panel (≈40%); mobile = list + bottom sheet.
- **List row:** initials avatar, name, type tag, **aging badge** (Current = green, "Due in N d" = amber, "Overdue N d" = rose + pulse), phone, terms; then balance (rose if owed, emerald if clear), kegs out, chevron. Direct "call" and (for overdue) "WhatsApp" buttons — WhatsApp opens a pre-filled polite reminder.
- **Detail panel:**
  - profile header with call / WhatsApp;
  - three metric tiles: Balance Due, Company Kegs, Credit Term;
  - a **Store Credit** banner (emerald) showing "₦X in credit" with an "Apply to invoices" button, shown only when the customer overpaid in the past;
  - an **in-panel payment** form: quick chips (Full Balance / ₦50k / ₦100k), amount input + method select, "Confirm & Record Payment";
  - **Open Credit Invoices** list — FIFO order, each row: qty + product, due date, remaining balance, Overdue/Active tag;
  - **Inter-Customer Transfers** history.
- **Modals:** Record Payment (quick chips, amount, Bank Transfer / Cash toggle, "payment applies to oldest invoice first" note, "Confirm Payment & Print Receipt"); Add Customer (name, tier, credit limit, terms, phone); Inter-Customer Transfer (from / to selects showing each side's kegs-out count, quantity in company kegs, notes, and an explainer that the depot's total fleet is unchanged).

### 4.5 Kegs Ledger — "Returnable container tracking"

- **Banner** + sticky success/error messages.
- **Three summary cards:** Total Company Fleet (settings-controlled, read-only), Kegs Out in Field, Kegs at Depot (rose + pulse when below the safety threshold).
- **Master–detail:** left = **Customer Keg Balance Matrix** — desktop is a sortable table (Customer / Supplied / Returned / Unreturned / Status), mobile is condensed rows with a "N Out" pill. Right = a persistent detail panel: customer name + "N Kegs Due" / "Settled" pill, three mini tiles (Supplied / Returned / In Custody), a "Log Depot Gate Return" form with quick-fill chips including "All", and that customer's movement history.
- **Depot Gate Ledger:** a combined chronological feed of physical returns (emerald "+N Return") and inter-customer transfers (purple "A ➔ B · N Transfer · depot stock unchanged"). Mobile shows top 3 + a "view full history" sheet.
- **Mobile sheets:** Log Keg Return, All Gate Movements.

### 4.6 Expenses — "Petty cash float"

- **Banner** + success/error messages.
- **Three float cards:** Opening Petty Cash Float (inline-editable via a pencil → check toggle), Spent Today (neutral, with voucher count), Net Float In Hand (emerald, turns rose if negative).
- **Two columns:** left = **Log Expense Voucher** form — category quick-select chips + a custom-category field, quick-add amount chips (₦1k / ₦5k / ₦10k / ₦50k), a ₦ amount field, a description, submit "Record Expense & Deduct from Float". Right = **Today's Itemized Ledger** — one row per voucher (category tag, time, note, −₦amount) with a running total in the header.

### 4.7 Settings — "Depot configuration"

- **Banner** + sticky status message.
- **Mobile:** an iOS-style grouped menu of 5 rows, each opening a bottom sheet: Company & Branding, Keg Fleet & Container Standards, Products & Rate Card Matrix, Safety & Variance Thresholds, Daily Float & System Controls.
- **Desktop:** five stacked section cards:
  1. **Company Profile & Branding** — logo upload / remove box (shows on nav and printed receipts), business name, phone, address.
  2. **Keg Configuration** — litres per keg, total company fleet, depot low-stock threshold.
  3. **Products & Rate Card Grid** — per-product litres-per-ton inputs, then a rate-card matrix table (Product × Retail / Agent / Corporate → ₦/L input → computed "effective 30 L keg price" in emerald).
  4. **Alert & Variance Thresholds** — low tank stock (L), truck offload shortfall (L), pump meter variance (L).
  5. **Daily Operations & System Tools** — default opening float; a 3-card operational role selector (Owner / Counter Staff / Driver); and a rose "Factory Reset Demo Seed Data" danger card with a confirm step.

---

## 5. Shared components

- **Bottom sheet (mobile):** bottom-anchored, drag handle, large top radius, max height ~85vh, header (title / subtitle / close), scrollable body. On ≥900px it renders as a centered modal instead.
- **Slide-over drawer (desktop):** right-anchored, full height, ~400–520px wide, slide-in from the right, dimmed blurred backdrop, closes on Escape.
- **Centered modal (hand-rolled):** blurred backdrop, ~420–520px, header with an icon chip + title + subtitle + ✕, body, right-aligned footer actions.
- **Receipt modal:** a dark shell wrapping a white "paper" area sized for 80mm thermal printing. Paper contents: company header (logo or "IO" monogram, name, address, phone, "OFFICIAL RECEIPT" pill), a metadata grid (receipt no, date/time, customer + type, payment method), a line-item table (or a "payment received" block for payments), a balances block (grand total, paid, previous balance, current outstanding — rose if owed, emerald if clear), and a footer ("Verified Authentic Depot Receipt", cashier name, print date). Actions: Close, Print.
- **Tank gauge:** a vertical tank with rounded corners, side tick marks (MAX / 75% / 50% / 25% / MIN), an animated wavy liquid surface, a product-colored gradient fill (amber for veg, red for palm), a % badge, and labels (product, litres, optional shortfall flag). Sizes: sm / md / lg.
- **Tanker illustration:** a detailed side-view SVG truck — cab with a driver silhouette, exhaust stack, wheels, a clipped horizontal left-to-right liquid fill with an idle wave and gloss highlight, a capacity plate (tons), a color-coded product placard, a rear discharge valve, a connected-pump badge, and a green leader line to a driver-name pill. A 4-cell metrics row sits beneath it (capacity in tons, received volume, current balance, offload shortfall with a "FLAGGED" tag when high).

---

## 6. Interaction patterns

- **Progressive disclosure:** tapping a KPI, an alert, or a tank opens a drawer (desktop) or bottom sheet (mobile) with the detail and a "drill through" action.
- **Master–detail** on Customers and Kegs (list + sticky panel on desktop, list + sheet on mobile).
- **Soft warning → explicit override:** risky sales (keg shortage, over credit limit) don't block outright; they surface a warning panel and require a manager-authorization modal that shows all the numbers.
- **Live previews while typing:** pricing, pump meter variance, dipstick variance, shift cash position, and tank depletion all recompute as fields change.
- **Inline editing / inline tools:** the daily float is edited in place; the pump-meter logger is a collapsible section within the sale form.
- **Contact deep links:** `tel:` and pre-filled WhatsApp reminders from customer rows.
- **Print** for receipts.
- Toasts auto-dismiss after ~4 seconds.

---

## 7. Known rough edges (useful if this is a redesign brief, not a re-skin)

- **Vocabulary is jargon-heavy** ("Volumetric Conversion", "FIFO Liquidation", "Reconcile & Close Shift", "Cumulative Meter", "Split Alert Stream"). A plain-language pass is planned.
- **Two responsive breakpoints** (900px for screen internals, ~1024px for the shell) don't line up.
- **Three different "expand for detail" patterns** across screens (CSS accordion, JS drawer/sheet swap, mixed).
- **Very small type** for meaningful data (10–11px, low-contrast slate) in tables, tank lists, and receipt metadata.
- **Density-heavy** cards with many tiny sub-values; the KPI numbers (32px) are the only strong focal points.
- The kraft-paper texture currently lives only on New Sale, so that screen looks different from the rest.
- Color coding is consistent and intentional (green = go / money in, rose = money owed / danger, amber = warning, purple = metering) — worth preserving in any redesign.
