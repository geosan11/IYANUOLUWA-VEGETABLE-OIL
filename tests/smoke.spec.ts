/**
 * Smoke pass: the app paints, the document is sane, and the page is quiet
 * (no console errors, no uncaught exceptions, no 4xx/5xx responses).
 */
import { test, expect } from '@playwright/test';
import { AUTH_STATE, HAS_CREDS, SAFE_ORIGIN, attachDiagnostics, installReadOnlyGuard, openApp } from './support/qa';
import { expectCleanLoad } from './support/checks';

test.describe('smoke - public surface (signed out)', () => {
  test('loads clean: HTTP < 400, a title, a heading, and no console/page/network errors', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    const response = await openApp(page);

    await expectCleanLoad(page, diagnostics, response, `public @ ${SAFE_ORIGIN}`);
  });
});

test.describe('smoke - signed-in surface', () => {
  test.use({ storageState: AUTH_STATE });
  test.skip(!HAS_CREDS, 'Set QA_USERNAME and QA_PASSWORD in .env to enable the signed-in pass.');

  test('loads clean after restore-from-storageState, with the login card gone', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    const response = await openApp(page);

    // Proof the stored session was actually used (T4 = an empty login card).
    await expect(page.locator('#login-identifier'), 'the stored session did not sign in').toHaveCount(0);

    await expectCleanLoad(page, diagnostics, response, `signed-in @ ${SAFE_ORIGIN}`);
  });
});
