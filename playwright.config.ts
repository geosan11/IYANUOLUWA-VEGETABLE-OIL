import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * QA suite for the DEPLOYED build — read-only pass.
 *
 * No application source is imported or modified, and nothing is written to the
 * production database (`installReadOnlyGuard` in tests/support/qa.ts).
 *
 * The audited URL carries a Vercel share token, so it is deliberately NOT in
 * this file: `dotenv` reads the gitignored `.env` and BASE_URL comes from
 * there. Every URL the suite prints is reduced to its origin, so the token
 * cannot leak into playwright-report/ either.
 */
dotenv.config({ quiet: true });

const baseURL = process.env.BASE_URL;

if (!baseURL) {
  throw new Error(
    'BASE_URL is not set. Add it to the gitignored .env file, e.g.\n' +
      '  BASE_URL=https://<deployment>.vercel.app?_vercel_share=<token>'
  );
}

export default defineConfig({
  testDir: './tests',
  // Sizing for the heaviest test: the signed-in a11y crawl runs axe over every
  // reachable screen (12 on an owner account). Each screen costs its own axe pass
  // plus the app's 1.06s screen slide, which the crawl deliberately waits out, and
  // WebKit is meaningfully slower than Chromium.
  timeout: 150_000,
  expect: { timeout: 10_000 },
  retries: 1,

  // 'list' keeps the terminal readable while the suite runs; the HTML report
  // (open: never) is the human-facing view and the JSON one is what QA_REPORT.md
  // is built from (per-test status plus every console.log). All three land in
  // gitignored dirs.
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/qa-results.json' }],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // Signs in once and drops the session into playwright/.auth/ (gitignored —
      // it holds live tokens). trace:'off' is deliberate: a retried trace would
      // record the password POST body. The audit projects keep on-first-retry.
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], trace: 'off' },
    },
    {
      name: 'Desktop Chrome',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // iPhone 13 is a WebKit device, which is why the install step needs
      // `npx playwright install chromium webkit` (not chromium alone).
      name: 'iPhone 13',
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'] },
    },
  ],
});
