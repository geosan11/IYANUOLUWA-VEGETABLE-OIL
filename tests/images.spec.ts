/**
 * Image audit: nothing that failed to load (naturalWidth === 0) and nothing
 * without an alt attribute.
 */
import { test, expect } from '@playwright/test';
import { AUTH_STATE, HAS_CREDS, attachDiagnostics, forEachReachableScreen, installReadOnlyGuard, openApp } from './support/qa';
import { collectImages, type ImageFinding } from './support/checks';

const describeBroken = (image: ImageFinding) =>
  `${image.src} (naturalWidth 0, rendered: ${image.rendered})`;
const describeMissingAlt = (image: ImageFinding) => image.src;

test.describe('images - public surface (signed out)', () => {
  test('every image loads and declares an alt', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    await openApp(page);
    const images = await collectImages(page);
    const broken = images.filter(image => image.naturalWidth === 0);
    const missingAlt = images.filter(image => image.alt === null);

    console.log(`[images] public surface: ${images.length} image(s), ${broken.length} broken, ${missingAlt.length} without alt`);

    expect(broken.map(describeBroken), 'Images that failed to load:\n' + broken.map(describeBroken).join('\n')).toEqual([]);
    expect(
      missingAlt.map(describeMissingAlt),
      'Images with no alt attribute:\n' + missingAlt.map(describeMissingAlt).join('\n')
    ).toEqual([]);
  });
});

test.describe('images - signed-in surface', () => {
  test.use({ storageState: AUTH_STATE });
  test.skip(!HAS_CREDS, 'Set QA_USERNAME and QA_PASSWORD in .env to enable the signed-in pass.');

  test('every image on every reachable screen loads and declares an alt', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    await openApp(page);
    await expect(page.locator('#login-identifier')).toHaveCount(0);

    const all: ImageFinding[] = [];
    const visited = await forEachReachableScreen(page, async screen => {
      const images = await collectImages(page);
      all.push(...images);
      console.log(`[images] ${screen.label}: ${images.length} image(s)`);
    });

    const broken = all.filter(image => image.naturalWidth === 0);
    const missingAlt = all.filter(image => image.alt === null);

    console.log(`[images] signed-in crawl visited: ${visited.map(screen => screen.label).join(', ') || '(none)'}`);
    console.log(`[images] signed-in totals: ${all.length} image(s), ${broken.length} broken, ${missingAlt.length} without alt`);

    expect(broken.map(describeBroken), 'Images that failed to load:\n' + broken.map(describeBroken).join('\n')).toEqual([]);
    expect(
      missingAlt.map(describeMissingAlt),
      'Images with no alt attribute:\n' + missingAlt.map(describeMissingAlt).join('\n')
    ).toEqual([]);
  });
});
