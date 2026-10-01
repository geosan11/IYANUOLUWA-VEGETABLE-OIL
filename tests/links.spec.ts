/**
 * Link audit: no placeholder hrefs, no dangling in-page fragments, and every
 * outbound link answers < 400.
 *
 * The public (signed-out) surface is the login card, which currently ships ZERO
 * anchors — the count is logged so a green run can never hide "nothing was
 * checked".
 */
import { test, expect } from '@playwright/test';
import { AUTH_STATE, HAS_CREDS, attachDiagnostics, forEachReachableScreen, installReadOnlyGuard, openApp } from './support/qa';
import { collectLinkReport, type LinkFinding } from './support/checks';

const describeFinding = (finding: LinkFinding) => `${finding.href} -> ${finding.detail}`;

test.describe('links - public surface (signed out)', () => {
  test('every anchor is a real, reachable destination', async ({ page, request }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    await openApp(page);
    const report = await collectLinkReport(page, request);

    console.log(
      `[links] public surface: ${report.anchors} anchor(s), ${report.externalChecked} outbound checked, ` +
        `${report.sameOriginSkipped.length} same-origin (SPA) skipped, ` +
        `${report.fragmentsChecked} fragment(s), non-fetchable: ${report.protocolOnly.join(', ') || 'none'}`
    );

    expect(report.placeholders, `Placeholder href values:\n${report.placeholders.join('\n')}`).toEqual([]);
    expect(
      report.missingFragmentTargets,
      'In-page links whose target id does not exist:\n' + report.missingFragmentTargets.join('\n')
    ).toEqual([]);
    expect(
      report.broken.map(describeFinding),
      'Outbound links that did not answer < 400:\n' + report.broken.map(describeFinding).join('\n')
    ).toEqual([]);
  });
});

test.describe('links - signed-in surface', () => {
  test.use({ storageState: AUTH_STATE });
  test.skip(!HAS_CREDS, 'Set QA_USERNAME and QA_PASSWORD in .env to enable the signed-in pass.');

  test('every anchor on every reachable screen is real and reachable', async ({ page, request }) => {
    const diagnostics = attachDiagnostics(page);
    installReadOnlyGuard(page, diagnostics);

    await openApp(page);
    await expect(page.locator('#login-identifier')).toHaveCount(0);

    const placeholders: string[] = [];
    const missingFragmentTargets: string[] = [];
    const broken: LinkFinding[] = [];
    let anchors = 0;
    let checked = 0;

    const visited = await forEachReachableScreen(page, async screen => {
      const report = await collectLinkReport(page, request);
      anchors += report.anchors;
      checked += report.externalChecked;
      placeholders.push(...report.placeholders.map(entry => `[${screen.label}] ${entry}`));
      missingFragmentTargets.push(
        ...report.missingFragmentTargets.map(entry => `[${screen.label}] ${entry}`)
      );
      broken.push(...report.broken.map(finding => ({ ...finding, href: `[${screen.label}] ${finding.href}` })));
      if (report.shapes.length > 1) {
        console.log(`[links] ${screen.label} href shapes: ${report.shapes.join(' | ')}`);
      }
      console.log(
        `[links] ${screen.label}: ${report.anchors} anchor(s), ${report.externalChecked} outbound checked, ` +
          `${report.fragmentsChecked} fragment(s), non-fetchable: ${report.protocolOnly.join(', ') || 'none'}`
      );
    });

    console.log(`[links] signed-in crawl visited: ${visited.map(screen => screen.label).join(', ') || '(none)'}`);
    console.log(`[links] signed-in totals: ${anchors} anchor(s), ${checked} outbound checked`);

    expect(placeholders, `Placeholder href values:\n${placeholders.join('\n')}`).toEqual([]);
    expect(
      missingFragmentTargets,
      'In-page links whose target id does not exist:\n' + missingFragmentTargets.join('\n')
    ).toEqual([]);
    expect(
      broken.map(describeFinding),
      'Outbound links that did not answer < 400:\n' + broken.map(describeFinding).join('\n')
    ).toEqual([]);
  });
});
