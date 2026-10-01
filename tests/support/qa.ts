/**
 * Shared plumbing for the read-only QA pass over the deployed app.
 *
 * Two rules this file exists to enforce:
 *   1. The Vercel share token inside BASE_URL never reaches a log, a report or
 *      a trace — every URL/text the suite prints goes through `redact`/`scrub`.
 *   2. Nothing this suite does can write to the production Supabase project
 *      (`installReadOnlyGuard`).
 */
import type { Locator, Page, Response } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

/** Full deployed URL, share token included — read from the gitignored .env. */
export const BASE_URL = process.env.BASE_URL ?? '';

if (!BASE_URL) {
  throw new Error('BASE_URL is not set. Add it to the gitignored .env (see .env.example).');
}

/** Every printed URL is reduced to this origin, so the token cannot leak. */
export const SAFE_ORIGIN = new URL(BASE_URL).origin;

/** storageState written by auth.setup.ts. Gitignored — it holds live tokens. */
export const AUTH_STATE = 'playwright/.auth/user.json';

/** Set QA_USERNAME/QA_PASSWORD in .env to switch the signed-in groups on. */
export const HAS_CREDS = Boolean(process.env.QA_USERNAME && process.env.QA_PASSWORD);

/** QA_READ_ONLY=0 lifts the write guard. Only for a run where writes are welcome. */
export const READ_ONLY = process.env.QA_READ_ONLY !== '0';

/** How many screens the signed-in crawl visits per spec (QA_MAX_SCREENS).
 *  Default 14 covers the full sidebar for an owner account (12 destinations)
 *  plus headroom; lower it for a quick partial pass. */
export const MAX_SCREENS = Number(process.env.QA_MAX_SCREENS ?? 14);

/**
 * Belt-and-braces redaction. `redact` strips our own query string (that is where
 * the share token lives); `scrub` removes the token wherever it appears — e.g. a
 * console error message that Echoed a full URL back at us.
 */
export function scrub(text: string): string {
  return text
    .replace(/_vercel_share=[^&\s"')\]]+/gi, '_vercel_share=<redacted>')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '<jwt>');
}

export function redact(url: string): string {
  let shown = url;
  try {
    const parsed = new URL(url);
    if (parsed.origin === SAFE_ORIGIN) shown = `${SAFE_ORIGIN}${parsed.pathname}`;
  } catch {
    /* not a parseable URL — print it as-is */
  }
  shown = scrub(shown);
  return shown.length > 200 ? `${shown.slice(0, 197)}...` : shown;
}

/** Everything the page reported that a screen-level check might care about. */
export interface Diagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  /** Non-GET calls the read-only guard refused to send. Never app failures. */
  blockedWrites: string[];
}

export function attachDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    blockedWrites: [],
  };

  page.on('console', message => {
    if (message.type() !== 'error') return;
    diagnostics.consoleErrors.push(`${scrub(message.text())} (${redact(message.location().url)})`);
  });

  page.on('pageerror', error => {
    const frame = error.stack?.split('\n')[1]?.trim();
    diagnostics.pageErrors.push(`${scrub(error.message)}${frame ? ` @ ${frame}` : ''}`);
  });

  page.on('response', response => {
    if (response.status() < 400) return;
    const request = response.request();
    if (request.url().startsWith('data:')) return;
    diagnostics.failedRequests.push(
      `${response.status()} ${request.method()} ${redact(request.url())}`
    );
  });

  return diagnostics;
}

/**
 * Requests the guard waves through even though they are not GET/HEAD:
 *   - /auth/v1/token  — the password grant this suite needs, plus the
 *                       refresh_token grant Supabase fires when the stored
 *                       session is restored. Session-only, touches no table.
 *   - /auth/v1/logout — signing the throwaway session out changes no data.
 *   - rpc/public_company_branding — a SECURITY DEFINER SELECT (AuthShell.tsx:36).
 * Everything else that is not GET/HEAD is aborted and recorded, so this pass
 * cannot write to production even if the app's own sync logic would.
 */
const WRITE_ALLOWLIST = [
  /\/auth\/v1\/token(\?|$)/,
  /\/auth\/v1\/logout(\?|$)/,
  /\/rest\/v1\/rpc\/public_company_branding(\?|$)/,
];

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function installReadOnlyGuard(page: Page, diagnostics: Diagnostics): void {
  if (!READ_ONLY) return;

  void page.route(/\/rest\/v1\/|\/auth\/v1\//, async route => {
    const request = route.request();
    if (!STATE_CHANGING.has(request.method())) return route.continue();
    if (WRITE_ALLOWLIST.some(pattern => pattern.test(request.url()))) return route.continue();

    diagnostics.blockedWrites.push(`${request.method()} ${redact(request.url())}`);
    // Logged as it happens: an empty "[guard]" count in the run log is the
    // evidence that this pass never even attempted a write.
    console.log(`[guard] aborted ${request.method()} ${redact(request.url())}`);
    await route.abort('blockedbyclient');
  });
}

/**
 * First navigation of every test: always the absolute BASE_URL (never a
 * relative path) so the share token rides along on the document request. Waits
 * past AuthGate's full-screen spinner — the gate renders nothing else until the
 * Supabase session check settles, after which either the login card or the
 * signed-in shell paints an <h1>.
 */
export async function openApp(
  page: Page,
  options: { settleMs?: number } = {}
): Promise<Response | null> {
  const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 });
  // Let the first data fetch settle so checks do not race dashboard skeletons.
  // Deliberately NOT waitUntil:'networkidle' — Google Fonts and the Supabase
  // client keep the connection warm, so 'networkidle' would stall.
  await page.waitForTimeout(options.settleMs ?? 1_000);
  return response;
}
/** A screen the signed-in account can reach, plus how to get there. */
export interface ScreenTarget {
  label: string;
  activate: () => Promise<void>;
}

/**
 * Enumerates the screens a signed-in account can actually reach, using the same
 * mechanisms a user would. This app has three shapes:
 *   1. Desktop rail — `<aside><nav><button title="…">`. App.tsx:119 renders the
 *      Sidebar for owner/admin only, and the label span inside the button is
 *      hover-only, which is why the title attribute is the reliable handle.
 *   2. Header "Switch Screen" menu — `button[aria-haspopup="menu"]` plus
 *      role="menuitem" buttons (TopHeader.tsx:92-155), rendered when the account
 *      has no sidebar (`showScreenSwitcher`).
 *   3. Mobile hamburger drawer — `aria-label="Open menu"`, then the overlay's
 *      buttons, whose text is the nav label.
 * Returns [] when none is reachable; the caller reports that as a coverage
 * boundary rather than a failure.
 */
export async function enumerateScreens(page: Page): Promise<ScreenTarget[]> {
  const targets: ScreenTarget[] = [];

  // 1. Desktop rail.
  const railTitles = await page.locator('aside nav button[title]').evaluateAll(buttons =>
    buttons
      .filter(button => (button as HTMLElement).offsetParent !== null)
      .map(button => button.getAttribute('title') ?? '')
      // The Depot Alerts summary lives inside <nav> too (Sidebar.tsx:205) and is
      // not a screen.
      .filter(title => title.length > 0 && !/Depot Alerts$/.test(title))
  );
  for (const title of railTitles) {
    targets.push({
      label: title,
      activate: async () => {
        await page.locator(`aside nav button[title=${JSON.stringify(title)}]`).first().click();
      },
    });
  }
  if (targets.length > 0) return unique(targets);

  // 2. Counter-staff header switcher.
  const switcher = page.locator('button[aria-haspopup="menu"]').first();
  if (await isVisible(switcher)) {
    const menuItems = page.locator('[role="menuitem"]');
    for (const raw of await menuItems.allInnerTexts()) {
      const label = raw
        .replace(/\s+/g, ' ')
        .replace(/\s+ACTIVE$/i, '')
        .trim();
      if (!label) continue;
      targets.push({
        label,
        activate: async () => {
          if ((await switcher.getAttribute('aria-expanded')) !== 'true') await switcher.click();
          await clickButtonByText(label, menuItems);
        },
      });
    }
    if (targets.length > 0) return unique(targets);
  }

  // 3. Mobile hamburger drawer.
  const hamburger = page.locator('button[aria-label="Open menu"]').first();
  if (await isVisible(hamburger)) {
    await hamburger.click();
    const overlay = page.locator('div.fixed', { hasText: 'Menu & Modules' }).last();
    await overlay.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
    const labels = (await overlay.locator('button').allInnerTexts())
      .map(text => text.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    for (const label of labels) {
      targets.push({
        label,
        activate: async () => {
          // The drawer unmounts on selection, so reopen it and let the slide-in
          // settle before clicking — otherwise the click can land on a button
          // that is still animating (this was the flake on iPhone 13/WebKit).
          if (!(await isVisible(overlay))) {
            await hamburger.click();
            await overlay.waitFor({ state: 'visible', timeout: 5_000 });
            await page.waitForTimeout(300);
          }
          await clickButtonByText(label, overlay.locator('button'));
          await overlay.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
        },
      });
    }
  }

  return unique(targets);
}

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

/** Clicks the first visible button in `scope` whose text is (or starts with) `label`. */
async function clickButtonByText(label: string, scope: Locator): Promise<void> {
  const count = await scope.count();
  for (let index = 0; index < count; index += 1) {
    const button = scope.nth(index);
    if (!(await isVisible(button))) continue;
    const text = (await button.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (text === label || text.startsWith(`${label} `)) {
      await button.click();
      return;
    }
  }
  throw new Error(`No nav button labelled "${label}" was clickable.`);
}

function unique(targets: ScreenTarget[]): ScreenTarget[] {
  const seen = new Set<string>();
  return targets.filter(target => {
    if (seen.has(target.label)) return false;
    seen.add(target.label);
    return true;
  });
}

/** `iPhone 13` -> `iphone-13`, for artifact file names. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Machine-readable evidence for the report. Written under test-results/
 * (gitignored) on every run, so it always describes the run being reported.
 */
export function writeJsonArtifact(fileName: string, data: unknown): string {
  mkdirSync('test-results', { recursive: true });
  const path = `test-results/${fileName}`;
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  return path;
}

/** Token-free, one-entry-per-line failure message. */
export function formatList(title: string, entries: string[]): string {
  if (entries.length === 0) return `${title}: none`;
  return `${title} (${entries.length}):\n${entries.map(entry => `  - ${entry}`).join('\n')}`;
}

/** The tail every diagnostics assertion prints, guard artifacts included. */
export function formatDiagnostics(diagnostics: Diagnostics): string {
  return [
    formatList('console errors', diagnostics.consoleErrors),
    formatList('uncaught page errors', diagnostics.pageErrors),
    formatList('responses >= 400', diagnostics.failedRequests),
    formatList(
      'non-GET Supabase requests blocked by the read-only guard (never app failures)',
      diagnostics.blockedWrites
    ),
  ].join('\n');
}

/**
 * Console noise an aborted fetch produces. Kept separate from the real errors
 * so the signed-in pass can still judge the app on its own merits while every
 * blocked request stays visible in the report.
 */
const GUARD_ARTIFACT_HINTS = [
  'Failed to fetch',
  'Load failed',
  'NetworkError',
  'ERR_BLOCKED_BY_CLIENT',
  'Network request failed',
];

export function consoleErrorsExcludingGuardArtifacts(diagnostics: Diagnostics): string[] {
  if (diagnostics.blockedWrites.length === 0) return diagnostics.consoleErrors;
  const blockedPaths = diagnostics.blockedWrites
    .map(entry => entry.split(' ')[1])
    .filter((path): path is string => Boolean(path));
  return diagnostics.consoleErrors.filter(line => {
    if (blockedPaths.some(path => line.includes(path))) return false;
    return !GUARD_ARTIFACT_HINTS.some(hint => line.includes(hint));
  });
}

/**
 * `ScreenTransition` (src/components/layout/ScreenTransition.tsx) slides between
 * screens for 1000ms and keeps a frozen, off-canvas copy of the OUTGOING screen
 * in the DOM until ~1060ms has passed, marked `aria-hidden="true"`. Auditing
 * inside that window silently attributes the previous screen's DOM to the new
 * one — phantom anchors, phantom colour-contrast nodes — so every crawl waits
 * for the copy to be dropped, and records what it saw for the report.
 */
const OUTGOING_SCREEN_COPY = 'main div[aria-hidden="true"].absolute';

/** The focusables the app's own drawers/modals already trap inside themselves. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Appearance is one effect pass after the tab changes; clearing is the transition's own timer. */
const COPY_APPEAR_TIMEOUT = 750;
const COPY_CLEAR_TIMEOUT = 3_000;

interface TransitionObservation {
  /** The screen being left, i.e. the one frozen into the copy. */
  label: string;
  focusables: number;
}

/**
 * Walks the screens a signed-in account can reach (`enumerateScreens`, capped by
 * QA_MAX_SCREENS) and hands each one to `visit` once it has painted. The list of
 * screens actually audited is returned so specs can print it — a crawl that
 * quietly visited one screen must never look like a thorough pass.
 */
export async function forEachReachableScreen(
  page: Page,
  visit: (screen: ScreenTarget) => Promise<void>
): Promise<ScreenTarget[]> {
  const screens = (await enumerateScreens(page)).slice(0, MAX_SCREENS);
  const copies: TransitionObservation[] = [];
  const stuck: string[] = [];

  for (const screen of screens) {
    await screen.activate();

    // Measured while the slide is still running, so the report describes this
    // window instead of the suite mistaking it for a per-screen violation.
    const copy = page.locator(OUTGOING_SCREEN_COPY).first();
    const handle = await copy.elementHandle({ timeout: COPY_APPEAR_TIMEOUT }).catch(() => null);
    if (handle) {
      copies.push({
        label: screen.label,
        focusables: await copy.locator(FOCUSABLE_SELECTOR).count().catch(() => 0),
      });
    }

    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 });
    if (handle) {
      // Bound to the exact node: if the app froze a *new* copy in its place, that
      // is a different problem and must not be read as "this one cleared".
      const cleared = await page
        .waitForFunction(node => !(node as Node).isConnected, handle, { timeout: COPY_CLEAR_TIMEOUT })
        .then(() => true)
        .catch(() => false);
      if (!cleared) stuck.push(screen.label);
      await handle.dispose().catch(() => undefined);
    } else {
      // No copy means no slide to wait out (reduced motion, or the first screen).
      await page.waitForTimeout(500);
    }
    await visit(screen);
  }

  if (copies.length > 0) {
    const worst = copies.reduce((max, observation) => Math.max(max, observation.focusables), 0);
    console.log(
      `[crawl] ${copies.length}/${screens.length} navigations left an aria-hidden, off-canvas copy of the ` +
        `outgoing screen in the DOM for ~1.1s (up to ${worst} focusable element(s) inside it) - ` +
        "ScreenTransition's slide window. Audits run after it clears, so a screen is never reported with the " +
        'previous screen still in its DOM.'
    );
  }
  if (stuck.length > 0) {
    console.log(
      `[crawl] WARNING: the outgoing copy never cleared for: ${stuck.join(', ')} - those results may include ` +
        'the previous screen. Check ScreenTransition.tsx before trusting them.'
    );
  }

  return screens;
}



