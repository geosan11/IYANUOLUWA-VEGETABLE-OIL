/**
 * Ledger sync — the transactional half of the app's Supabase layer.
 *
 * Until now only master data (hubs, app_settings, suppliers, physical_tanks,
 * pumps, products, varieties) was mirrored to Supabase; every TRANSACTIONAL
 * table (sales/orders/sale_payments, customers, tanks, payments) lived only in
 * the writing browser's localStorage, so a sale rung up on the counter phone
 * was invisible on the owner's laptop.
 *
 * Three deliberate design choices, because this is money:
 *
 * 1. PULL FIRST, NEVER BULK-PUSH. On mount we download the real rows and the
 *    database wins on id conflicts. Rows that exist only on this device
 *    (created before it ever synced) are then pushed up individually so
 *    nothing is silently dropped — the same "pull down, then push local-only"
 *    rule the hubs/suppliers sync already follows. Nothing is ever deleted
 *    remotely: the ledger is append-only, so a row this browser no longer has
 *    stays in the database as the record of what happened.
 *
 * 2. AN OUTBOX, NOT FIRE-AND-FORGET. Every change is written to a durable
 *    localStorage queue and only removed once the database confirms it. A
 *    counter with patchy network keeps working; the queue drains when the
 *    connection returns. This is why a write here can never lose a sale.
 *
 * 3. GATED ON A SCHEMA PROBE. Migrations 0019-0022 are what make `sales`,
 *    `pack_prices`, `audit_log` and `payments` exist. On a project where they
 *    haven't been applied, every queued write would fail forever, so the whole
 *    layer checks once (one cheap HEAD request) and stays completely inert —
 *    device-only, exactly as before — until those tables are there.
 */
import { supabase, isSupabaseConfigured } from './supabase';
import type { Customer, Order, Payment, Sale, Tank } from '../types';

export type LedgerTable =
  | 'customers'
  | 'tanks'
  | 'sales'
  | 'orders'
  | 'sale_payments'
  | 'payments';

/**
 * Flush order is FK order, not alphabetical: every constraint points backwards,
 * so parents must reach the database before children or the child insert is
 * rejected. `orders.sale_id` → `sales` (0019), `orders.customer_id` →
 * `customers`, `sale_payments.sale_id` → `sales` (0019), `payments.customer_id`
 * → `customers` (0022).
 */
export const LEDGER_PUSH_ORDER: LedgerTable[] = [
  'customers',
  'tanks',
  'sales',
  'orders',
  'sale_payments',
  'payments'
];

/** A row on its way to the database: which table, which id, which columns. */
export interface LedgerDraft {
  table: LedgerTable;
  id: string;
  row: Record<string, unknown>;
}

interface OutboxEntry extends LedgerDraft {
  enqueued_at: string;
  attempts: number;
}

const OUTBOX_KEY = 'iyanu_ledger_outbox_v1';

/**
 * After this many rejections a row stops being retried on every flush but is
 * NEVER dropped — money rows that the database refused stay in the queue and
 * keep being reported, so a human can look at them.
 */
const MAX_ATTEMPTS = 5;

/** id → JSON of the pushed row, per table. Used to detect what changed. */
export type LedgerSnapshot = Partial<Record<LedgerTable, Record<string, string>>>;

// ---------------------------------------------------------------------------
// Schema probe
// ---------------------------------------------------------------------------
let schemaReady: boolean | null = null;
let schemaProbe: Promise<boolean> | null = null;

/** Postgres/PostgREST ways of saying "that table isn't there". */
function isMissingTable(message: string, code?: string): boolean {
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /does not exist|not find the table|schema cache/i.test(message)
  );
}

/**
 * True once `sales` actually exists in the deployed database. Cached for the
 * session on a definitive answer; a transient failure (offline, expired token)
 * is NOT cached so the next attempt can still succeed.
 */
export function isLedgerSchemaReady(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(false);
  if (schemaReady !== null) return Promise.resolve(schemaReady);
  if (schemaProbe) return schemaProbe;

  schemaProbe = (async () => {
    const { error } = await supabase!
      .from('sales')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (!error) {
      schemaReady = true;
      return true;
    }
    if (isMissingTable(error.message ?? '', error.code)) {
      schemaReady = false;
      console.warn(
        '[ledger] The ledger tables are not in the database yet (migrations 0019-0022 unapplied). ' +
          'Sales, orders, payments and customers stay on this device until they are applied.'
      );
      return false;
    }
    console.warn('[ledger] Could not verify the ledger schema — will retry:', error.message);
    schemaProbe = null;
    return false;
  })();

  return schemaProbe;
}

// ---------------------------------------------------------------------------
// Outbox — durable queue in localStorage, drained by flushLedgerOutbox()
// ---------------------------------------------------------------------------
function outboxKey(table: LedgerTable, id: string): string {
  return `${table}:${id}`;
}

export function readLedgerOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutboxEntry =>
        !!e && typeof e.table === 'string' && typeof e.id === 'string' && !!e.row
    );
  } catch (err) {
    console.warn('[ledger] Could not read the sync outbox — starting empty.', err);
    return [];
  }
}

function writeLedgerOutbox(entries: OutboxEntry[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(OUTBOX_KEY);
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[ledger] Could not persist the sync outbox — localStorage may be full.', err);
  }
  notifyOutboxChange();
}

// ---------------------------------------------------------------------------
// Outbox notification — lets the header show what is still queued without
// polling the queue on every render.
// ---------------------------------------------------------------------------
type OutboxListener = (count: number) => void;
const outboxListeners = new Set<OutboxListener>();

/** Subscribe to the outbox size; returns the unsubscribe function. */
export function subscribeLedgerOutbox(listener: OutboxListener): () => void {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
}

function notifyOutboxChange(): void {
  const total = ledgerOutboxCount();
  outboxListeners.forEach(listener => listener(total));
}

export function ledgerOutboxCount(): number {
  return readLedgerOutbox().length;
}

/**
 * Queue rows to be written. One entry per (table, id): a second edit of the
 * same row REPLACES the first, so a row edited ten times is one write carrying
 * its latest state — not ten writes replaying history.
 */
export function enqueueLedgerRows(drafts: LedgerDraft[]): number {
  if (drafts.length === 0) return ledgerOutboxCount();
  const byKey = new Map<string, OutboxEntry>();
  for (const entry of readLedgerOutbox()) byKey.set(outboxKey(entry.table, entry.id), entry);
  const now = new Date().toISOString();
  for (const draft of drafts) {
    const key = outboxKey(draft.table, draft.id);
    const existing = byKey.get(key);
    byKey.set(key, {
      ...draft,
      enqueued_at: existing?.enqueued_at ?? now,
      // Keep the attempt count: an edit doesn't reset a row's failure history.
      attempts: existing?.attempts ?? 0
    });
  }
  const next = [...byKey.values()];
  writeLedgerOutbox(next);
  return next.length;
}

export function clearLedgerOutbox(): void {
  writeLedgerOutbox([]);
}

export interface LedgerFlushResult {
  pushed: number;
  remaining: number;
  /** Tables whose rows were refused in this flush, in the order they were tried. */
  failedTables: LedgerTable[];
  error: string | null;
}

/**
 * Drain the outbox in FK order. Stops at the first failure: a missing parent
 * row means every later insert would fail too, and hammering a down network
 * helps nobody. Successfully written rows are removed individually.
 */
export async function flushLedgerOutbox(): Promise<LedgerFlushResult> {
  const entries = readLedgerOutbox();
  if (entries.length === 0 || !supabase) {
    return { pushed: 0, remaining: entries.length, failedTables: [], error: null };
  }

  let pushed = 0;
  const settled = new Set<string>();
  const failedTables: LedgerTable[] = [];
  let error: string | null = null;

  for (const table of LEDGER_PUSH_ORDER) {
    const rows = entries.filter(e => e.table === table);
    if (rows.length === 0) continue;
    // Rows already past MAX_ATTEMPTS are reported, never retried.
    const retryable = rows.filter(r => r.attempts < MAX_ATTEMPTS);
    if (retryable.length < rows.length) failedTables.push(table);
    if (retryable.length === 0) continue;

    const { error: upsertError } = await supabase
      .from(table)
      .upsert(
        retryable.map(r => r.row),
        { onConflict: 'id' }
      );

    if (upsertError) {
      error = upsertError.message;
      failedTables.push(table);
      console.error(`[ledger] Failed to sync ${table} to the database:`, upsertError.message);
      // Bump the attempt count so a permanently-rejected row stops retrying.
      writeLedgerOutbox(
        entries.map(e =>
          e.table === table ? { ...e, attempts: e.attempts + 1 } : e
        )
      );
      break;
    }

    pushed += retryable.length;
    retryable.forEach(r => settled.add(outboxKey(r.table, r.id)));
  }

  writeLedgerOutbox(entries.filter(e => !settled.has(outboxKey(e.table, e.id))));
  return {
    pushed,
    remaining: ledgerOutboxCount(),
    failedTables: [...new Set(failedTables)],
    error
  };
}

// ---------------------------------------------------------------------------
// Change detection — a row's pushed JSON as a comparable string
// ---------------------------------------------------------------------------
export function snapshotLedgerRows(
  rows: { id: string }[],
  toRow: (row: any) => Record<string, unknown>
): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const row of rows) snapshot[row.id] = JSON.stringify(toRow(row));
  return snapshot;
}

/**
 * Rows whose mapped JSON differs from the snapshot taken after the last sync,
 * i.e. what this session actually changed. Removals are deliberately ignored:
 * a row that vanishes locally (a reset, a local-only row replaced by the
 * database's version) must not delete the database's copy of a ledger entry.
 */
export function diffLedgerRows<T extends { id: string }>(
  table: LedgerTable,
  previous: Record<string, string> | undefined,
  rows: T[],
  toRow: (row: T) => Record<string, unknown>
): LedgerDraft[] {
  const drafts: LedgerDraft[] = [];
  for (const row of rows) {
    const rowJson = JSON.stringify(toRow(row));
    if (previous?.[row.id] !== rowJson) drafts.push({ table, id: row.id, row: toRow(row) });
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------
/**
 * Download a table. Returns null (never throws, never a partial array) when the
 * read fails, so callers can tell "the database said nothing" from "the
 * database said there is nothing" — the difference between keeping local rows
 * and wiping them.
 */
export async function pullLedgerTable<T>(
  table: LedgerTable,
  columns: string,
  orderBy?: { column: string; ascending?: boolean }
): Promise<T[] | null> {
  if (!supabase) return null;
  const base = supabase.from(table).select(columns);
  const { data, error } = orderBy
    ? await base.order(orderBy.column, { ascending: orderBy.ascending ?? true })
    : await base;
  if (error) {
    console.error(`[ledger] Failed to load ${table} from the database:`, error.message);
    return null;
  }
  return (data ?? []) as T[];
}

// ---------------------------------------------------------------------------
// Mappers — app shape → table row
//
// Each mapper sends ONLY columns that exist, because PostgREST rejects the
// whole statement on one unknown column. Numeric columns are coerced with
// `num()` so a stray undefined can't become NaN and fail the insert.
// ---------------------------------------------------------------------------
const num = (value: number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Number(value.toFixed(2));

/** 0019's route into the NOT NULL legacy `rate`: per-litre equivalent of what
 *  the counter actually charged, since a pack line has no rate of its own. */
function perLitreRate(litres: number, amount: number): number {
  return litres > 0 ? round2(amount / litres) : 0;
}

export function toCustomerRow(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    credit_limit: num(c.credit_limit),
    credit_term_days: num(c.credit_term_days),
    phone: c.phone ?? '',
    hub_id: c.hub_id ?? null
  };
}

export function toTankRow(t: Tank) {
  return {
    id: t.id,
    product_id: t.product_id,
    truck_label: t.truck_label,
    tons: num(t.tons),
    received_litres: num(t.received_litres),
    remaining_litres: num(t.remaining_litres),
    date: t.date,
    shortfall: num(t.shortfall),
    supplier_id: t.supplier_id ?? null,
    space_note: t.space_note ?? null,
    physical_tank_id: t.physical_tank_id ?? null,
    supply_model: t.supply_model ?? 'bulk_truck',
    hub_id: t.hub_id ?? null
  };
}

export function toSaleRow(s: Sale) {
  return {
    id: s.id,
    customer_id: s.customer_id,
    date: s.date,
    payment_method: s.payment_method,
    payment_splits: s.payment_splits ?? null,
    amount_tendered: s.amount_tendered ?? null,
    change_due: s.change_due ?? null,
    cashier_name: s.cashier_name ?? null,
    note: s.note ?? null,
    credit_term_days: s.credit_term_days ?? null,
    due_date: s.due_date ?? null,
    voided: s.voided ?? false,
    voided_at: s.voided_at ?? null,
    voided_by: s.voided_by ?? null,
    void_reason: s.void_reason ?? null,
    hub_id: s.hub_id ?? null
  };
}

/**
 * A sale line. Two mappings are worth stating out loud:
 *
 *   `line_amount` → `amount`     the app's name for the column the database
 *                                has always called `amount` (0001), not a
 *                                second, duplicate column.
 *   `price_adjust_reason` →
 *   `discount_reason`            the legacy column 0001 required "when rate <
 *                                standard rate card" is exactly this app field,
 *                                so it is kept populated rather than orphaned.
 *
 * `unit` is deliberately null: a pack-priced line's unit IS its pack size
 * (pack_size_id + qty), and 0019 relaxed the NOT NULL constraint to allow that
 * instead of storing a fabricated 'keg'.
 */
export function toOrderRow(o: Order) {
  const amount = num(o.line_amount ?? o.amount);
  return {
    id: o.id,
    sale_id: o.sale_id,
    customer_id: o.customer_id,
    product_id: o.product_id,
    variety_id: o.variety_id,
    variety_name: o.variety_name ?? null,
    unit: null,
    pack_size_id: o.pack_size_id ?? null,
    qty: num(o.qty),
    litres: num(o.litres),
    rate: perLitreRate(num(o.litres), amount),
    unit_price: num(o.unit_price),
    original_unit_price: o.original_unit_price ?? null,
    price_adjusted: o.price_adjusted ?? false,
    price_adjust_reason: o.price_adjust_reason ?? null,
    discount_reason: o.price_adjust_reason ?? null,
    oil_amount: num(o.oil_amount),
    container_mode: o.container_mode ?? 'none',
    returnable: o.returnable ?? false,
    container_unit_price: o.container_unit_price ?? null,
    container_amount: o.container_amount ?? null,
    amount,
    paid_amount: num(o.paid_amount),
    payment_method: o.payment_method,
    payment_splits: o.payment_splits ?? null,
    pricing_tier: o.pricing_tier,
    credit_term_days: o.credit_term_days ?? null,
    due_date: o.due_date ?? null,
    date: o.date,
    source_tank_id: o.source_tank_id ?? null,
    pump_id: o.pump_id ?? null,
    voided: o.voided ?? false,
    note: o.note ?? null,
    hub_id: o.hub_id ?? null
  };
}

/**
 * Tender legs for one sale (0007's `sale_payments`, FK'd to `sales` by 0019).
 *
 * A split sale writes one leg per split; anything else writes a single leg for
 * the whole amount. Leg ids are DERIVED from the sale id and the leg index, so
 * re-pushing a sale upserts its legs instead of adding a second set of tenders.
 *
 * The credit leg is sized from the sale's total, not from what is still
 * outstanding, so a repayment arriving through `payments` months later cannot
 * mutate what the counter originally tendered — money already handed over is
 * history. There is no leg at all for a sale whose lines total zero.
 */
export function toSalePaymentLegs(s: Sale, lines: Order[]): LedgerDraft[] {
  const total = round2(lines.reduce((sum, l) => sum + num(l.line_amount ?? l.amount), 0));
  const splits = s.payment_splits ?? [];
  const legs =
    splits.length > 0
      ? splits.map(p => ({ method: String(p.method), amount: round2(num(p.amount)) }))
      : s.payment_method === 'split' || total <= 0
        ? []
        : [{ method: s.payment_method, amount: total }];

  return legs
    .filter(leg => leg.amount > 0)
    .map((leg, index) => {
      const id = `sp-${s.id}-${index}`;
      const isCredit = leg.method === 'credit';
      return {
        table: 'sale_payments' as LedgerTable,
        id,
        row: {
          id,
          sale_id: s.id,
          method: leg.method,
          amount: leg.amount,
          // Cash tendered / change given belong to the tender that took the
          // money in hand, so they ride on the first leg only.
          amount_tendered: index === 0 ? (s.amount_tendered ?? null) : null,
          change_due: index === 0 ? (s.change_due ?? null) : null,
          credit_term_days: isCredit ? (s.credit_term_days ?? null) : null,
          due_date: isCredit ? (s.due_date ?? null) : null
        }
      };
    });
}

export function toPaymentRow(p: Payment) {
  return {
    id: p.id,
    customer_id: p.customer_id,
    amount: num(p.amount),
    method: p.method,
    date: p.date,
    applied_to: p.applied_to ?? [],
    overpayment_to_credit: num(p.overpayment_to_credit),
    source: p.source ?? 'payment',
    recorded_by: p.recorded_by ?? null,
    note: p.note ?? null,
    voided: p.voided ?? false,
    voided_at: p.voided_at ?? null,
    void_reason: p.void_reason ?? null,
    hub_id: p.hub_id ?? null
  };
}

/**
 * The columns each pull asks for. Kept beside the mappers on purpose: if a
 * mapper starts sending a column, the pull must learn to read it back, and a
 * reviewer should be able to check both lists in one screen.
 */
export const LEDGER_PULL_COLUMNS: Record<LedgerTable, string> = {
  customers:
    'id, name, type, credit_limit, credit_term_days, phone, hub_id, created_at, updated_at',
  tanks:
    'id, product_id, truck_label, tons, received_litres, remaining_litres, date, shortfall, ' +
    'supplier_id, space_note, physical_tank_id, supply_model, hub_id, created_at, updated_at',
  sales:
    'id, customer_id, date, payment_method, payment_splits, amount_tendered, change_due, ' +
    'cashier_name, note, credit_term_days, due_date, voided, voided_at, voided_by, void_reason, ' +
    'hub_id, created_at, updated_at',
  orders:
    'id, sale_id, customer_id, product_id, variety_id, variety_name, pack_size_id, qty, litres, ' +
    'unit_price, original_unit_price, price_adjusted, price_adjust_reason, oil_amount, ' +
    'container_mode, returnable, container_unit_price, container_amount, amount, paid_amount, ' +
    'payment_method, payment_splits, pricing_tier, credit_term_days, due_date, date, ' +
    'source_tank_id, pump_id, voided, note, hub_id, created_at, updated_at',
  sale_payments:
    'id, sale_id, method, amount, amount_tendered, change_due, credit_term_days, due_date, ' +
    'created_at, updated_at',
  payments:
    'id, customer_id, amount, method, date, applied_to, overpayment_to_credit, source, ' +
    'recorded_by, note, voided, voided_at, void_reason, hub_id, created_at, updated_at'
};
