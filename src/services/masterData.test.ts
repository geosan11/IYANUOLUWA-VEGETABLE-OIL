/**
 * Verification suite for `masterData.ts` — the durable outbox behind the
 * Settings/Inventory writes, and the ONLY writer the pack-price matrix has.
 *
 * Same hand-rolled harness as `ledger.test.ts`: no runner, no dependencies,
 * every assertion a one-line sentence so a failure names the broken behaviour.
 *
 * The module is written against the browser's localStorage, so an in-memory
 * stand-in is installed first — including a switch that makes writes throw, to
 * prove that a full storage is reported instead of looking like a queue.
 * Supabase is deliberately NOT configured, which is itself an important case:
 * with no client, a flush must report "no answer" and leave every row queued
 * rather than treating silence as success.
 */
import {
  MASTER_CONFLICT,
  MASTER_PUSH_ORDER,
  clearMasterOutbox,
  diffPackPriceGrid,
  enqueueMasterRows,
  flushMasterOutbox,
  isPackPricesReady,
  masterKey,
  masterOutboxCount,
  packPriceDeletion,
  packPriceDraft,
  packPriceIdentity,
  readMasterOutbox,
  subscribeMasterOutbox
} from './masterData';
import type { MasterTable } from './masterData';
import type { PackPrice as PriceRow } from '../types';

// ---------------------------------------------------------------------------
// localStorage stand-in (Node has none; masterData.ts is browser code)
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
console.log('RUNNING MASTER-DATA OUTBOX (SUPABASE MIRROR) VERIFICATION');
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
 * Run a block with console.warn captured, so a deliberate failure case can be
 * asserted on (the module is supposed to complain) without dumping a stack
 * trace into the suite output.
 */
function captureWarnings<T>(run: () => T): { result: T; warnings: string[] } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    return { result: run(), warnings };
  } finally {
    console.warn = original;
  }
}

/** A 25L keg of pure soya at the agent tier — the shape the matrix stores. */
function cell(overrides: Partial<PriceRow> = {}): PriceRow {
  return {
    product_id: 'veg',
    variety_id: 'veg-soya',
    pack_size_id: 'sz_25',
    tier: 'agent',
    price: 125000,
    ...overrides
  };
}

const GRID = { product_id: 'veg', variety_ids: ['veg-soya'], pack_size_ids: ['sz_25'] };

// ---------------------------------------------------------------------------
// 1. Identity — why this could not just ride the ledger's `id`-keyed outbox
// ---------------------------------------------------------------------------
assert(
  MASTER_CONFLICT.pack_prices === 'product_id,variety_id,pack_size_id,tier',
  'pack_prices: the upsert conflict target is the whole tuple (0020 primary key)'
);
assert(
  MASTER_CONFLICT.pack_prices !== 'id' && MASTER_CONFLICT.products === 'id',
  'Every other master table is id-keyed, which is exactly why pack_prices needs its own queue'
);
assert(
  masterKey('products', { id: 'prod-1' }) === 'products:prod-1',
  'masterKey: an id-keyed row names itself by its id'
);
assert(
  masterKey('pack_prices', packPriceIdentity(cell())) === 'pack_prices:veg|veg-soya|sz_25|agent',
  'masterKey: a price cell is named by all four key columns in order'
);
assert(
  masterKey('pack_prices', packPriceIdentity(cell({ tier: 'retail' }))) !==
    masterKey('pack_prices', packPriceIdentity(cell())),
  'Two tiers of the same pack are two different cells'
);

const draft = packPriceDraft(cell());
assert(
  draft.row !== null && draft.row.price === 125000,
  'packPriceDraft: the row carries the price under its own column name'
);
assert(
  packPriceDraft(cell({ price: Number('98000') })).row?.price === 98000,
  'packPriceDraft: a price that arrived as a string is stored as a number'
);
assert(
  packPriceDeletion(cell()).row === null,
  'packPriceDeletion: a cleared cell is queued as a DELETE, not as a row with price 0'
);

// Parents before children, or every child insert is refused by its FK.
const order = (table: MasterTable) => MASTER_PUSH_ORDER.indexOf(table);
assert(order('products') < order('product_varieties'), 'Push order: products before product_varieties');
assert(order('product_varieties') < order('pack_prices'), 'Push order: varieties before the prices that reference them');
assert(order('products') < order('pack_prices'), 'Push order: products before the prices that reference them');
assert(order('hubs') < order('physical_tanks'), 'Push order: hubs before the tanks assigned to them');
assert(order('hubs') < order('pumps'), 'Push order: hubs before the pumps assigned to them');
assert(MASTER_PUSH_ORDER.length === 8, 'Push order: all eight master tables are covered');

// ---------------------------------------------------------------------------
// 2. The cleared cell — ₦0 charged vs "not priced yet"
// ---------------------------------------------------------------------------
// lookupPackPrice() returns the stored number, so a row of price 0 would be
// charged to a customer as a free pack. Clearing a price deletes the row.
const clearedDiff = diffPackPriceGrid([cell()], [], GRID);
assert(
  clearedDiff.deletions.length === 1 && clearedDiff.upserts.length === 0,
  'Cleared cell: the only row in the grid becomes a deletion when nothing is priced'
);
assert(
  clearedDiff.deletions[0].price === 125000 && clearedDiff.deletions.every(row => row.price !== 0),
  'Cleared cell: the row is removed rather than rewritten as price 0'
);

const keptDiff = diffPackPriceGrid([cell()], [cell()], GRID);
assert(
  keptDiff.deletions.length === 0 && keptDiff.upserts.length === 1,
  'Unchanged cell: saving the same price deletes nothing'
);

const newCellDiff = diffPackPriceGrid([cell()], [cell(), cell({ tier: 'retail', price: 140000 })], GRID);
assert(
  newCellDiff.upserts.length === 2 && newCellDiff.deletions.length === 0,
  'New cell: a newly priced tier is an upsert and deletes nothing'
);

// A cell outside the saved grid belongs to a different variety or pack size and
// must survive: the screen only just rewrote the grid it showed.
const outsideGrid = [
  cell({ variety_id: 'veg-blend' }),
  cell({ pack_size_id: 'sz_30' }),
  cell({ product_id: 'red' })
];
const scopedDiff = diffPackPriceGrid(outsideGrid, [], GRID);
assert(
  scopedDiff.deletions.length === 0,
  'Scope: clearing one variety/size grid leaves other varieties, sizes and products alone'
);
const otherVarietyInGrid = diffPackPriceGrid(
  [cell(), cell({ variety_id: 'veg-blend' })],
  [],
  { product_id: 'veg', variety_ids: ['veg-soya', 'veg-blend'], pack_size_ids: ['sz_25'] }
);
assert(
  otherVarietyInGrid.deletions.length === 2,
  'Scope: a grid covering two varieties clears both when nothing is priced'
);


// ---------------------------------------------------------------------------
// 3. The queue — durable, one entry per row, deletes included
// ---------------------------------------------------------------------------
clearMasterOutbox();
assert(masterOutboxCount() === 0, 'Empty: a cleared queue reports nothing queued');

const queued = enqueueMasterRows([packPriceDraft(cell())]);
assert(queued === 1, 'Enqueue: one price cell is one queued row');
assert(masterOutboxCount() === 1, 'Enqueue: the queue can be read back');

// Saving the same cell again replaces it — not two writes replaying history.
enqueueMasterRows([packPriceDraft(cell({ price: 130000 }))]);
assert(masterOutboxCount() === 1, 'Enqueue: saving the same cell twice keeps ONE queued row');
assert(
  readMasterOutbox()[0].row?.price === 130000,
  'Enqueue: the queued row carries the LATEST price, not the first one'
);

// A cleared cell supersedes the pending write of the same cell...
enqueueMasterRows([packPriceDeletion(cell())]);
assert(
  masterOutboxCount() === 1 && readMasterOutbox()[0].row === null,
  'Enqueue: clearing a cell replaces its pending write with a delete'
);
// ...and pricing it again supersedes the delete.
enqueueMasterRows([packPriceDraft(cell({ price: 90000 }))]);
assert(
  masterOutboxCount() === 1 && readMasterOutbox()[0].row?.price === 90000,
  'Enqueue: pricing a cell again replaces its pending delete'
);

// A refusal history is reset on an edit, because the edit might fix the validation error.
enqueueMasterRows([{ table: 'pumps', identity: { id: 'p-9' }, row: { id: 'p-9', label: 'Pump 9' } }]);
const withAttempts = readMasterOutbox().map(entry =>
  entry.table === 'pumps' ? { ...entry, attempts: 3 } : entry
);
memoryStorage.setItem('iyanu_master_data_outbox_v1', JSON.stringify(withAttempts));
enqueueMasterRows([{ table: 'pumps', identity: { id: 'p-9' }, row: { id: 'p-9', label: 'Pump 9B' } }]);
assert(
  readMasterOutbox().find(entry => entry.table === 'pumps')?.attempts === 0,
  'Enqueue: an edit resets a row\u2019s failure history'
);
assert(masterOutboxCount() === 2, 'Enqueue: different tables queue independently');

// A full localStorage must not look like a successful queue: the caller
// advances its change-detection baseline on a non-zero answer only.
memoryStorage.failWrites = true;
const blocked = captureWarnings(() =>
  enqueueMasterRows([{ table: 'suppliers', identity: { id: 'sup-1' }, row: { id: 'sup-1' } }])
);
memoryStorage.failWrites = false;
assert(blocked.result === 0, 'Enqueue: a blocked localStorage reports 0 rows queued, never a false success');
assert(
  blocked.warnings.some(warning => warning.includes('Could not persist')),
  'Enqueue: a blocked localStorage is reported, not swallowed'
);
assert(
  !readMasterOutbox().some(entry => entry.table === 'suppliers'),
  'Enqueue: the row that could not be persisted is not reported as queued'
);

// ---------------------------------------------------------------------------
// 4. Subscribers see the queue size change
// ---------------------------------------------------------------------------
const seen: number[] = [];
const unsubscribe = subscribeMasterOutbox(count => seen.push(count));
enqueueMasterRows([{ table: 'hubs', identity: { id: 'hub-1' }, row: { id: 'hub-1' } }]);
assert(seen.length > 0 && seen[seen.length - 1] === masterOutboxCount(), 'Subscribers: told the queue size after a write');
unsubscribe();
const seenBefore = seen.length;
enqueueMasterRows([{ table: 'hubs', identity: { id: 'hub-2' }, row: { id: 'hub-2' } }]);
assert(seen.length === seenBefore, 'Subscribers: an unsubscribed listener is not called again');

// ---------------------------------------------------------------------------
// 5. Flushing — no client means "no answer", so nothing is lost
// ---------------------------------------------------------------------------
assert(
  (await isPackPricesReady()) === false,
  'Probe: with Supabase unconfigured the price layer stays inert (no writes attempted)'
);
const before = masterOutboxCount();
const flushResult = await flushMasterOutbox();
assert(
  flushResult.pushed === 0 && flushResult.deleted === 0 && flushResult.error === null,
  'Flush: with no client, nothing is reported as written or deleted'
);
assert(
  flushResult.remaining === before && masterOutboxCount() === before,
  'Flush: with no client every queued row is still queued (silence is not success)'
);

clearMasterOutbox();
const emptyFlush = await flushMasterOutbox();
assert(
  emptyFlush.pushed === 0 && emptyFlush.remaining === 0 && emptyFlush.failedTables.length === 0,
  'Flush: an empty queue is a no-op'
);

console.log('====================================================');
console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');

