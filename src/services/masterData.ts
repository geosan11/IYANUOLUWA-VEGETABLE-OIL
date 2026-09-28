/**
 * Master-data sync — the durable half of the Settings/Inventory writes.
 *
 * `ledger.ts` covers the transactional tables (sales, orders, payments,
 * customers, stock intakes). Everything the Settings and Inventory screens own —
 * hubs, app_settings, suppliers, physical_tanks, pumps, products,
 * product_varieties and the pack-price matrix — was written with a bare
 * `.insert()` / `.update()` whose only failure handling was a console line and,
 * at best, a toast that appeared once per reload. Two consequences:
 *
 *   1. `pack_prices` had no writer at all. `bulkSetPackPrices` wrote
 *      localStorage, so two devices showed the same products at different
 *      prices, and a reinstall lost every price the depot had set.
 *   2. A change made with no signal was simply lost. Nothing queued it.
 *
 * This module gives that half of the app the same guarantee the ledger has:
 * every change is written to a durable localStorage outbox and only removed
 * once the database confirms it, so a counter with patchy network keeps
 * working and the queue drains when the connection returns.
 *
 * Deliberately separate from `ledger.ts` rather than a shared queue, because
 * the two have different identities: every ledger table is keyed by `id`, while
 * `pack_prices` is keyed by the whole (product, variety, pack size, tier) tuple
 * and has no `id` column at all. It also has to support DELETE, which the
 * append-only ledger never does.
 */
import { supabase, isSupabaseConfigured } from './supabase';
import type { PackPrice } from '../types';

export type MasterTable =
  | 'hubs'
  | 'app_settings'
  | 'suppliers'
  | 'physical_tanks'
  | 'pumps'
  | 'products'
  | 'product_varieties'
  | 'pack_prices';

/**
 * FK order, not alphabetical: every constraint points backwards, so a parent
 * row must reach the database before its children, or the child insert is
 * refused. `product_varieties.product_id` → `products`, `pack_prices.product_id`
 * → `products` and `pack_prices.variety_id` → `product_varieties` (0020),
 * `physical_tanks.product_id` → `products`, `pumps.product_id` → `products`.
 */
export const MASTER_PUSH_ORDER: MasterTable[] = [
  'hubs',
  'app_settings',
  'products',
  'product_varieties',
  'pack_prices',
  'physical_tanks',
  'pumps',
  'suppliers'
];

/**
 * The conflict target each table's upsert is keyed on — the table's own PRIMARY
 * KEY, read from the migrations. `pack_prices` is the one that cannot use `id`.
 */
export const MASTER_CONFLICT: Record<MasterTable, string> = {
  hubs: 'id',
  app_settings: 'id',
  suppliers: 'id',
  physical_tanks: 'id',
  pumps: 'id',
  products: 'id',
  product_varieties: 'id',
  pack_prices: 'product_id,variety_id,pack_size_id,tier'
};

/** A row on its way to the database: which table, which row, which columns. */
export interface MasterDraft {
  table: MasterTable;
  /**
   * The primary-key columns and their values, as a plain object — enough to
   * find the row again for a delete. `{ id: 'pt-1' }`, or a price cell's whole
   * tuple.
   */
  identity: Record<string, string>;
  /** The columns to write, or null to delete the row. */
  row: Record<string, unknown> | null;
}

interface OutboxEntry extends MasterDraft {
  enqueued_at: string;
  attempts: number;
}

const OUTBOX_KEY = 'iyanu_master_data_outbox_v1';

/**
 * After this many rejections a row stops being retried on every flush but is
 * NEVER dropped — a row the database refused stays queued and is reported, so a
 * human can look at it. Same rule as the ledger.
 */
const MAX_ATTEMPTS = 5;

/** A stable string for a row's identity, used as the outbox key. */
export function masterKey(table: MasterTable, identity: Record<string, string>): string {
  return `${table}:${MASTER_CONFLICT[table]
    .split(',')
    .map(column => identity[column] ?? '')
    .join('|')}`;
}

/** One price cell's identity: the whole primary key of `pack_prices`. */
export function packPriceIdentity(price: Pick<PackPrice, 'product_id' | 'variety_id' | 'pack_size_id' | 'tier'>): Record<string, string> {
  return {
    product_id: price.product_id,
    variety_id: price.variety_id,
    pack_size_id: price.pack_size_id,
    tier: price.tier
  };
}

export function packPriceDraft(price: PackPrice): MasterDraft {
  return {
    table: 'pack_prices',
    identity: packPriceIdentity(price),
    row: {
      ...packPriceIdentity(price),
      price: Number(price.price)
    }
  };
}

/** A deleted cell: the row is gone rather than set to 0. See diffPackPriceGrid. */
export function packPriceDeletion(price: PackPrice): MasterDraft {
  return { table: 'pack_prices', identity: packPriceIdentity(price), row: null };
}

/** The grid a screen just saved: which product, which varieties, which sizes. */
export interface PackPriceGrid {
  product_id: string;
  variety_ids: string[];
  pack_size_ids: string[];
}

export interface PackPriceGridDiff {
  upserts: PackPrice[];
  /** Cells that had a price and no longer do — deleted, never set to 0. */
  deletions: PackPrice[];
}

/**
 * A blank price cell means "not priced yet", not "free". `lookupPackPrice`
 * returns null for a cell with no row and would return ₦0 for a stored row of
 * price 0, so writing 0 on a blanked cell would make the counter give that pack
 * away. Clearing a price therefore DELETES the row (`pack_prices.price` allows
 * 0, which is exactly why this is a client-side decision rather than a
 * constraint that could catch it).
 *
 * The Inventory screen sends only the cells that carry a price, so it cannot
 * say which cells *stopped* carrying one. That is what the saved grid is for:
 * the rows just written are the complete priced set for this product's
 * varieties and pack sizes, so anything else in that grid is a cleared cell.
 */
export function diffPackPriceGrid(
  existing: PackPrice[],
  rows: PackPrice[],
  grid: PackPriceGrid
): PackPriceGridDiff {
  const priced = new Set(rows.map(row => masterKey('pack_prices', packPriceIdentity(row))));
  const varieties = new Set(grid.variety_ids);
  const sizes = new Set(grid.pack_size_ids);
  const deletions = existing.filter(
    row =>
      row.product_id === grid.product_id &&
      varieties.has(row.variety_id) &&
      sizes.has(row.pack_size_id) &&
      !priced.has(masterKey('pack_prices', packPriceIdentity(row)))
  );
  return { upserts: rows, deletions };
}

// ---------------------------------------------------------------------------
// Outbox — durable queue in localStorage, drained by flushMasterOutbox()
// ---------------------------------------------------------------------------
export function readMasterOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutboxEntry =>
        !!e && typeof e.table === 'string' && !!e.identity && typeof e.identity === 'object'
    );
  } catch (err) {
    console.warn('[masterData] Could not read the sync outbox — starting empty.', err);
    return [];
  }
}

function writeMasterOutbox(entries: OutboxEntry[]): boolean {
  let persisted = false;
  try {
    if (entries.length === 0) localStorage.removeItem(OUTBOX_KEY);
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
    persisted = true;
  } catch (err) {
    console.warn('[masterData] Could not persist the sync outbox — localStorage may be full.', err);
  }
  notifyOutboxChange();
  return persisted;
}

type OutboxListener = (count: number) => void;
const outboxListeners = new Set<OutboxListener>();

/** Subscribe to the outbox size; returns the unsubscribe function. */
export function subscribeMasterOutbox(listener: OutboxListener): () => void {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
}

function notifyOutboxChange(): void {
  const total = masterOutboxCount();
  outboxListeners.forEach(listener => listener(total));
}

export function masterOutboxCount(): number {
  return readMasterOutbox().length;
}

/**
 * Queue rows to be written. One entry per (table, identity): a second change to
 * the same row REPLACES the first, so a row edited ten times is one write
 * carrying its latest state. A delete replaces a pending upsert of the same row
 * and vice versa.
 *
 * Returns the size of the queue, or **0 when the write itself failed** — a full
 * or blocked localStorage must not look like a successful queue.
 */
export function enqueueMasterRows(drafts: MasterDraft[]): number {
  if (drafts.length === 0) return masterOutboxCount();
  const byKey = new Map<string, OutboxEntry>();
  for (const entry of readMasterOutbox()) byKey.set(masterKey(entry.table, entry.identity), entry);
  const now = new Date().toISOString();
  for (const draft of drafts) {
    const key = masterKey(draft.table, draft.identity);
    const existing = byKey.get(key);
    byKey.set(key, {
      ...draft,
      enqueued_at: existing?.enqueued_at ?? now,
      // Keep the attempt count: an edit doesn't reset a row's failure history.
      attempts: existing?.attempts ?? 0
    });
  }
  const next = [...byKey.values()];
  return writeMasterOutbox(next) ? next.length : 0;
}

export function clearMasterOutbox(): void {
  writeMasterOutbox([]);
}



// ---------------------------------------------------------------------------
// Schema probe — inert on a project where 0020 hasn't been applied
// ---------------------------------------------------------------------------
let packPricesReady: boolean | null = null;
let packPricesProbe: Promise<boolean> | null = null;

/**
 * True once `pack_prices` exists in the deployed database. Cached on a
 * definitive answer; a transient failure (offline, expired token) is NOT
 * cached, so the next attempt can still succeed — the same rule the ledger's
 * probe follows. Without this, a project that never applied 0020 would queue
 * price writes that fail forever.
 */
export function isPackPricesReady(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(false);
  if (packPricesReady !== null) return Promise.resolve(packPricesReady);
  if (packPricesProbe) return packPricesProbe;

  packPricesProbe = (async () => {
    const { error } = await supabase!
      .from('pack_prices')
      .select('product_id', { head: true, count: 'exact' })
      .limit(1);
    if (!error) {
      packPricesReady = true;
      return true;
    }
    if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|not find the table|schema cache/i.test(error.message ?? '')) {
      packPricesReady = false;
      console.warn(
        '[masterData] The pack_prices table is not in the database yet (migration 0020 unapplied). ' +
          'Prices stay on this device until it is applied.'
      );
      return false;
    }
    console.warn('[masterData] Could not verify the pack_prices table — will retry:', error.message);
    packPricesProbe = null;
    return false;
  })();

  return packPricesProbe;
}

// ---------------------------------------------------------------------------
// Flush — drain the queue in FK order
// ---------------------------------------------------------------------------
export interface MasterFlushResult {
  pushed: number;
  deleted: number;
  remaining: number;
  /** Tables whose rows were refused in this flush, in the order they were tried. */
  failedTables: MasterTable[];
  error: string | null;
}

/**
 * Drain the outbox in FK order. Stops at the first failure: a missing parent
 * row means every later write would fail too, and hammering a down network
 * helps nobody. Successfully written rows are removed individually, so a
 * partial flush keeps the rest queued.
 */
export async function flushMasterOutbox(): Promise<MasterFlushResult> {
  const entries = readMasterOutbox();
  if (entries.length === 0 || !supabase) {
    return { pushed: 0, deleted: 0, remaining: entries.length, failedTables: [], error: null };
  }

  let pushed = 0;
  let deleted = 0;
  const settled = new Set<string>();
  const failedTables: MasterTable[] = [];
  let error: string | null = null;

  for (const table of MASTER_PUSH_ORDER) {
    const rows = entries.filter(e => e.table === table);
    if (rows.length === 0) continue;
    // Rows already past MAX_ATTEMPTS are reported, never retried.
    const retryable = rows.filter(r => r.attempts < MAX_ATTEMPTS);
    if (retryable.length < rows.length) failedTables.push(table);
    if (retryable.length === 0) continue;

    const upserts = retryable.filter(r => r.row !== null);
    const deletes = retryable.filter(r => r.row === null);

    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from(table)
        .upsert(
          upserts.map(r => r.row as Record<string, unknown>),
          { onConflict: MASTER_CONFLICT[table] }
        );
      if (upsertError) {
        error = upsertError.message;
        failedTables.push(table);
        console.error(`[masterData] Failed to sync ${table} to the database:`, upsertError.message);
        writeMasterOutbox(entries.map(e => (e.table === table ? { ...e, attempts: e.attempts + 1 } : e)));
        break;
      }
      pushed += upserts.length;
      upserts.forEach(r => settled.add(masterKey(r.table, r.identity)));
    }

    // Deletes go one row at a time: a composite key needs its own filter chain.
    let deleteFailure: string | null = null;
    for (const entry of deletes) {
      let query = supabase.from(table).delete();
      for (const [column, value] of Object.entries(entry.identity)) {
        query = query.eq(column, value) as typeof query;
      }
      const { error: deleteError } = await query;
      if (deleteError) {
        deleteFailure = deleteError.message;
        break;
      }
      deleted++;
      settled.add(masterKey(entry.table, entry.identity));
    }
    if (deleteFailure) {
      error = deleteFailure;
      failedTables.push(table);
      console.error(`[masterData] Failed to delete from ${table} in the database:`, deleteFailure);
      writeMasterOutbox(entries.map(e => (e.table === table ? { ...e, attempts: e.attempts + 1 } : e)));
      break;
    }
  }

  writeMasterOutbox(entries.filter(e => !settled.has(masterKey(e.table, e.identity))));
  return {
    pushed,
    deleted,
    remaining: masterOutboxCount(),
    failedTables: [...new Set(failedTables)],
    error
  };
}
