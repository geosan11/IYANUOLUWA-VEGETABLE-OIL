# QA Report — Iyanuoluwa Digital Operations (deployed build)

**Scope:** read-only end-to-end QA of the **deployed** build — smoke, links, images, accessibility (axe-core) and responsive layout — across Chromium (desktop) and WebKit (iPhone 13).
**Run date:** 2026-09-29, run started 13:17 UTC (14:17 local), duration **6.5 min**.
**Build under test:** `https://iyanuoluwa-vegetable-oil.vercel.app` (the audited URL carries a Vercel share token; every URL in this report, in the logs and in the artifacts is reduced to the bare origin, so the token never leaves the gitignored `.env`).
**Toolchain:** Playwright 1.63.0 · `@axe-core/playwright` 4.13.0 (axe-core 4.13) · Node v24.19.0 · Windows.
**App source:** **not modified** — this pass only reads the running app (`git diff -- src api supabase` is empty). Nothing was committed.

---

## 1. Verdict

|                       | Result |
| --------------------- | ------ |
| Tests                 | **29** (25 passed, **4 failed**, 0 flaky, 0 skipped) |
| Deterministic?        | **Yes** — every failing test failed on **both** attempts (retries: 1) |
| Failures are app bugs | **4 / 4** — all are accessibility violations reproduced in both engines |
| Infrastructure / guard / inconclusive failures | **0** |
| Writes to production  | **0 attempted** (read-only guard never fired) |

**The deployed build is functionally green and accessibility-red.** Nothing is broken, missing or unreachable: every image loads and has an alt, every anchor is a real destination, no console/page/network errors, no horizontal overflow at 320/768/1440 px, the login gate and the signed-in shell both load clean on both engines. What fails is WCAG A/AA: **34 violation instances (rule × surface × engine) touching 264 element nodes** on the public + signed-in surfaces.

Blocking for an accessibility-focused release, not blocking for a functional release. Full log: `test-results/qa-run.log`.

---

## 2. How to reproduce

```bash
# one-off
npm ci
npx playwright install chromium webkit      # webkit is required: iPhone 13 is a WebKit device

# .env (gitignored) — see .env.example
#   BASE_URL=https://<deployment>.vercel.app?_vercel_share=<token>
#   QA_USERNAME=<owner account>      # omit to run the public-only subset
#   QA_PASSWORD=<password>

npm run qa                                  # full suite (this report)
npm run qa -- tests/links.spec.ts           # one spec
npm run qa -- --project="Desktop Chrome"    # one engine
QA_MAX_SCREENS=4 npm run qa                 # quick partial crawl
QA_READ_ONLY=0 npm run qa                   # lifts the write guard (do NOT use on production)
npx playwright show-report                  # HTML report (gitignored)
```

The run writes three machine-readable artifacts and one human report, all gitignored:

| Artifact | What it is |
| --- | --- |
| `test-results/qa-results.json` | Playwright JSON reporter — per-test status, attempts, durations, every `console.log` line |
| `test-results/qa-a11y-public-<project>.json` | Public-surface axe findings, node-level (`screen`, `rule`, `impact`, `helpUrl`, `target`, `html`, `why`) |
| `test-results/qa-a11y-signed-in-<project>.json` | Same, per reachable screen |
| `test-results/qa-run.log` | Raw console output of the reported run |
| `playwright-report/index.html` | HTML report with traces/screenshots for the 4 failures |
| `playwright/.auth/user.json` | Signed-in session for the audit projects (live tokens — gitignored) |

---

## 3. Results grid

`expected` = pass, `unexpected` = fail (both attempts). Durations are the sum of attempts.

| Spec | Test | Desktop Chrome | iPhone 13 |
| --- | --- | --- | --- |
| `auth.setup.ts:22` | sign in once and save the session | expected (10 s) | — (shared) |
| `smoke.spec.ts:10` | loads clean: HTTP < 400, a title, a heading, and no console/page/network errors | expected (4 s) | expected (5 s) |
| `smoke.spec.ts:24` | loads clean after restore-from-storageState, with the login card gone | expected (5 s) | expected (7 s) |
| `links.spec.ts:16` | every anchor is a real, reachable destination (public) | expected (16 s) | expected (4 s) |
| `links.spec.ts:45` | every anchor on every reachable screen is real and reachable (signed in) | expected (25 s) | expected (56 s) |
| `images.spec.ts:14` | every image loads and declares an alt (public) | expected (6 s) | expected (5 s) |
| `images.spec.ts:37` | every image on every reachable screen loads and declares an alt | expected (25 s) | expected (52 s) |
| `a11y.spec.ts:9` | axe reports no critical or serious violations (public) | **unexpected** (21 s) | **unexpected** (38 s) |
| `a11y.spec.ts:31` | axe reports no critical or serious violations on any reachable screen | **unexpected** (127 s) | **unexpected** (196 s) |
| `responsive.spec.ts:18` | no horizontal overflow at 320 / 768 / 1440 px (public) | expected (4 s × 3) | expected (6–9 s × 3) |
| `responsive.spec.ts:45` | no horizontal overflow at 320 / 768 / 1440 px (signed in) | expected (6–12 s × 3) | expected (7–9 s × 3) |

### Green evidence (exact counts from this run)

* **Crawl coverage:** **12 owner screens** visited on each engine — Dashboard, New Sale, Transaction ledger, Customers & Debt, Pumps, Truck Intake, Kegs Ledger, Products & pricing, Expenses & float, AI Advisor, Staff Management, Settings (the full sidebar; cap `QA_MAX_SCREENS=14`).
* **Links:** public surface **0 anchors** (login card ships none — logged explicitly so a green run cannot hide "nothing was checked"); signed-in **19 anchors** = the app's `#main-content` skip link on each of 12 screens + 7 `tel:` links on Customers & Debt. **0 placeholders, 0 dangling in-page fragments** (`#main-content` resolves), **0 outbound links reachable** from the default UI.
* **Images:** public 1 image; signed-in 25 (2 per screen, 3 on Settings) — **0 broken, 0 missing alt**.
* **Responsive:** 12 measurements — `documentElement.scrollWidth` and `body.scrollWidth` both equal the viewport (320 / 768 / 1440 px) on both surfaces and both engines; **no horizontal overflow anywhere**.
* **Smoke:** the app answers < 400 with a non-empty title and a visible, non-empty `<h1>`, and logs **no** console errors, uncaught page errors, or 4xx/5xx responses (public and signed-in).
* **Read-only guard:** **0 requests blocked → the app never even attempted a write** during the pass (each blocked request would add a `[guard] aborted …` line; no such line exists in this run's log).

---

## 4. Findings

Severity is the axe impact. Node-level evidence for every finding is in the JSON artifacts from §2; each one reproduced on **both** engines unless stated otherwise. Totals across the four artifacts: **34 violation instances (rule × surface × engine) / 264 element nodes** — 1 finding / 3 nodes on each public surface, 16 findings / 175 nodes (Chromium) and 16 / 83 (WebKit) signed in.

### F1 — `button-name` (critical) · Pumps · 14 nodes

The edit and delete icon buttons on each pump card have no discernible text (7 pumps × 2 buttons).

* Target: `.ring-2 > .items-start.gap-2.justify-between > .gap-1.shrink-0.items-center > .hover\:text-amber-600…` (and the `hover\:text-rose-600…` sibling)
* HTML: `<button class="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-600 …">` — SVG only, no text and no `aria-label`
* Rule: <https://dequeuniversity.com/rules/axe/4.13/button-name>
* Where to fix: `src/screens/PumpsScreen.tsx` (pump-card action buttons)
* Suggested fix: `aria-label={\`Edit ${pump.name}\`}` / `aria-label={\`Delete ${pump.name}\`}`, or an `<span className="sr-only">` — both keep the visual design unchanged.

### F2 — `label` (critical) · New Sale · 1 node

A form field has no label at all.

* Target `.pl-9` — `<input type="text" readonly="" disabled="" class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 …">`
* Rule: <https://dequeuniversity.com/rules/axe/4.13/label>
* Where to fix: `src/screens/NewOrderScreen.tsx` (the icon-prefixed search/scan field)
* Suggested fix: `aria-label="Search products"`. Note `readonly`/`disabled` does **not** exempt an input from the label rule.

### F3 — `select-name` (critical) · Products & pricing (both engines) · Customers & Debt (Chromium)

A `<select>` has no accessible name.

* Products & pricing: `<select class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 …">` (row-level select)
* Customers & Debt: `<select class="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 …">`
* Rule: <https://dequeuniversity.com/rules/axe/4.13/select-name>
* Where to fix: `src/screens/ProductsScreen.tsx`, `src/screens/CustomersScreen.tsx`
* Suggested fix: `aria-label` per row (e.g. `aria-label={\`Price tier for ${product.name}\`}`) or a `<label className="sr-only">` tied by `id`.

### F4 — `color-contrast` (serious) · every screen · 225 nodes

Persistent, design-token-level contrast shortfalls — the single biggest finding (158 nodes on Chromium, 61 on WebKit, plus 3 on the public login card on both engines).

Per-screen node counts (Chromium / WebKit): Dashboard 8/3, New Sale 25/8, Transaction ledger 11/6, Customers & Debt 30/9, Pumps 9/4, Truck Intake 9/5, Kegs Ledger 11/4, Products & pricing 7/5, Expenses & float 4/1, AI Advisor 13/7, Staff Management 19/6, Settings 12/3.

Representative offences (measured ratio vs the 4.5:1 minimum for normal text):

| Element | Foreground | Background | Ratio | Size |
| --- | --- | --- | --- | --- |
| `.text-stone-500` (Dashboard depot/location line) | `#78716c` | `#25231f` | **3.26** | 10 px |
| `.text-slate-400` ("Stock:" label, Dashboard) | `#94a3b8` | `#f1f5f9` | **2.34** | 11 px |
| `.text-brand-600` (active nav label, "Forgot password?") | `#059669` | `#ffffff` / `#feffff` | **3.76** | 11 px bold |
| `.text-xs` (login-card subtitle) | `#64748b` | `#faf6ed` | **4.41** | 12 px |
| `.sm\:text-sm` (Dashboard greeting) | `#64748b` | `#f3f5f7` | **4.35** | 12 px |

* Rule: <https://dequeuniversity.com/rules/axe/4.13/color-contrast>
* Most misses are marginal (4.35 / 4.41 vs 4.5) and a single token step fixes them — `slate-500 #64748b → slate-600 #475569` covers the 4.41 and 4.35 cases; `brand-600 #059669` needs a darker green for 11 px bold text on white.
* The two worst are genuine readability defects: `slate-400` on `slate-100` (2.34) and `stone-500` on `#25231f` (3.26) at 10–11 px are unreadable for low-vision users.
* Because the causes are tokens (`brand-600`, `slate-400/500`, `stone-500`) plus `text-[10px]` / `text-[11px]` sizes, a handful of edits removes most of the 225 nodes.

### F5 — `nested-interactive` (serious) · Customers & Debt · 6 nodes (WebKit)

Customer cards are focusable containers that also contain focusable controls.

* HTML: `<div role="button" tabindex="0" aria-pressed="true" aria-label="Walk-in Customer, re..." class="depot-card …">` → axe: *"Element has focusable descendants"*
* Rule: <https://dequeuniversity.com/rules/axe/4.13/nested-interactive>
* Where to fix: `src/screens/CustomersScreen.tsx` (mobile customer cards)
* Suggested fix: make the card a plain container and put the select action on a single inner `<button>` (or drop `role="button"`/`tabindex` and let the card's own control do the work). Keyboard users currently hit two nested tab stops per card, and the `tel:`/WhatsApp links inside are unreachable by the card's own activation semantics.

### F6 — `aria-hidden-focus` (serious) · 10–11 of 12 navigations · **observed, deliberately not asserted**

Not a test failure — reported because it is real app behaviour that the suite measures on purpose.

`src/components/layout/ScreenTransition.tsx` slides between screens for 1000 ms and, for that window, keeps a **frozen copy of the outgoing screen** in the DOM inside a wrapper marked `aria-hidden="true"` and translated off-canvas. Measured this run:

* Chromium: **11/12 navigations** kept such a copy, containing **up to 29 focusable elements**
* WebKit: **10/12 navigations**, up to **27 focusable elements**

While the copy exists, axe reports `aria-hidden-focus` on it (that is exactly the `<div aria-hidden="true" class="absolute inset-x-0 top-0 w-full" style="transform: translateX(-100%)…">` node) — a keyboard user tabbing immediately after a navigation can land on invisible, screen-reader-suppressed controls.

* Rule: <https://dequeuniversity.com/rules/axe/4.13/aria-hidden-focus>
* Suggested fix: add `inert` to the outgoing wrapper (or `pointer-events-none` + `tabIndex={-1}` on its focusables) so the frozen copy leaves the tab order for its ~1.06 s life.
* **Why it is not in the failure count:** the crawl now waits for this copy to be dropped before auditing (see §6), so per-screen results describe one screen at a time. Before that fix the harness reported 9 `aria-hidden-focus` violations per project and mis-attributed the outgoing screen's nodes (phantom anchors, phantom contrast nodes) to the incoming one.

---

## 5. What each spec asserts

| Spec | Assertions |
| --- | --- |
| `smoke` | HTTP status < 400 for the document; non-empty `document.title`; first `<h1>` visible and non-empty; zero console errors; zero uncaught page errors; zero 4xx/5xx responses. Run on the public surface and again after restoring `storageState` (the login card must be gone). |
| `links` | Public + every reachable screen: no placeholder `href` (`javascript:`, `about:blank`, `data:text/html`, a bare `#`); every in-page fragment resolves to an existing id; every outbound `http(s)` link answers < 400 (HEAD, retried with GET on 400/403/405/501, 15 s timeout). Non-fetchable schemes (`tel:`, `mailto:`, …) are counted and printed but not fetched; same-origin links are counted as "SPA, not re-fetched". Anchor counts and href *shapes* (digits masked) are logged per screen so a green run cannot hide "0 anchors checked". |
| `images` | Every `<img>`: `naturalWidth > 0` (loaded) and an `alt` attribute that is present and not the filename. Page is scrolled end-to-end first so lazy images resolve, then waits for all `complete` flags. |
| `a11y` | axe-core run in the browser via `@axe-core/playwright`, restricted to WCAG A/AA **critical + serious** violations, on the public surface and (crawling every reachable screen) the signed-in surface. Findings are written to per-rule JSON artifacts and the failure message carries the rule, impact, node count, selector, HTML and the measured ratio/reason for each node. |
| `responsive` | At 320 / 768 / 1440 px on both surfaces: `documentElement.scrollWidth` and `body.scrollWidth` must equal the viewport width (no horizontal overflow), with the measured numbers logged. |
| `auth.setup` | Signs in once against the deployed app with `QA_USERNAME`/`QA_PASSWORD`, verifies the login card disappeared, saves `storageState` for the audit projects; `trace: 'off'` so the password POST is never recorded. |

**Harness corrections made during this pass** (test-side, not app-side — recorded for transparency):

1. **Transition-aware crawl.** The app keeps a frozen copy of the outgoing screen for ~1.06 s (`ScreenTransition`, §4/F6). The crawl now measures that copy, waits for the *exact node* to be dropped, and only then audits. Before this, Pumps reported 8 anchors (7 belonging to the Customers screen), and per-screen contrast counts were inflated. After: 19 anchors (12 skip links + 7 `tel:`) and clean per-screen attribution.
2. **Test budget.** The WebKit signed-in crawl exceeded the original 90 s timeout mid-crawl on one attempt (reported as `Test timeout … exceeded` instead of the real a11y failure). Raised to 150 s so the crawl always reaches its assertion; both attempts now fail on the assertion itself.
3. **`[crawl] WARNING` guard.** If the app ever keeps the outgoing copy mounted indefinitely, the log says so explicitly rather than silently auditing two screens at once. This run printed **no warning**.
4. Coverage knobs raised as the crawl proved stable: `MAX_SCREENS` 6 → 14 (12 owner screens actually reached), mobile drawer now waits for its overlay before clicking (fixed a WebKit flake), and `#main-content` is treated as a real fragment target.

---

## 6. Coverage boundaries (what this pass did **not** prove)

* **One account, one role.** The audit used the owner/admin account from `.env`, which renders the desktop rail. The counter-staff "Switch Screen" menu (`button[aria-haspopup="menu"]`) and any role-gated screen was never exercised; a non-admin account can only see a subset.
* **Default states only — nothing was mutated.** Forms were never submitted, no record was created/edited/deleted, so error paths, validation states, empty states, confirm dialogs, receipts/statement modals and offline behaviour are untested. Read-only by design: the guard blocks every write.
* **WhatsApp/customer surfaces unreached.** The only outbound links in the source (`https://wa.me/…` in `CustomersScreen.tsx:393/560/1240` and `CustomerStatementModal.tsx:453`) live behind a customer drawer/sheet that the crawl does not open, so **0 outbound links were fetched** and the statement/receipt views were not audited (neither for a11y nor contrast). The 7 `tel:` links are checked for shape only.
* **Accessibility scope.** axe-core is a static analyser: it covers rules that can be computed from the DOM, not keyboard traps, focus order quality, screen-reader (NVDA/VoiceOver) output, motion/reduced-motion behaviour, zoom at 200–400 %, or the `prefers-contrast`/dark themes. Only light mode was rendered. Only critical/serious A/AA violations are asserted — moderate/minor findings are filtered out and therefore absent from the artifacts.
* **Two engines, three widths.** Chromium (desktop) and WebKit (iPhone 13, 390×664) plus explicit 320/768/1440 px viewports: no Firefox, no real Android, no tablet in landscape, no slow-network/high-latency simulation, no iOS Safari chrome (address bar) viewport dynamics.
* **No visual regression, performance or SEO checks.** No Lighthouse, no bundle/asset budget, no screenshot diffing (`screenshot: 'only-on-failure'`).
* **Deployed build only, unpinned.** The audited deployment was not pinned to a commit SHA, so a redeploy can silently change the baseline; the repo state at run time was `ca70a03` (`origin/main`). Results describe the URL, not a specific artefact.
* **Outbound reachability is unproven.** No external `http(s)` link is rendered in the default UI, so the outbound-checking code path (HEAD → GET retry, redirect following, 403/429 classification) was exercised **zero times** in this run: it is implemented and unit-testable, but this run produced no live evidence for it.

---

## 7. Read-only guarantee & security notes

**Nothing was written to production.** Every test installs `installReadOnlyGuard`, which intercepts all network traffic and aborts anything that is not a `GET`/`HEAD`, except three explicitly justified endpoints:

| Allowed | Why |
| --- | --- |
| `POST /auth/v1/token` | the sign-in the setup project performs |
| `POST /auth/v1/logout` | signs the throwaway session out; changes no data |
| `POST /rest/v1/rpc/public_company_branding` | a `SECURITY DEFINER` **SELECT** the shell calls on boot (`AuthShell.tsx:36`) |

Everything else state-changing is aborted with `blockedbyclient` and logged as `[guard] aborted <METHOD> <path>`. **This run logged zero `[guard]` lines**, i.e. the app never even attempted a write during the pass. `QA_READ_ONLY=0` lifts the guard for a run where writes are welcome.

**Token hygiene (verified, not assumed).**

* `BASE_URL` lives only in the gitignored `.env`; the config throws if it is missing rather than falling back to a hard-coded URL.
* All printed URLs pass through `redact()` (same-origin URLs are reduced to `<origin><path>`) and `scrub()` (strips `_vercel_share=…` and JWT-shaped strings anywhere in the text, including console errors echoing a URL back).
* Sweep of this run's artifacts: **0 occurrences** of `_vercel_share` or a JWT in `test-results/qa-results.json`, `test-results/qa-run.log`, `test-results/qa-a11y-*.json`, `test-results/.last-run.json` and the generated `playwright-report/` — only the bare origin appears.
* `playwright/.auth/user.json` holds live Supabase tokens for the account in `.env`; it is gitignored (`.gitignore:51`). For a shared repo, use a dedicated QA account and rotate its password if the file is ever exposed.

**Informational: the share token is not an access control.** An unauthenticated `HEAD https://iyanuoluwa-vegetable-oil.vercel.app/` returns **200** — Vercel's deployment-protection wall answers 401 when it is enforced, so protection is *not* active on this deployment and the app is reachable without `_vercel_share`. The QA pass could therefore have run against the bare origin; the token only adds a second, weaker path to the same public URL. Actual data access is gated by the app's Supabase session instead, which this pass does not test: **no authorization/RLS or cross-tenant probing was performed** (out of scope for a read-only UI pass). If the deployment is meant to be private, enforce Vercel protection (or an IP/SSO rule) rather than relying on the query-string share token.

**Repository hygiene.** Only QA infrastructure is new or changed — `.gitignore` (+9 lines), `.env.example` (+24), `package.json` (+4: the `qa` script and `@playwright/test`, `@axe-core/playwright`, `dotenv`), `package-lock.json`, plus the new `playwright.config.ts`, `tests/`, `QA_REPORT.md`. `git diff` for `src/`, `api/` and `supabase/` is **empty**, and **nothing was committed** (`HEAD` is still `ca70a03` = `origin/main`). All QA output paths are gitignored: `/playwright-report/`, `/test-results/`, `/playwright/.cache/`, `/playwright/.auth/`, `.env`.

---

## 8. Priorities

| Priority | Item | Effort | Status after remediation |
| --- | --- | --- | --- |
| **P0** | F1 `button-name` (Pumps, 14 buttons), F2 `label` (New Sale input), F3 `select-name` (2 selects) — three small `aria-label` changes remove every **critical** violation | ~30 min | **Fixed** (`8a18fc0`, `e45dc74`, `6bbdcff`) — re-audited clean locally (Chromium), see §9 |
| **P0** | F4 `color-contrast` — adjust the `brand-600`, `slate-400/500` and `stone-500` tokens (and the 10–11 px type sizes that make them fail) to clear 4.5:1; this clears ~225 of the 264 nodes | 1–3 h including re-check | **Fixed** (`ad4aeaa`, `856ee37`) — token-level, dark mode unchanged; re-audited clean, see §9 |
| **P1** | F5 `nested-interactive` on the mobile customer cards — restructure to one focusable control per card | ~1 h | **Fixed** (`f392cb6`) — full-card overlay `<button>`; re-audited clean, see §9 |
| **P1** | F6 `ScreenTransition` — mark the frozen outgoing copy `inert` so its up-to-29 focusables leave the tab order for that ~1.06 s | ~15 min | **Fixed** (`2ce8d63`); measured `inert` + `pointer-events:none` during the slide, see §9 |
| **P2** | Extend the suite: open the customer drawer/statement (covers the `wa.me` outbound links), add a keyboard tab-order smoke test, audit dark mode, add a non-owner role to the crawl, and pin the deployment to a commit SHA so results are attributable | — | Open — §9 notes one concrete gap this pass hit: the crawl's `h1` gate and the absence of master data in a fresh local profile |
| **P2** | Run `npm run qa` in CI against preview deployments with a QA account; keep `test-results/qa-results.json` + `qa-a11y-*.json` as the machine-readable gate and fail the build on any new critical/serious rule | — | Open — the suite is unchanged and still the gate; it must be re-run against the fixed deployment |

---

---

## 9. Remediation & post-fix verification

All six findings were fixed on branch **`fix/a11y-p0-p1`** — six commits, one per finding, each green on the repo's pre-commit gate (`tsc --noEmit` + the full `npm test` suite). Nothing was pushed; `main` is untouched.

| Finding | Change | Commit |
| --- | --- | --- |
| F1 `button-name` | Every pump-card icon button now names its pump: `aria-label` = `Reset meter for <label>` / `Edit <label>` / `Delete <label>` (+ `title` tooltips) — `PumpsScreen.tsx` | `8a18fc0` |
| F2 `label` | `htmlFor="cashier-on-duty"` on the "Cashier / Staff on Duty *" label + the matching `id` on the disabled input — `NewOrderScreen.tsx` | `e45dc74` |
| F3 `select-name` | `aria-label` on the products pack-size select ("Choose a pack size to add") and the inventory one ("Add a pack size"), plus the customer payment-method select and the inline amount input — `InventoryScreen.tsx`, `CustomersScreen.tsx` | `6bbdcff` |
| F4 `color-contrast` | Theme-aware tokens (table below) + a sweep of every surface that stays dark in light mode | `ad4aeaa`, `856ee37` |
| F5 `nested-interactive` | The customer card is no longer `role="button"`: plain container + full-card overlay `<button>` (stretched-link pattern); the `tel:` / WhatsApp links sit above it (`z-10`), so they stay clickable — `CustomersScreen.tsx` | `f392cb6` |
| F6 `aria-hidden-focus` | The frozen outgoing copy now gets `inert` (via a ref — React 18 has no prop for it) and `pointer-events-none` for its ~1.06 s life — `ScreenTransition.tsx` | `2ce8d63` |

### F4 on the token layer

`tailwind.config.js` now resolves `slate-400/500`, `brand-600/700` and `emerald/amber/sky/cyan-600` through CSS variables whose values live in `src/index.css`:

| Token | Light (new) | Dark (unchanged) |
| --- | --- | --- |
| `slate-400` | `#5B6673` | `#94A3B8` |
| `slate-500` | `#4F5A69` | `#64748B` |
| `brand-600` / `brand-700` | `#047857` / `#036E4D` | `#059669` / `#047857` |
| `emerald-600` | `#047857` | `#059669` |
| `amber-600` | `#B45309` | `#D97706` |
| `sky-600` | `#0369A1` | `#0284C7` |
| `cyan-600` | `#0E7490` | `#0891B2` |

`.dark` re-declares the original hexes, so every dark surface renders exactly as before **by construction** — only the light theme moves. Confirmed in the built CSS: `.text-slate-400{color:rgb(var(--slate-400) / var(--tw-text-opacity, 1))}` with `:root`/`.dark` both present.

Surfaces that are dark *even in light mode* keep their muted text legible with `text-slate-300 dark:text-slate-400`: `ReceiptModal`, `CustomerStatementModal`, `PumpOdometerIllustration`, `AIAdvisorScreen`, the `TopHeader` identity pill, the New Sale cart-total pill, and the ledger's `.kpi-mirror-card` — a class-level `background:#000000` that no `bg-*` grep would ever have found (it was still 3.59:1 after the token change, and axe reported it as `background #000000`). The payment-mode sub-lines inside those black cards use a new `onDarkTextCls` / `onDarkBgCls` pair on `PAYMENT_MODE_THEME`, because there the *light-side* accents were the failing half (`sky-600` 3.54:1, `purple-600` 3.90:1 on black).

### Verification against the fixed code (local)

`BASE_URL=http://localhost:3000 npx playwright test tests/a11y.spec.ts --project "Desktop Chrome"` against `vite dev`, with the suite unmodified:

* public surface **0** violations; Dashboard, New Sale, Transaction ledger, Customers & Debt, Pumps, Truck Intake **0 each** → **3 passed** (per-screen artifact `test-results/qa-a11y-signed-in-desktop-chrome.json` → `[]`)
* the same crawl widened to **all 12** owner screens (the `h1` gate relaxed) → **0** violations
* a second probe injected local-only master data (2 pumps, 1 `bulk_truck` product, no open shift; master-data reads aborted, nothing written anywhere) so the data-dependent widgets actually rendered, and every fix was observed on the page:
  * F1 → **6** named pump buttons (`Reset meter for Pump 1` … `Delete Pump 2`) → **0** `button-name`
  * F2 → the opening-meter modal rendered `label[for=cashier-on-duty]` ⇄ `#cashier-on-duty` = `"Cashier / Staff on Duty *"` → **0** `label`
  * F3 → `selectNames: ["Add a pack size"]` on Products & pricing; the Customers payment select named → **0** `select-name`
  * F4 → 4 `.kpi-mirror-card`s with exactly the 7 previously-failing nodes, aging badges, `text-slate-300` panels, product tiles → **0** `color-contrast`
  * F5 → a customer card with its `tel:` link rendered → **0** `nested-interactive`
  * F6 → the outgoing copy measured **present, `inert`, `pointer-events:none`** with up to 22 focusables inside → **0** `aria-hidden-focus`
* `npm test` → all suites pass (100 %); `npm run build` → clean.

### Boundary of that verification

A fresh local profile has **no master data** — `DEFAULT_PUMPS`, `SEED_TANKS`, `SEED_PRODUCTS` are empty by design, so a real depot's screens render their empty states. That is why the official crawl stops at *Products & pricing* locally: its empty state has no `<h1>` and the crawl gates on one (only the injected-data probe got past it). The deployed re-run is therefore still the acceptance gate — it is the only run that sees the production dataset, both engines, and the WebKit-only nodes (F5's 6 nodes were WebKit-only). Treat §9 as fix-level evidence, not a replacement verdict.

---

*Sections 1–7 — and every number they cite — describe the **baseline** run against the deployed build (`HEAD` `ca70a03`), whose artifacts that run produced. Section 9 describes the fix branch; its numbers come from the commands quoted in it.*





