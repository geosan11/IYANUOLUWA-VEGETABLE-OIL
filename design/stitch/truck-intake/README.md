# Truck intake redesign — UI references

Static HTML references for the two changes made in this pass. **Not shipped code** —
they exist so the layouts, colour usage and copy can be reviewed without running
the app. Open any file in a browser; each one is self-contained except `03` and
`04`, which share `mockup.css`.

| File | Mirrors |
| --- | --- |
| `01-sign-in-and-forgot.html` | `src/screens/LoginScreen.tsx` + `src/components/common/AuthShell.tsx` — sign in (no "Create account" tab), forgot-password form, bare-username rejection |
| `02-set-new-password.html` | `src/screens/ResetPasswordScreen.tsx` — shown while the client is in password-recovery mode, plus the mismatch error |
| `03-truck-intake-mobile.html` | `src/screens/TruckIntakeScreen.tsx` view 1 — numbered plain-language steps, single green CTA, "check the figures" block |
| `04-tanks-history-desktop.html` | `src/screens/TruckIntakeScreen.tsx` view 2 — four KPIs (all real store data), storage tanks, delivery log |

Colour/typography values were copied from `src/index.css` and `tailwind.config.js`
(canvas `#FAF6ED`, card `#FFFFFF` on `#E6DECF`, brand-500 `#00B749`, muted
`#F3ECE0`, ink `#0B0F19` / `#645F56`) so the references match the shipped app
rather than an external design tool's own palette.

The Stitch project **"Iyanuoluwa Depot — Truck Intake Redesign"**
(`9884855995074148712`) also holds a generated sign-in screen
(`7eaed7a0a06b49e3ac7485290431cc50`), but Stitch's `get_screen` endpoint
currently fails on fetch/export for screens in this project, so its output was
replaced with the hand-written references above: they use the app's real tokens
and copy instead of generic placeholder branding.
