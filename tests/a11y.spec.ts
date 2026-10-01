/**
 * Accessibility audit — axe-core, WCAG 2 A/AA, critical + serious only.
 */
import { test, expect } from '@playwright/test';
import { AUTH_STATE, HAS_CREDS, SAFE_ORIGIN, attachDiagnostics, forEachReachableScreen, installReadOnlyGuard, openApp, slugify, writeJsonArtifact } from './support/qa';
import { collectA11yViolations, formatA11yFindings, toA11yFindings, type A11yFinding } from './support/checks';

test.describe('a11y - public surface (signed out)', () => {
  test('axe reports no critical or serious violations', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    await openApp(page);
    const findings = toA11yFindings('Public: login card', await collectA11yViolations(page));
    const artifact = writeJsonArtifact(`qa-a11y-public-${slugify(test.info().project.name)}.json`, findings);

    console.log(`[a11y] public @ ${SAFE_ORIGIN}: ${findings.length} critical/serious violation(s) -> ${artifact}`);

    expect(
      formatA11yFindings(findings),
      `axe found critical/serious WCAG A/AA violations on the public surface of ${SAFE_ORIGIN}` +
        `\n${formatA11yFindings(findings).join('\n')}`
    ).toEqual([]);
  });
});

test.describe('a11y - signed-in surface', () => {
  test.use({ storageState: AUTH_STATE });
  test.skip(!HAS_CREDS, 'Set QA_USERNAME and QA_PASSWORD in .env to enable the signed-in pass.');

  test('axe reports no critical or serious violations on any reachable screen', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    await openApp(page);
    await expect(page.locator('#login-identifier')).toHaveCount(0);

    const findings: A11yFinding[] = [];

    const visited = await forEachReachableScreen(page, async screen => {
      const violations = await collectA11yViolations(page);
      console.log(`[a11y] ${screen.label}: ${violations.length} critical/serious violation(s)`);
      findings.push(...toA11yFindings(screen.label, violations));
    });

    const artifact = writeJsonArtifact(
      `qa-a11y-signed-in-${slugify(test.info().project.name)}.json`,
      findings
    );
    console.log(`[a11y] signed-in crawl visited: ${visited.map(screen => screen.label).join(', ') || '(none)'}`);
    console.log(`[a11y] ${findings.length} violation(s) across ${visited.length} screen(s) -> ${artifact}`);

    expect(
      formatA11yFindings(findings),
      `axe found critical/serious WCAG A/AA violations on the signed-in surface of ${SAFE_ORIGIN}` +
        `\n${formatA11yFindings(findings).join('\n')}`
    ).toEqual([]);
  });
});
