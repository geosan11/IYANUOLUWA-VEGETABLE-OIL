/**
 * Signed-in half of the suite: sign in ONCE here and let every audit project
 * reuse the resulting storageState (playwright/.auth/user.json — gitignored,
 * it holds live tokens).
 *
 * Read-only twice over: this project runs with trace:'off' (a trace would record
 * the password in the request body) and the write guard is installed before the
 * first request, so a fresh browser profile cannot push seed data at the
 * production database.
 */
import { test as setup, expect } from '@playwright/test';
import {
  AUTH_STATE,
  BASE_URL,
  SAFE_ORIGIN,
  attachDiagnostics,
  formatDiagnostics,
  installReadOnlyGuard,
  HAS_CREDS,
} from './support/qa';

setup('sign in once and save the session', async ({ page }) => {
  setup.skip(!HAS_CREDS, 'Set QA_USERNAME and QA_PASSWORD in .env to enable the signed-in pass.');

  const diagnostics = attachDiagnostics(page);
  installReadOnlyGuard(page, diagnostics);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  const identifier = page.locator('#login-identifier');
  await identifier.waitFor({ state: 'visible', timeout: 20_000 });
  await identifier.fill(process.env.QA_USERNAME ?? '');
  await page.locator('#login-password').fill(process.env.QA_PASSWORD ?? '');
  await page.locator('form button[type="submit"]').click();

  // The signed-in shell paints <header> (TopHeader.tsx:69) once AuthGate has a
  // session AND the profile row resolved. The "Account not set up yet" branch
  // renders neither, so this tells a real sign-in apart from a half-provisioned
  // account — and on failure we surface whatever the screen said.
  try {
    await expect(page.locator('header'), `no signed-in shell on ${SAFE_ORIGIN}`).toBeVisible({
      timeout: 25_000,
    });
  } catch (error) {
    const visibleMessages = await page
      .locator('[role="alert"], [role="status"], .text-rose-600, .text-rose-500')
      .allInnerTexts()
      .catch(() => []);
    throw new Error(
      `Sign-in did not reach the app shell on ${SAFE_ORIGIN}.\n` +
        `Screen messages: ${visibleMessages.map(text => text.replace(/\s+/g, ' ').trim()).join(' | ') || '(none)'}\n` +
        `${formatDiagnostics(diagnostics)}\n${(error as Error).message}`
    );
  }

  await expect(page.locator('#login-identifier'), 'still on the login card').toHaveCount(0);

  await page.context().storageState({ path: AUTH_STATE });
});
