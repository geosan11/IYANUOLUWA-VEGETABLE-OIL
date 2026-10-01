/**
 * The five audit bodies, written once so the public and signed-in groups can
 * never drift apart. Each helper either returns a report for the spec to assert
 * on (so failures print the whole picture) or asserts directly.
 */
import { expect, type APIRequestContext, type Page, type Response } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  SAFE_ORIGIN,
  consoleErrorsExcludingGuardArtifacts,
  formatDiagnostics,
  type Diagnostics,
} from './qa';

/**
 * Load quality for whatever surface is on screen: HTTP status, title, first
 * heading, and zero console errors / uncaught errors / failed responses.
 */
export async function expectCleanLoad(
  page: Page,
  diagnostics: Diagnostics,
  response: Response | null,
  label: string
): Promise<void> {
  expect(response, `[${label}] no navigation response was recorded for ${SAFE_ORIGIN}`).not.toBeNull();
  expect(response?.status(), `[${label}] HTTP status for ${SAFE_ORIGIN}`).toBeLessThan(400);

  expect((await page.title()).trim(), `[${label}] document.title is empty`).not.toBe('');

  const heading = page.locator('h1').first();
  await expect(heading, `[${label}] the first <h1> is not visible`).toBeVisible();
  expect((await heading.innerText()).trim(), `[${label}] the first <h1> is empty`).not.toBe('');

  expect(
    consoleErrorsExcludingGuardArtifacts(diagnostics),
    `[${label}] the page logged console errors\n${formatDiagnostics(diagnostics)}`
  ).toEqual([]);
  expect(
    diagnostics.pageErrors,
    `[${label}] the page threw an uncaught error\n${formatDiagnostics(diagnostics)}`
  ).toEqual([]);
  expect(
    diagnostics.failedRequests,
    `[${label}] the page received 4xx/5xx responses\n${formatDiagnostics(diagnostics)}`
  ).toEqual([]);
}

/** `href` values that are placeholders rather than destinations (a bare `#` too). */
const PLACEHOLDER_HREF = /^(javascript:|about:blank|data:text\/html)/i;

export interface LinkFinding {
  href: string;
  detail: string;
}

export interface LinkReport {
  /** How many <a href> elements the surface actually has (0 is a finding in itself). */
  anchors: number;
  externalChecked: number;
  sameOriginSkipped: string[];
  fragmentsChecked: number;
  /** Anchors whose protocol is not fetchable (tel:, mailto:, ...), as "protocol xN". */
  protocolOnly: string[];
  /** Distinct href shapes, digits masked — proves what was actually audited. */
  shapes: string[];
  placeholders: string[];
  broken: LinkFinding[];
  missingFragmentTargets: string[];
}

/** Digits are masked so phone-number links can be logged without printing PII. */
function maskHref(href: string): string {
  const masked = href.replace(/\d/g, '#');
  return masked.length > 80 ? `${masked.slice(0, 77)}...` : masked;
}

/**
 * Collects every <a href> on the current surface and reports placeholders,
 * dangling in-page fragments, and outbound links that do not answer < 400.
 */
export async function collectLinkReport(page: Page, request: APIRequestContext): Promise<LinkReport> {
  const anchors = await page.$$eval('a[href]', nodes =>
    nodes.map(node => ({
      href: node.getAttribute('href') ?? '',
      text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
    }))
  );

  const placeholders: string[] = [];
  const fragments: string[] = [];
  const sameOriginSkipped: string[] = [];
  const external = new Map<string, string>();
  // tel:/mailto:/whatsapp: are real destinations but not fetchable pages. Counted
  // so a green run still shows how many anchors were intentionally not fetched.
  const protocolOnly = new Map<string, number>();
  const shapes = new Set<string>();

  for (const anchor of anchors) {
    const href = anchor.href.trim();
    const described = `"${href}"${anchor.text ? ` - "${anchor.text}"` : ''}`;
    shapes.add(maskHref(href));

    // In-page fragment first: "#main-content" is a real destination (the skip
    // link), not a placeholder. A bare "#" is still a placeholder, below.
    if (href.startsWith('#') && href.length > 1) {
      fragments.push(href.slice(1));
      continue;
    }
    if (href === '' || href === '#' || PLACEHOLDER_HREF.test(href)) {
      placeholders.push(described);
      continue;
    }

    let absolute: URL;
    try {
      absolute = new URL(href, page.url());
    } catch {
      placeholders.push(`unparseable: ${described}`);
      continue;
    }
    // mailto:, tel:, whatsapp: etc. are destinations, not fetchable pages.
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') {
      protocolOnly.set(absolute.protocol, (protocolOnly.get(absolute.protocol) ?? 0) + 1);
      continue;
    }

    if (absolute.origin === SAFE_ORIGIN) {
      // The SPA shell is the same document; re-fetching it proves nothing.
      sameOriginSkipped.push(absolute.pathname + absolute.search);
      continue;
    }
    if (!external.has(absolute.href)) external.set(absolute.href, anchor.text);
  }

  const missingFragmentTargets = fragments.length
    ? await page.evaluate(
        ids => ids.filter(id => !document.getElementById(id)).map(id => `#${id}`),
        fragments
      )
    : [];

  const broken: LinkFinding[] = [];
  for (const [url, text] of external) {
    let status = 0;
    let failure = '';
    try {
      let response = await request.head(url, {
        timeout: 15_000,
        maxRedirects: 5,
        failOnStatusCode: false,
      });
      // Plenty of servers reject HEAD outright — retry with GET before crying wolf.
      if ([400, 403, 405, 501].includes(response.status())) {
        response = await request.get(url, { timeout: 15_000, maxRedirects: 5, failOnStatusCode: false });
      }
      status = response.status();
    } catch (error) {
      failure = (error as Error).message;
    }

    if (failure) {
      broken.push({ href: url, detail: `request failed - ${failure}` });
      continue;
    }
    if (status >= 400) {
      const hint =
        status === 403 || status === 429
          ? ' (likely bot/WAF filtering - worth one manual click)'
          : '';
      broken.push({
        href: url,
        detail: `HTTP ${status}${hint}${text ? ` - anchor "${text}"` : ''}`,
      });
    }
  }

  return {
    anchors: anchors.length,
    externalChecked: external.size,
    sameOriginSkipped,
    fragmentsChecked: fragments.length,
    protocolOnly: [...protocolOnly].map(([protocol, count]) => `${protocol} x${count}`),
    shapes: [...shapes],
    placeholders,
    broken,
    missingFragmentTargets,
  };
}

export interface ImageFinding {
  src: string;
  alt: string | null;
  naturalWidth: number;
  rendered: boolean;
}

/** Scrolls the whole document once so lazy-loaded images below the fold resolve. */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight, 400);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
}

export async function collectImages(page: Page): Promise<ImageFinding[]> {
  await scrollThrough(page);

  // `complete` is true for already-failed images too, so this only waits for the
  // loads to stop changing — success is judged below via naturalWidth.
  await page
    .waitForFunction(() => Array.from(document.images).every(image => image.complete), undefined, {
      timeout: 15_000,
    })
    .catch(() => undefined);

  return page.$$eval('img', nodes =>
    nodes.map(node => {
      const image = node as HTMLImageElement;
      const box = image.getBoundingClientRect();
      return {
        src: image.currentSrc || image.getAttribute('src') || '(no src attribute)',
        alt: image.getAttribute('alt'),
        naturalWidth: image.naturalWidth,
        rendered: box.width > 0 && box.height > 0,
      };
    })
  );
}

export type A11yViolation = Awaited<ReturnType<typeof collectA11yViolations>>[number];

/** Everything the report needs about one violation, per screen. */
export interface A11yFinding {
  screen: string;
  rule: string;
  impact: string;
  help: string;
  helpUrl: string;
  nodeCount: number;
  nodes: { target: string; html: string; why: string }[];
}

export function toA11yFindings(screen: string, violations: A11yViolation[]): A11yFinding[] {
  return violations.map(violation => ({
    screen,
    rule: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodeCount: violation.nodes.length,
    nodes: violation.nodes.map(node => ({
      target: node.target.join(' '),
      html: node.html,
      why: (node.failureSummary ?? '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join(' | '),
    })),
  }));
}

/** Axe, limited to what the brief asks for: critical + serious, WCAG A/AA. */
export async function collectA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter(
    violation => violation.impact === 'critical' || violation.impact === 'serious'
  );
}

/**
 * Human-readable evidence, four nodes deep: enough to see the pattern, with the
 * count showing how wide it really is.
 */
export function formatA11yFindings(findings: A11yFinding[]): string[] {
  return findings.map(finding => {
    const lines = [
      `[${finding.screen}] ${finding.rule} [${finding.impact}] ${finding.help}`,
      `      rule: ${finding.helpUrl}`,
      `      nodes (${finding.nodeCount}):`,
    ];
    for (const node of finding.nodes.slice(0, 4)) {
      lines.push(`        - ${node.target}`);
      lines.push(`          html: ${node.html.replace(/\s+/g, ' ').trim().slice(0, 150)}`);
      const why = node.why.split(' | ')[0];
      if (why) lines.push(`          why: ${why}`);
    }
    if (finding.nodeCount > 4) {
      lines.push(`        - (+${finding.nodeCount - 4} more node(s) omitted)`);
    }
    return lines.join('\n');
  });
}

export interface OverflowMeasurement {
  viewport: number;
  documentScrollWidth: number;
  bodyScrollWidth: number;
}

export async function measureOverflow(page: Page): Promise<OverflowMeasurement> {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
}

export function formatOverflow({ viewport, documentScrollWidth, bodyScrollWidth }: OverflowMeasurement): string {
  return `viewport ${viewport}px, documentElement.scrollWidth ${documentScrollWidth}px, body.scrollWidth ${bodyScrollWidth}px`;
}

