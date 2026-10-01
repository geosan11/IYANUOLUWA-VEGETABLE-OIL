/**
 * Responsive audit: 320 / 768 / 1440 px must not scroll horizontally.
 *
 * Both projects run all three widths: the override is what is under test, so
 * "Desktop Chrome at 320px" and "iPhone 13 at 1440px" are both legitimate
 * questions. body.scrollWidth is logged but not asserted — index.html puts
 * `overflow-hidden` on <body>, which can hide real overflow from
 * documentElement.scrollWidth.
 */
import { test, expect } from '@playwright/test';
import { AUTH_STATE, HAS_CREDS, attachDiagnostics, installReadOnlyGuard, openApp } from './support/qa';
import { formatOverflow, measureOverflow } from './support/checks';

const WIDTHS = [320, 768, 1440];

test.describe('responsive - public surface (signed out)', () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      const diagnostics = attachDiagnostics(page);
      installReadOnlyGuard(page, diagnostics);

      await page.setViewportSize({ width, height: 900 });
      await openApp(page);

      const measurement = await measureOverflow(page);
      console.log(`[responsive] public @ ${width}px: ${formatOverflow(measurement)}`);

      expect(measurement.viewport, `the ${width}px viewport override was not applied`).toBeLessThanOrEqual(width + 1);
      await expect(page.locator('h1').first(), `no <h1> at ${width}px`).toBeVisible();
      expect(
        measurement.documentScrollWidth,
        `Horizontal overflow at ${width}px - ${formatOverflow(measurement)}`
      ).toBeLessThanOrEqual(measurement.viewport + 1);
    });
  }
});

test.describe('responsive - signed-in surface', () => {
  test.use({ storageState: AUTH_STATE });
  test.skip(!HAS_CREDS, 'Set QA_USERNAME and QA_PASSWORD in .env to enable the signed-in pass.');

  // Landing screen only: the overflow question belongs to the app shell, and
  // links/images/a11y already crawl every screen at the project's own width.
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      const diagnostics = attachDiagnostics(page);
      installReadOnlyGuard(page, diagnostics);

      await page.setViewportSize({ width, height: 900 });
      await openApp(page);
      await expect(page.locator('#login-identifier')).toHaveCount(0);

      const measurement = await measureOverflow(page);
      console.log(`[responsive] signed-in @ ${width}px: ${formatOverflow(measurement)}`);

      expect(measurement.viewport, `the ${width}px viewport override was not applied`).toBeLessThanOrEqual(width + 1);
      await expect(page.locator('h1').first(), `no <h1> at ${width}px`).toBeVisible();
      expect(
        measurement.documentScrollWidth,
        `Horizontal overflow at ${width}px - ${formatOverflow(measurement)}`
      ).toBeLessThanOrEqual(measurement.viewport + 1);
    });
  }
});
