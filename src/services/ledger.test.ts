/**
 * Verification suite for `ledger.ts` — the layer that mirrors sales, sale lines,
 * tender legs, receipts, customers and stock intakes to Supabase.
 *
 * Run with `npm run test:ledger` (or `npm test`, which runs both suites). Same
 * hand-rolled harness as `businessLogic.test.ts`: no runner, no dependencies,
 * every assertion a one-line sentence so a failure names the broken behaviour.
 *
 * Two things are worth knowing before reading on:
 *
 *   • The module is written against the BROWSER's localStorage, so this file
 *     installs an in-memory stand-in first — including a switch that makes
 *     writes throw, to prove what happens when storage is full.
 *   • Supabase is deliberately NOT configured here, which is itself the most
 *     important case: with no client the layer must report "no answer" instead
 *     of "no rows", so nothing is ever wiped or deleted because a call failed.
 */
import {
  LEDGER_PULL_COLUMNS,
  LEDGER_PUSH_ORDER,
  clearLedgerOutbox,
  diffLedgerRows,
  enqueueLedgerRows,
  flushLedgerOutbox,
  isLedgerSchemaReady,
  ledgerOutboxCount,
  pullLedgerTable,
  readLedgerOutbox,
  snapshotLedgerRows,
  subscribeLedgerOutbox,
  toCustomerRow,
  toOrderRow,
  toPaymentRow,
  toSalePaymentLegs,
  toSaleRow,
  toTankRow
} from './ledger';
import type { LedgerTable } from './ledger';
import type { Customer, Order, Payment, Sale, Tank } from '../types';

// ---------------------------------------------------------------------------
// localStorage stand-in (Node has none; ledger.ts is browser code)
// ---------------------------------------------------------------------------
class MemoryStorage {
  private store = new Map<string, string>();
  /** Flip on to simulate a full / blocked localStorage. */
  failWrites = false;

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.store.set(key, String(value));
  }
}

const memoryStorage = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = memoryStorage;

console.log('====================================================');
console.log('RUNNING LEDGER SYNC (SUPABASE MIRROR) VERIFICATION');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

/**
 * Run a block with console.warn captured, so deliberate failure cases can be
 * asserted on (the module is supposed to complain) without dumping stack traces
 * into the suite output.
 */
function captureWarnings(run: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    run();
  } finally {
    console.warn = original;
  }
  return warnings;
}

const OUTBOX_KEY = 'iyanu_ledger_outbox_v1';

// ---------------------------------------------------------------------------
// Sample rows — one of each shape with every field populated, so the mappers
// are exercised on real values instead of on undefined
// ---------------------------------------------------------------------------
const SAMPLE_CUSTOMER: Customer = {
  id: 'cust-test-1',
  name: 'Alhaji Musa Stores',
  type: 'agent',
  credit_limit: 250000,
  credit_term_days: 14,
  phone: '08031234567',
  hub_id: 'hub-los-alaba',
  created_at: '2026-01-04T08:00:00.000Z'
};

const SAMPLE_TANK: Tank = {
  id: 'tank-test-1',
  product_id: 'veg',
  truck_label: 'BDG-441-XA',
  tons: 14.5,
  received_litres: 15950,
  remaining_litres: 12250,
  date: '2026-01-04T08:00:00.000Z',
  shortfall: 50,
  supplier_id: 'sup-1',
  space_note: 'Bay 2',
  physical_tank_id: 'pt-1',
  supply_model: 'bulk_truck',
  hub_id: 'hub-los-alaba'
};

const SAMPLE_SALE: Sale = {
  id: 'sale-test-1',
  customer_id: SAMPLE_CUSTOMER.id,
  date: '2026-01-04T09:15:00.000Z',
  payment_method: 'split',
  payment_splits: [
    { method: 'cash', amount: 45000, amount_tendered: 50000, change_due: 5000 },
    { method: 'credit', amount: 30000, credit_term_days: 14, due_date: '2026-01-18T09:15:00.000Z' }
  ],
  amount_tendered: 50000,
  change_due: 5000,
  cashier_name: 'Bola',
  note: 'Two drums, one on credit',
  credit_term_days: 14,
  due_date: '2026-01-18T09:15:00.000Z',
  voided: false,
  voided_at: null,
  voided_by: null,
  void_reason: null,
  hub_id: 'hub-los-alaba'
};

const SAMPLE_LINE: Order = {
  id: 'line-test-1',
  sale_id: SAMPLE_SALE.id,
  customer_id: SAMPLE_CUSTOMER.id,
  product_id: 'veg',
  variety_id: 'veg-soya',
  variety_name: 'Pure Soya',
  pack_size_id: 'sz_25',
  qty: 30,
  litres: 750,
  unit_price: 2500,
  original_unit_price: 2600,
  price_adjusted: true,
  price_adjust_reason: 'Bulk discount approved by owner',
  oil_amount: 75000,
  container_mode: 'taken',
  returnable: true,
  container_unit_price: null,
  container_amount: null,
  line_amount: 75000,
  amount: 75000,
  pricing_tier: 'agent',
  payment_method: 'split',
  payment_splits: SAMPLE_SALE.payment_splits,
  paid_amount: 45000,
  credit_term_days: 14,
  due_date: '2026-01-18T09:15:00.000Z',
  date: SAMPLE_SALE.date,
  source_tank_id: SAMPLE_TANK.id,
  pump_id: 'p-1',
  voided: false,
  note: 'Line note',
  hub_id: 'hub-los-alaba'
};

const SAMPLE_PAYMENT: Payment = {
  id: 'pay-test-1',
  customer_id: SAMPLE_CUSTOMER.id,
  amount: 30000,
  method: 'transfer',
  date: '2026-01-10T10:00:00.000Z',
  applied_to: [{ order_id: SAMPLE_LINE.id, amount: 30000 }],
  overpayment_to_credit: 0,
  source: 'payment',
  recorded_by: 'user-1',
  note: 'Transfer ref 9281',
  voided: false,
  voided_at: null,
  void_reason: null,
  hub_id: 'hub-los-alaba'
};

function mappedRowFor(table: LedgerTable): Record<string, unknown> {
  switch (table) {
    case 'customers':
      return toCustomerRow(SAMPLE_CUSTOMER);
    case 'tanks':
      return toTankRow(SAMPLE_TANK);
    case 'sales':
      return toSaleRow(SAMPLE_SALE);
    case 'orders':
      return toOrderRow(SAMPLE_LINE);
    case 'sale_payments':
      return toSalePaymentLegs(SAMPLE_SALE, [SAMPLE_LINE])[0].row;
    case 'payments':
      return toPaymentRow(SAMPLE_PAYMENT);
  }
}

function pullColumnList(table: LedgerTable): string[] {
  return LEDGER_PULL_COLUMNS[table]
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// TEST: mappers and pull column lists cannot drift apart
//
// Two allowlists keep this honest and self-documenting:
//   PULL_ONLY  — columns the database maintains, so no mapper produces them
//   WRITE_ONLY — legacy columns a mapper keeps populated for the old NOT NULL
//                constraints but the app never reads back
// Anything outside those lists must appear on BOTH sides, or a row would lose
// data on the way home: pulled from the database, merged into state, and then
// written back without the field it was read for.
// ---------------------------------------------------------------------------
const PULL_ONLY = new Set(['created_at', 'updated_at']);

const WRITE_ONLY: Record<LedgerTable, string[]> = {
  customers: [],
  tanks: [],
  sales: [],
  orders: ['unit', 'rate', 'discount_reason'],
  sale_payments: [],
  payments: []
};

for (const table of LEDGER_PUSH_ORDER) {
  const mapperKeys = Object.keys(mappedRowFor(table));
  const pulled = pullColumnList(table);
  const unread = mapperKeys.filter(key => !pulled.includes(key) && !WRITE_ONLY[table].includes(key));
  const unmapped = pulled.filter(key => !mapperKeys.includes(key) && !PULL_ONLY.has(key));

  assert(
    unread.length === 0,
    `${table}: every mapped column is read back by the pull (skipping: ${unread.join(', ') || 'none'})`
  );
  assert(
    unmapped.length === 0,
    `${table}: every pulled column is produced by the mapper (skipping: ${unmapped.join(', ') || 'none'})`
  );
}

// ---------------------------------------------------------------------------
// TEST: flush order is FK order
// ---------------------------------------------------------------------------
const pushOrder = LEDGER_PUSH_ORDER;
assert(pushOrder.length === 6, 'Push order: lists each of the six ledger tables once');
assert(
  pushOrder.indexOf('customers') < pushOrder.indexOf('sales'),
  'Push order: customers before sales (sales.customer_id → customers)'
);
assert(
  pushOrder.indexOf('customers') < pushOrder.indexOf('orders'),
  'Push order: customers before orders (orders.customer_id → customers)'
);
assert(
  pushOrder.indexOf('sales') < pushOrder.indexOf('orders'),
  'Push order: sales before orders (0019 adds orders.sale_id → sales)'
);
assert(
  pushOrder.indexOf('sales') < pushOrder.indexOf('sale_payments'),
  'Push order: sales before tender legs (0019 adds sale_payments.sale_id → sales)'
);
assert(
  pushOrder.indexOf('customers') < pushOrder.indexOf('payments'),
  'Push order: customers before receipts (0022 adds payments.customer_id → customers)'
);
assert(
  pushOrder.indexOf('orders') < pushOrder.indexOf('payments'),
  'Push order: lines before receipts (payments.applied_to names order ids)'
);

// ---------------------------------------------------------------------------
// TEST: `Order` → `orders`, the two names that do not match up
// ---------------------------------------------------------------------------
const lineRow = toOrderRow(SAMPLE_LINE);
assert(lineRow.amount === 75000, 'toOrderRow: the app\'s line_amount lands in the DB\'s legacy `amount` column');
assert(lineRow.rate === 100, 'toOrderRow: `rate` is the per-litre equivalent (75,000 over 750 L)');
assert(
  lineRow.unit === null,
  'toOrderRow: `unit` is written null — a pack line has a pack size, not a litre/keg/ton unit'
);
assert(
  lineRow.discount_reason === SAMPLE_LINE.price_adjust_reason &&
    lineRow.price_adjust_reason === SAMPLE_LINE.price_adjust_reason,
  'toOrderRow: an override reason fills both the new and the legacy reason column'
);
assert(
  toOrderRow({ ...SAMPLE_LINE, line_amount: null as unknown as number }).amount === 75000,
  'toOrderRow: falls back to the `amount` alias when line_amount is absent'
);
assert(
  toOrderRow({ ...SAMPLE_LINE, litres: 0 }).rate === 0,
  'toOrderRow: a zero-litre line gets rate 0, never Infinity'
);
assert(
  toOrderRow({ ...SAMPLE_LINE, qty: undefined as unknown as number }).qty === 0,
  'toOrderRow: a missing number is coerced to 0 instead of NaN reaching the insert'
);
assert(
  toOrderRow({ ...SAMPLE_LINE, container_mode: undefined as unknown as Order['container_mode'] }).container_mode ===
    'none',
  'toOrderRow: an unset container mode defaults to none'
);
assert(
  toOrderRow({ ...SAMPLE_LINE, price_adjusted: undefined as unknown as boolean }).price_adjusted === false,
  'toOrderRow: an unset price-adjusted flag is written false, never null'
);

// ---------------------------------------------------------------------------
// TEST: tender legs (`sale_payments`) — one row per leg, stable ids
// ---------------------------------------------------------------------------
const legs = toSalePaymentLegs(SAMPLE_SALE, [SAMPLE_LINE]);
assert(legs.length === 2, 'Tender legs: a cash+credit split writes two legs');
assert(
  legs[0].id === `sp-${SAMPLE_SALE.id}-0` && legs[1].id === `sp-${SAMPLE_SALE.id}-1`,
  'Tender legs: ids derive from the sale id and leg index, so a re-push upserts instead of duplicating the tenders'
);
assert(legs[0].row.amount === 45000 && legs[1].row.amount === 30000, 'Tender legs: each leg carries its split amount');
assert(
  legs[0].row.amount_tendered === 50000 && legs[0].row.change_due === 5000,
  'Tender legs: cash tendered and change sit on the first leg'
);
assert(
  legs[1].row.amount_tendered === null && legs[1].row.change_due === null,
  'Tender legs: later legs carry no tendered/change (that money was never in hand)'
);
assert(
  legs[1].row.credit_term_days === 14 && legs[0].row.credit_term_days === null,
  'Tender legs: credit terms belong to the credit leg only'
);
assert(
  legs[1].row.due_date === SAMPLE_SALE.due_date && legs[0].row.due_date === null,
  'Tender legs: a due date belongs to the credit leg only'
);
assert(
  legs.every(leg => leg.table === 'sale_payments' && leg.row.sale_id === SAMPLE_SALE.id),
  'Tender legs: every leg is a sale_payments row pointing at its sale'
);

const soloLegs = toSalePaymentLegs(
  { ...SAMPLE_SALE, payment_method: 'cash', payment_splits: undefined, amount_tendered: 100000, change_due: 25000 },
  [SAMPLE_LINE]
);
assert(
  soloLegs.length === 1 && soloLegs[0].row.method === 'cash' && soloLegs[0].row.amount === 75000,
  'Tender legs: an unsplit sale writes one leg for the lines\' total'
);
assert(
  soloLegs[0].row.amount_tendered === 100000 && soloLegs[0].row.change_due === 25000,
  'Tender legs: the single leg keeps the tendered/change for the whole sale'
);

const zeroLegs = toSalePaymentLegs(
  {
    ...SAMPLE_SALE,
    payment_method: 'split',
    payment_splits: [
      { method: 'cash', amount: 0 },
      { method: 'credit', amount: 0 }
    ]
  },
  [SAMPLE_LINE]
);
assert(zeroLegs.length === 0, 'Tender legs: a zero-amount leg is not written at all');

const lineLessLegs = toSalePaymentLegs({ ...SAMPLE_SALE, payment_method: 'cash', payment_splits: undefined }, []);
assert(lineLessLegs.length === 0, 'Tender legs: a sale whose lines total zero writes no tender');

// ---------------------------------------------------------------------------
// TEST: sale header, receipt, intake and customer mappers
// ---------------------------------------------------------------------------
const saleRow = toSaleRow(SAMPLE_SALE);
assert(
  Array.isArray(saleRow.payment_splits) && (saleRow.payment_splits as unknown[]).length === 2,
  'toSaleRow: the tender split rides on the sale header as jsonb'
);
assert(
  toSaleRow({ ...SAMPLE_SALE, voided: undefined }).voided === false,
  'toSaleRow: a missing voided flag is written false, never null'
);
assert(
  toSaleRow({ ...SAMPLE_SALE, hub_id: undefined }).hub_id === null,
  'toSaleRow: an unattributed sale writes hub_id null instead of undefined'
);

const paymentRow = toPaymentRow(SAMPLE_PAYMENT);
assert(
  Array.isArray(paymentRow.applied_to) && (paymentRow.applied_to as unknown[]).length === 1,
  'toPaymentRow: line-level allocations are stored on the receipt'
);
assert(
  Array.isArray(toPaymentRow({ ...SAMPLE_PAYMENT, applied_to: undefined as unknown as Payment['applied_to'] })
    .applied_to),
  'toPaymentRow: a receipt with no allocations writes [] rather than null'
);
assert(
  toPaymentRow({ ...SAMPLE_PAYMENT, voided: undefined }).voided === false,
  'toPaymentRow: a missing voided flag is written false'
);
assert(
  toPaymentRow({ ...SAMPLE_PAYMENT, overpayment_to_credit: undefined as unknown as number })
    .overpayment_to_credit === 0,
  'toPaymentRow: a missing overpayment is written 0'
);

assert(
  toTankRow({ ...SAMPLE_TANK, supply_model: undefined }).supply_model === 'bulk_truck',
  'toTankRow: an unspecified supply model defaults to bulk_truck'
);
assert(
  toTankRow({ ...SAMPLE_TANK, space_note: undefined }).space_note === null,
  'toTankRow: absent text columns become null, not undefined'
);
assert(
  toTankRow({ ...SAMPLE_TANK, tons: undefined as unknown as number }).tons === 0,
  'toTankRow: a missing tonnage is coerced to 0'
);
assert(
  !('last_dipstick_reading' in toTankRow(SAMPLE_TANK)),
  'toTankRow: the denormalized dipstick cache is left to the database'
);

assert(
  toCustomerRow({ ...SAMPLE_CUSTOMER, hub_id: undefined }).hub_id === null,
  'toCustomerRow: an unattributed customer writes hub_id null'
);
assert(
  toCustomerRow({ ...SAMPLE_CUSTOMER, credit_limit: undefined as unknown as number }).credit_limit === 0,
  'toCustomerRow: a missing credit limit is coerced to 0'
);
assert(
  !('created_at' in toCustomerRow(SAMPLE_CUSTOMER)),
  'toCustomerRow: created_at is left to the database default, so re-pushing cannot rewrite it'
);

// ---------------------------------------------------------------------------
// TEST: change detection — what a session actually changed
// ---------------------------------------------------------------------------
const baseline = snapshotLedgerRows([SAMPLE_CUSTOMER], toCustomerRow);
assert(
  Object.keys(baseline).length === 1 && typeof baseline[SAMPLE_CUSTOMER.id] === 'string',
  'Snapshot: one JSON string per row id'
);
assert(
  diffLedgerRows('customers', baseline, [SAMPLE_CUSTOMER], toCustomerRow).length === 0,
  'Diff: an untouched row is not re-queued (no writes for rows nobody changed)'
);
assert(
  diffLedgerRows('customers', baseline, [{ ...SAMPLE_CUSTOMER, credit_limit: 260000 }], toCustomerRow).length === 1,
  'Diff: a changed number re-queues exactly that row'
);
assert(
  diffLedgerRows('customers', baseline, [], toCustomerRow).length === 0,
  'Diff: a locally removed row never queues a delete — the database keeps the ledger entry'
);
const addedDrafts = diffLedgerRows(
  'customers',
  baseline,
  [SAMPLE_CUSTOMER, { ...SAMPLE_CUSTOMER, id: 'cust-test-2' }],
  toCustomerRow
);
assert(
  addedDrafts.length === 1 && addedDrafts[0].id === 'cust-test-2',
  'Diff: a row absent from the snapshot is queued (a customer added on this device)'
);
assert(
  diffLedgerRows('customers', undefined, [SAMPLE_CUSTOMER], toCustomerRow).length === 1,
  'Diff: with no snapshot yet every row counts as unsent'
);

const orderBaseline = snapshotLedgerRows([SAMPLE_LINE], toOrderRow);
const voidedDrafts = diffLedgerRows('orders', orderBaseline, [{ ...SAMPLE_LINE, voided: true }], toOrderRow);
assert(
  voidedDrafts.length === 1 && voidedDrafts[0].row.voided === true,
  'Diff: voiding a line re-queues the row carrying the void (a void is an update, never a delete)'
);

// ---------------------------------------------------------------------------
// TEST: the outbox — dedupe, latest-state-wins, durable failure history
// ---------------------------------------------------------------------------
clearLedgerOutbox();
assert(ledgerOutboxCount() === 0, 'Outbox: starts empty');

assert(
  enqueueLedgerRows(diffLedgerRows('customers', undefined, [SAMPLE_CUSTOMER], toCustomerRow)) === 1 &&
    ledgerOutboxCount() === 1,
  'Outbox: a queued row is persisted and counted'
);

enqueueLedgerRows(diffLedgerRows('customers', baseline, [{ ...SAMPLE_CUSTOMER, credit_limit: 999 }], toCustomerRow));
const deduped = readLedgerOutbox();
assert(
  deduped.length === 1 && (deduped[0].row as { credit_limit: number }).credit_limit === 999,
  'Outbox: a second edit of the same row keeps ONE entry carrying the newest values'
);
assert(
  deduped[0].attempts === 0 && typeof deduped[0].enqueued_at === 'string',
  'Outbox: every entry carries an attempt count and the time it first queued'
);
assert(enqueueLedgerRows([]) === 1, 'Outbox: queueing nothing reports the existing queue, it does not reset it');

memoryStorage.setItem(
  OUTBOX_KEY,
  JSON.stringify([
    {
      table: 'customers',
      id: SAMPLE_CUSTOMER.id,
      row: toCustomerRow(SAMPLE_CUSTOMER),
      enqueued_at: '2026-01-01T00:00:00.000Z',
      attempts: 4
    }
  ])
);
enqueueLedgerRows([
  { table: 'customers', id: SAMPLE_CUSTOMER.id, row: toCustomerRow({ ...SAMPLE_CUSTOMER, name: 'Renamed Depot' }) }
]);
const retried = readLedgerOutbox()[0];
assert(retried.attempts === 4, 'Outbox: an edit does not reset a row\'s failure history');
assert(
  retried.enqueued_at === '2026-01-01T00:00:00.000Z',
  'Outbox: the original queue time survives a later edit'
);

let corruptCount = -1;
const corruptWarnings = captureWarnings(() => {
  memoryStorage.setItem(OUTBOX_KEY, 'not json at all');
  corruptCount = ledgerOutboxCount();
});
assert(
  corruptCount === 0 && corruptWarnings.length === 1,
  'Outbox: a corrupt payload reads as empty (with a warning), it does not throw into the app'
);
memoryStorage.setItem(OUTBOX_KEY, JSON.stringify([{ table: 'customers' }, { table: 'sales', id: 'sale-x' }]));
assert(ledgerOutboxCount() === 0, 'Outbox: entries missing an id or a row are dropped on read');

clearLedgerOutbox();
let notified: number[] = [];
const unsubscribe = subscribeLedgerOutbox(count => notified.push(count));
enqueueLedgerRows(diffLedgerRows('customers', undefined, [SAMPLE_CUSTOMER], toCustomerRow));
unsubscribe();
const afterUnsubscribe = notified.length;
enqueueLedgerRows(diffLedgerRows('customers', undefined, [{ ...SAMPLE_CUSTOMER, id: 'cust-test-3' }], toCustomerRow));
assert(notified[0] === 1, 'Outbox subscription: the header learns the new queue size');
assert(
  notified.length === afterUnsubscribe,
  'Outbox subscription: unsubscribing stops the notifications'
);
notified = [];

clearLedgerOutbox();
let refused = -1;
const refusedWarnings = captureWarnings(() => {
  memoryStorage.failWrites = true;
  refused = enqueueLedgerRows(diffLedgerRows('customers', undefined, [SAMPLE_CUSTOMER], toCustomerRow));
  memoryStorage.failWrites = false;
});
assert(refused === 0, 'Outbox: a refused storage write reports 0, so the caller does not advance its baseline');
assert(refusedWarnings.length === 1, 'Outbox: the refused write warns instead of failing silently');
assert(ledgerOutboxCount() === 0, 'Outbox: ... and the lost rows are not reported as queued');

// ---------------------------------------------------------------------------
// TEST: no client configured — "no answer" must never look like "no rows"
//
// Checked last (and asynchronously) so the summary prints after them.
// ---------------------------------------------------------------------------
void (async () => {
  assert((await isLedgerSchemaReady()) === false, 'Schema probe: reports not-ready when Supabase is not configured');
  assert(
    (await pullLedgerTable<Customer>('customers', LEDGER_PULL_COLUMNS.customers)) === null,
    'Pull: an unconfigured client returns null, never an empty array that would wipe local rows'
  );
  assert(
    (await pullLedgerTable<Sale>('sales', LEDGER_PULL_COLUMNS.sales)) === null,
    'Pull: the sales probe fails the same way, so a dead network cannot empty the ledger'
  );

  clearLedgerOutbox();
  enqueueLedgerRows(diffLedgerRows('customers', undefined, [SAMPLE_CUSTOMER], toCustomerRow));
  const flush = await flushLedgerOutbox();
  assert(
    flush.pushed === 0 && flush.remaining === 1 && flush.error === null,
    'Flush: with no client it reports the queue as untouched instead of pretending to have written it'
  );
  assert(ledgerOutboxCount() === 1, 'Flush: ... and the rows stay queued for the next session');
  clearLedgerOutbox();

  console.log('====================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================');
})();
