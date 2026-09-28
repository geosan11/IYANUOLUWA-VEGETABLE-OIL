/**
 * Which tables the app actually reaches Postgres with — and which it doesn't.
 *
 * Three console errors in this app (a `physical_tanks` 400 that rejected a tank
 * with a blank capacity, a "Failed to load profile" warning, and a 403 on sign
 * out) were all consistent with a *database* explanation: a table no migration
 * ever created, a grant that is missing, or a migration that was never applied
 * to this project. Nothing in the browser can tell those three apart — every one
 * of them surfaces as "it didn't sync".
 *
 * This script answers that from outside the app: sign in as the owner, then ask
 * PostgREST for one row of every table the app names and read the server's own
 * answer. Read-only: it counts rows and never inserts, updates or deletes.
 *
 *     # put the owner login in the environment (never committed)
 *     $env:SUPABASE_EMAIL    = 'owner@example.com'
 *     $env:SUPABASE_PASSWORD = '…'
 *     npm run check:sync            # or: node supabase/tools/check_sync.mjs
 *
 * Exit code 0 means every table answered. Exit code 1 lists the ones that did
 * not, each with the server's own classification:
 *
 *   MISSING   PGRST205 / 404 — no migration created it on this project
 *   DENIED    403 / 42501    — the table exists but this role has no grant
 *   UNAUTH    401            — the login itself was rejected
 *
 * Companion to `check_ledger_schema.py`, which compares the SQL against the
 * app's column lists *offline*. This one compares the app to the live project.
 */

import { readFileSync } from 'node:fs';

/**
 * Every table the app calls `.from(...)` on, with the module that writes it and
 * a column to count by. `pack_prices` has no `id` — its key is the whole
 * (product, variety, pack size, tier) tuple.
 */
const TABLES = [
  // --- transactional (src/services/ledger.ts) -------------------------------
  { table: 'customers', select: 'id', writer: 'ledger.ts' },
  { table: 'tanks', select: 'id', writer: 'ledger.ts' },
  { table: 'sales', select: 'id', writer: 'ledger.ts' },
  { table: 'orders', select: 'id', writer: 'ledger.ts' },
  { table: 'sale_payments', select: 'id', writer: 'ledger.ts' },
  { table: 'payments', select: 'id', writer: 'ledger.ts' },
  // --- master data (src/services/store.tsx) ---------------------------------
  { table: 'hubs', select: 'id', writer: 'store.tsx' },
  { table: 'app_settings', select: 'id', writer: 'store.tsx' },
  { table: 'suppliers', select: 'id', writer: 'store.tsx' },
  { table: 'physical_tanks', select: 'id', writer: 'store.tsx' },
  { table: 'pumps', select: 'id', writer: 'store.tsx' },
  { table: 'products', select: 'id', writer: 'store.tsx' },
  { table: 'product_varieties', select: 'id', writer: 'store.tsx' },
  // --- the Inventory price matrix (src/services/masterData.ts) --------------
  { table: 'pack_prices', select: 'product_id', writer: 'masterData.ts' },
  // --- shipped with a table, but nothing in the app writes it yet -----------
  { table: 'audit_log', select: 'id', writer: '(no writer yet)' }
];

/** Read `.env` (git-ignored) so the URL and key don't have to be retyped. */
function readEnv() {
  const env = { ...process.env };
  let text = '';
  try {
    text = readFileSync('.env', 'utf8');
  } catch {
    console.warn('(no .env found — supply VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in the environment)');
    return env;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    // A real environment variable always wins over the file.
    if (!env[match[1]]) env[match[1]] = value;
  }
  return env;
}

/**
 * Sign in the way the app does (password grant) and hand back the access token.
 * The anon key alone is not enough: no table grants anything to `anon` — see
 * 0002_auth_rls.sql — so every probe would just report an empty result set.
 */
async function signIn(url, anonKey, email, password) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error_description || body.msg || body.error || 'no detail';
    console.error(`sign-in failed (${response.status}): ${detail}`);
    return null;
  }
  return body.access_token ?? null;
}


/** Ask for one row and read the server's classification of the answer. */
async function probe(url, anonKey, token, { table, select }) {
  let response;
  try {
    response = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=1`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        // Ask for the total row count, not just the one row we requested.
        Prefer: 'count=exact'
      }
    });
  } catch (err) {
    return { status: 'OFFLINE', detail: err.message };
  }

  const body = await response.text();
  if (response.ok) {
    // content-range: "0-0/42" — or "*/0" when the table holds no rows.
    const total = (response.headers.get('content-range') || '').split('/')[1];
    return { status: 'OK', rows: !total || total === '*' ? '0' : total };
  }

  const message = (() => {
    try {
      return JSON.parse(body).message || body;
    } catch {
      return body.slice(0, 120);
    }
  })();
  if (response.status === 404 || /PGRST205|does not exist/i.test(String(message))) {
    return { status: 'MISSING', detail: message };
  }
  if (response.status === 401) return { status: 'UNAUTH', detail: message };
  if (response.status === 403) return { status: 'DENIED', detail: message };
  return { status: `HTTP ${response.status}`, detail: message };
}

async function main() {
  const env = readEnv();
  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const email = env.SUPABASE_EMAIL;
  const password = env.SUPABASE_PASSWORD;

  if (!url || !anonKey || url.includes('your-project-ref')) {
    console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — nothing to check.');
    return 2;
  }
  // An access token, or an owner login to obtain one with.
  const token = env.SUPABASE_ACCESS_TOKEN || (email && password ? await signIn(url, anonKey, email, password) : null);
  if (!token) {
    console.error(
      'Set an owner login so every table can be read as an authenticated user:\n' +
      "  $env:SUPABASE_EMAIL = 'owner@example.com'\n" +
      "  $env:SUPABASE_PASSWORD = '<password>'\n" +
      '(or set SUPABASE_ACCESS_TOKEN if you already have one)\n' +
      'then re-run. Owners see every row; a staff profile has no grant on some tables.'
    );
    return 2;
  }

  console.log(`project: ${url}`);
  // `email` is only known on the login path — say which identity is asking.
  const identity = env.SUPABASE_ACCESS_TOKEN ? 'SUPABASE_ACCESS_TOKEN' : email;
  console.log(`checking ${TABLES.length} tables as ${identity}`);
  if (env.SUPABASE_ACCESS_TOKEN) {
    console.log('(row counts show only what that token is allowed to see — RLS can hide rows)');
  }
  console.log('');

  const problems = [];
  let reachable = 0;
  let lastWriter = '';
  for (const entry of TABLES) {
    if (entry.writer !== lastWriter) {
      console.log(`  -- written by ${entry.writer}`);
      lastWriter = entry.writer;
    }
    const result = await probe(url, anonKey, token, entry);
    if (result.status === 'OK') {
      reachable++;
      console.log(`  OK      ${entry.table.padEnd(19)} ${String(result.rows).padStart(6)} row(s)`);
      continue;
    }
    console.log(`  ${result.status.padEnd(7)} ${entry.table.padEnd(19)} ${'—'.padStart(6)}`);
    problems.push(`${result.status} ${entry.table} — ${result.detail}`);
  }

  console.log('\n' + '='.repeat(72));
  if (problems.length === 0) {
    console.log(`All ${TABLES.length} tables answered. Nothing is missing a table or a grant.`);
    return 0;
  }
  console.log(`${reachable}/${TABLES.length} tables answered; ${problems.length} problem(s):`);
  for (const problem of problems) console.log(' -', problem);
  console.log(
    '\nMISSING = apply supabase/migrations/*.sql to this project. ' +
    'DENIED = the table exists but the grant is missing (see 0024_inventory_grant_products.sql).'
  );
  return 1;
}

// Set `exitCode` rather than calling `process.exit()`: on Windows a hard exit
// with a fetch handle still closing trips a libuv assertion and corrupts the
// exit code, which is exactly the signal a caller reads.
process.exitCode = await main();

