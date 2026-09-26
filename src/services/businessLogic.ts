import {
  Customer,
  Order,
  KegReturn,
  Transfer,
  CustomerCredit,
  Payment,
  Tank,
  CustomerCalculatedStats,
  CustomerStatementRow,
  KegInventorySummary,
  PumpVarianceAudit,
  TankDrawResult,
  PaymentApplicationResult,
  UnitType,
  Pump,
  PumpReading,
  Product,
  Shift,
  Sale,
  AppSettings
} from '../types';
import { packLitres } from '../constants/config';

export { packLitres };

/**
 * 1. UNIT CONVERSION
 * litres = unit === 'ton' ? qty * litresPerTon : unit === 'keg' ? qty * litresPerKeg : qty
 *
 * Both figures are supplied by the caller (see the resolvers below). There is
 * deliberately no built-in fallback: 0 means "not configured" and yields 0,
 * which the screens check for and refuse to record rather than guessing.
 */
export function calculateLitres(
  unit: UnitType,
  qty: number,
  litresPerKeg = 0,
  litresPerTon: number | null = null
): number {
  const numericQty = Number(qty) || 0;
  if (unit === 'ton') return numericQty * configuredNumber(litresPerTon);
  if (unit === 'keg') return numericQty * configuredNumber(litresPerKeg);
  return numericQty;
}

/**
 * 1b. DENSITY / KEG-SIZE RESOLUTION
 * The single place that decides which figure the depot is actually using:
 *
 *   the depot-wide setting  →  the product's own value  →  0 (not configured)
 *
 * The depot figure in Settings is the depot's declared standard, so it wins
 * whenever the owner has actually set one; a product's own figure applies only
 * while that depot field is blank. A blank/0 everywhere still means "the owner
 * hasn't told us yet" — callers must check for it and ask for it, never compute
 * with an invented value.
 */
export function resolveLitresPerTon(
  product: Pick<Product, 'litres_per_ton'> | null | undefined,
  settings?: Pick<AppSettings, 'default_litres_per_ton'> | null
): number {
  return configuredNumber(settings?.default_litres_per_ton) || configuredNumber(product?.litres_per_ton);
}

export function resolveLitresPerKeg(
  product: Pick<Product, 'litres_per_keg'> | null | undefined,
  settings?: Pick<AppSettings, 'litres_per_keg'> | null
): number {
  return configuredNumber(settings?.litres_per_keg) || configuredNumber(product?.litres_per_keg);
}

/**
 * A finite value > 0, else 0. The app-wide "is this configured?" test — used
 * for densities, keg sizes, capacities and variance tolerances alike, so that
 * a 0 in Settings reads as "not set yet" instead of a real magnitude.
 */
export function configuredNumber(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 2. TRUCK INTAKE METRICS (bulk_truck only)
 * expected_litres = tons * litresPerTon      (depot density, else the product's own)
 * expected_kegs   = expected_litres / litresPerKeg
 * recovered       = (actual_kegs_filled * litresPerKeg) + leftover_litres_recovered
 * shortfall       = expected_litres - recovered
 * isShortfallHigh = shortfall > thresholdLitres, and only once a tolerance has
 *                   actually been configured (0 = no tolerance → never flag)
 */
export interface IntakeMetrics {
  expectedLitres: number;
  expectedKegs: number;
  recoveredLitres: number;
  shortfall: number;
  isShortfallHigh: boolean; // shortfall > thresholdLitres
  exceedsDepotKegCapacity: boolean;
}

export function calculateIntakeMetrics(
  tons: number,
  litresPerTon: number,
  actualKegsFilled: number,
  leftoverLitresRecovered: number,
  kegsAtDepot: number,
  litresPerKeg = 0,
  thresholdLitres = 0
): IntakeMetrics {
  const numTons = Number(tons) || 0;
  const numActualKegs = Number(actualKegsFilled) || 0;
  const numLeftovers = Number(leftoverLitresRecovered) || 0;
  const perTon = configuredNumber(litresPerTon);
  const perKeg = configuredNumber(litresPerKeg);

  const expectedLitres = numTons * perTon;
  // Guarded: an unconfigured keg size must never divide (that yielded
  // Infinity before the seeds were removed).
  const expectedKegs = expectedLitres > 0 && perKeg > 0 ? expectedLitres / perKeg : 0;
  const recoveredLitres = (numActualKegs * perKeg) + numLeftovers;
  const shortfall = expectedLitres - recoveredLitres;
  const threshold = configuredNumber(thresholdLitres);

  return {
    expectedLitres: Number(expectedLitres.toFixed(2)),
    expectedKegs: Number(expectedKegs.toFixed(1)),
    recoveredLitres: Number(recoveredLitres.toFixed(2)),
    shortfall: Number(shortfall.toFixed(2)),
    isShortfallHigh: threshold > 0 && shortfall > threshold,
    exceedsDepotKegCapacity: expectedKegs > kegsAtDepot
  };
}

/**
 * 2b. PRE-KEGGED INTAKE METRICS (palm oil)
 * litres = kegs_received * product.litres_per_keg — EXACT, not estimated.
 * No shortfall, variance, or tons involved.
 */
export interface PreKeggedIntakeMetrics {
  exactLitres: number;
  kegsReceived: number;
}

export function calculatePreKeggedIntakeMetrics(
  kegsReceived: number,
  litresPerKeg: number
): PreKeggedIntakeMetrics {
  const kegs = Math.max(0, Number(kegsReceived) || 0);
  const exactLitres = Number((kegs * configuredNumber(litresPerKeg)).toFixed(2));
  return {
    exactLitres,
    kegsReceived: kegs
  };
}

/**
 * 8. PACK-SIZE PRICING lives in `src/services/pricing.ts`
 * (`lookupPackPrice` / `priceSaleLine`). The old per-litre `lookupRatePerLitre`
 * and `calculateOrderPricing` have been removed — sales are priced per pack.
 */

/**
 * 5. CREDIT BALANCE & AGING COMPUTATION
 * balance = sum(amount - paid_amount) over open credit orders
 * Aging badge per customer = max(today - due_date) across open credit orders:
 *   > 0 days → "Overdue Xd" (red)
 *   0 to -3 days → "Due in Xd" (amber)
 *   else → "Current" (green)
 */
export function calculateCustomerStats(
  customer: Customer,
  orders: Order[],
  kegReturns: KegReturn[],
  transfersOrRefDate: Transfer[] | Date = [],
  referenceDate: Date = new Date(),
  credits: CustomerCredit[] = []
): CustomerCalculatedStats {
  let transfers: Transfer[] = [];
  let refDate = referenceDate;

  if (transfersOrRefDate instanceof Date) {
    refDate = transfersOrRefDate;
    transfers = [];
  } else if (Array.isArray(transfersOrRefDate)) {
    transfers = transfersOrRefDate;
  }

  const customerOrders = orders.filter(o => o.customer_id === customer.id && !o.voided);

  // Store credit the depot owes this customer (overpayments, minus what has been redeemed).
  const creditBalance = Math.max(
    0,
    credits
      .filter(c => c.customer_id === customer.id)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0)
  );

  
  // Open credit orders where amount > paid_amount and payment_method is credit or split with unpaid balance
  const openOrders = customerOrders.filter(
    o => (o.payment_method === 'credit' || o.payment_method === 'split') && (o.amount - (o.paid_amount || 0)) > 0.01
  );

  const currentBalance = openOrders.reduce(
    (sum, o) => sum + (o.amount - (o.paid_amount || 0)),
    0
  );

  // Returnable containers out on loan, tracked per (product, pack size).
  //   taken lines (+qty) - matching returns (-qty) - transfers out (+/-)
  const kegsOutByPack: Record<string, number> = {};
  const bump = (productId: string | undefined | null, packSizeId: string | undefined | null, delta: number) => {
    const key = `${productId || 'unknown'}|${packSizeId || 'unknown'}`;
    kegsOutByPack[key] = (kegsOutByPack[key] || 0) + delta;
  };

  for (const o of customerOrders) {
    if (o.container_mode === 'taken') bump(o.product_id, o.pack_size_id, Number(o.qty || 0));
  }
  for (const r of kegReturns) {
    if (r.customer_id === customer.id) bump(r.product_id, r.pack_size_id, -Number(r.qty || 0));
  }
  for (const t of transfers) {
    if (t.item_type !== 'keg') continue;
    if (t.from_customer_id === customer.id) bump(t.product_id, t.pack_size_id, -Number(t.qty || 0));
    if (t.to_customer_id === customer.id) bump(t.product_id, t.pack_size_id, Number(t.qty || 0));
  }

  // Clamp each bucket at zero and total up.
  let totalCompanyKegsOut = 0;
  for (const key of Object.keys(kegsOutByPack)) {
    const clamped = Math.max(0, kegsOutByPack[key]);
    kegsOutByPack[key] = clamped;
    totalCompanyKegsOut += clamped;
  }

  // Compute Aging
  let worstOverdueDays = -Infinity; // Days past due (positive = overdue, negative = days remaining)

  if (openOrders.length === 0) {
    worstOverdueDays = -999; // Clean
  } else {
    for (const ord of openOrders) {
      if (!ord.due_date) continue;
      const dueDate = new Date(ord.due_date);
      // diff in days = (today - dueDate)
      const diffMs = refDate.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > worstOverdueDays) {
        worstOverdueDays = diffDays;
      }
    }
  }

  let status: 'overdue' | 'due_soon' | 'current' = 'current';
  let label = 'Current';
  let colorClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  let days = 0;

  if (openOrders.length > 0 && worstOverdueDays !== -Infinity) {
    if (worstOverdueDays > 0) {
      // Overdue
      status = 'overdue';
      days = worstOverdueDays;
      label = `Overdue ${days}d`;
      colorClass = 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse-glow';
    } else if (worstOverdueDays >= -3 && worstOverdueDays <= 0) {
      // Due in 0 to 3 days
      status = 'due_soon';
      days = Math.abs(worstOverdueDays);
      label = days === 0 ? 'Due Today' : `Due in ${days}d`;
      colorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    } else {
      status = 'current';
      label = 'Current';
      colorClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  }

  return {
    customer,
    currentBalance: Number(currentBalance.toFixed(2)),
    creditBalance: Number(creditBalance.toFixed(2)),
    totalCompanyKegsOut,
    kegsOutByPack,
    agingBadge: {
      status,
      label,
      days,
      colorClass
    },
    openOrders: openOrders.sort((a, b) => {
      const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
      return dateA - dateB; // Oldest due first
    })
  };
}

/**
 * 5b. CUSTOMER RUNNING STATEMENT
 * A dated debit/credit ledger for one customer: credit sales add to what they
 * owe, payments reduce it, and a running company-container count is carried
 * alongside. Voided sales/payments are excluded.
 */
export function buildCustomerStatement(
  customer: Customer,
  orders: Order[],
  payments: Payment[],
  credits: CustomerCredit[],
  kegReturns: KegReturn[]
): CustomerStatementRow[] {
  type Event =
    | { t: number; date: string; kind: 'sale'; saleId: string }
    | { t: number; date: string; kind: 'payment'; payment: Payment }
    | { t: number; date: string; kind: 'credit_note'; amount: number; note: string }
    | { t: number; date: string; kind: 'keg_return'; qty: number };

  const ms = (d: string) => new Date(d).getTime();
  const round2 = (n: number) => Number((n || 0).toFixed(2));
  const events: Event[] = [];

  // Group this customer's non-voided lines by sale.
  const saleGroups = new Map<string, Order[]>();
  for (const o of orders) {
    if (o.customer_id !== customer.id || o.voided) continue;
    const arr = saleGroups.get(o.sale_id) || [];
    arr.push(o);
    saleGroups.set(o.sale_id, arr);
  }
  for (const [saleId, lines] of saleGroups) {
    events.push({ t: ms(lines[0].date), date: lines[0].date, kind: 'sale', saleId });
  }

  for (const p of payments) {
    if (p.customer_id !== customer.id || p.voided) continue;
    events.push({ t: ms(p.date), date: p.date, kind: 'payment', payment: p });
  }

  for (const c of credits) {
    if (c.customer_id !== customer.id) continue;
    if (c.amount > 0) {
      events.push({
        t: ms(c.created_at),
        date: c.created_at,
        kind: 'credit_note',
        amount: c.amount,
        note: c.note || 'Store credit added'
      });
    }
  }

  for (const r of kegReturns) {
    if (r.customer_id !== customer.id) continue;
    events.push({ t: ms(r.date), date: r.date, kind: 'keg_return', qty: Number(r.qty || 0) });
  }

  events.sort((a, b) => a.t - b.t);

  const rows: CustomerStatementRow[] = [];
  let balance = 0;
  let kegBalance = 0;

  for (const ev of events) {
    if (ev.kind === 'sale') {
      const lines = saleGroups.get(ev.saleId) || [];
      const total = round2(lines.reduce((s, l) => s + l.line_amount, 0));
      const paid = round2(lines.reduce((s, l) => s + (l.paid_amount || 0), 0));
      const isCredit = lines[0].payment_method === 'credit' || (lines[0].payment_method === 'split' && (total - paid) > 0.01);
      const kegsTaken = lines.reduce((s, l) => s + (l.container_mode === 'taken' ? Number(l.qty || 0) : 0), 0);
      kegBalance += kegsTaken;
      if (isCredit) balance = round2(balance + (total - paid));
      const paidStatus: CustomerStatementRow['paidStatus'] =
        paid >= total - 0.01 ? 'paid' : paid > 0.01 ? 'part' : 'unpaid';
      const kegNote = kegsTaken > 0 ? ` · ${kegsTaken} keg(s) taken` : '';
      const modeLabel = lines[0].payment_method === 'split' ? 'split' : isCredit ? 'credit' : lines[0].payment_method;
      rows.push({
        date: ev.date,
        kind: 'sale',
        label: `${lines.length} item${lines.length === 1 ? '' : 's'} (${modeLabel})${kegNote}`,
        debit: isCredit ? round2(total - paid) : 0,
        credit: 0,
        runningBalance: balance,
        paidStatus: isCredit ? paidStatus : 'paid',
        kegBalance
      });
    } else if (ev.kind === 'payment') {
      const applied = round2(ev.payment.amount - ev.payment.overpayment_to_credit);
      balance = round2(Math.max(0, balance - applied));
      rows.push({
        date: ev.date,
        kind: 'payment',
        label: ev.payment.source === 'credit_redeem' ? 'Store credit applied' : `Payment (${ev.payment.method})`,
        debit: 0,
        credit: applied,
        runningBalance: balance,
        kegBalance,
        note: ev.payment.overpayment_to_credit > 0 ? `+${ev.payment.overpayment_to_credit.toFixed(2)} to store credit` : undefined
      });
    } else if (ev.kind === 'credit_note') {
      rows.push({
        date: ev.date,
        kind: 'credit_note',
        label: ev.note,
        debit: 0,
        credit: 0,
        runningBalance: balance,
        kegBalance,
        note: `Store credit ${ev.amount > 0 ? '+' : ''}${ev.amount.toFixed(2)}`
      });
    } else {
      kegBalance = Math.max(0, kegBalance - ev.qty);
      rows.push({
        date: ev.date,
        kind: 'keg_return',
        label: `${ev.qty} keg(s) returned`,
        debit: 0,
        credit: 0,
        runningBalance: balance,
        kegBalance
      });
    }
  }

  return rows.reverse(); // newest first for display
}

/**
 * 6. KEG INVENTORY SUMMARY
 * kegs_out (per customer) = sum(orders where keg_source='company', qty) - sum(keg_returns.qty)
 * total_kegs_out = sum across all customers
 * kegs_at_depot = total_company_kegs - total_kegs_out
 * flag red if kegs_at_depot < criticalThreshold (default 20)
 */
export function calculateKegInventory(
  totalCompanyKegs: number,
  orders: Order[],
  kegReturns: KegReturn[],
  criticalThreshold = 20
): KegInventorySummary {
  // Company loan obligations: containers loaned to customers that are expected back
  const totalCompanySupplied = orders
    .filter(o => !o.voided && o.container_mode === 'taken')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  // Outright purchased containers: permanently sold to customer (no return obligation)
  const totalPurchased = orders
    .filter(o => !o.voided && o.container_mode === 'bought')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  const totalReturned = kegReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);

  const totalKegsOut = Math.max(0, totalCompanySupplied - totalReturned);
  // Physical stock in depot is reduced by both loaned kegs and outright purchased kegs
  const kegsAtDepot = Math.max(0, totalCompanyKegs - totalKegsOut - totalPurchased);

  return {
    totalCompanyKegs,
    totalKegsOut,
    kegsAtDepot,
    isDepotStockCritical: kegsAtDepot < criticalThreshold
  };
}

/**
 * 3. FIFO TANK DRAW (on every order)
 * Draw from oldest tank (by date) for that product first.
 * If not enough, drain to zero and pull remainder from next oldest.
 * If total remaining across all tanks < required litres -> reject order.
 */
export function executeFifoTankDraw(
  tanks: Tank[],
  productId: string,
  requiredLitres: number
): TankDrawResult {
  const productTanks = tanks
    .filter(t => t.product_id === productId && t.remaining_litres > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Oldest first

  const totalAvailable = productTanks.reduce((sum, t) => sum + t.remaining_litres, 0);

  if (totalAvailable < requiredLitres - 0.001) {
    return {
      success: false,
      allocations: [],
      primaryTankId: null,
      updatedTanks: tanks,
      errorMessage: `Insufficient stock! Total remaining across active tanks is ${totalAvailable.toFixed(1)}L, but ${requiredLitres.toFixed(1)}L is required.`
    };
  }

  let needed = requiredLitres;
  const allocations: { tankId: string; truckLabel: string; drawnLitres: number; remainingAfterDraw: number }[] = [];
  const updatedTanks = tanks.map(t => ({ ...t }));

  for (const pTank of productTanks) {
    if (needed <= 0) break;

    const tankIndex = updatedTanks.findIndex(t => t.id === pTank.id);
    if (tankIndex === -1) continue;

    const currentTank = updatedTanks[tankIndex];
    const available = currentTank.remaining_litres;
    const toDraw = Math.min(needed, available);
    const newRemaining = Math.max(0, available - toDraw);

    currentTank.remaining_litres = Number(newRemaining.toFixed(2));
    needed -= toDraw;

    allocations.push({
      tankId: currentTank.id,
      truckLabel: currentTank.truck_label,
      drawnLitres: Number(toDraw.toFixed(2)),
      remainingAfterDraw: Number(newRemaining.toFixed(2))
    });
  }

  return {
    success: true,
    allocations,
    primaryTankId: allocations[0]?.tankId || null,
    updatedTanks
  };
}

/**
 * 7. FIFO PAYMENT APPLICATION
 * Apply payment to customer's open credit orders OLDEST due_date first,
 * incrementing paid_amount on each until exhausted.
 * Return any leftover unapplied amount.
 */
export function applyFifoPayment(
  allOrders: Order[],
  customerId: string,
  paymentAmount: number
): PaymentApplicationResult {
  let remainingPayment = Number(paymentAmount) || 0;
  const appliedOrders: PaymentApplicationResult['appliedOrders'] = [];
  
  // Clone orders
  const updatedOrders = allOrders.map(o => ({ ...o }));

  // Get this customer's open credit orders sorted by due_date ascending (oldest due first)
  const customerCreditOrders = updatedOrders
    .filter(o => o.customer_id === customerId && !o.voided && (o.payment_method === 'credit' || o.payment_method === 'split') && (o.amount - (o.paid_amount || 0)) > 0.001)
    .sort((a, b) => {
      const timeA = a.due_date ? new Date(a.due_date).getTime() : new Date(a.date).getTime();
      const timeB = b.due_date ? new Date(b.due_date).getTime() : new Date(b.date).getTime();
      return timeA - timeB;
    });

  for (const order of customerCreditOrders) {
    if (remainingPayment <= 0) break;

    const outstanding = order.amount - (order.paid_amount || 0);
    const toApply = Math.min(remainingPayment, outstanding);
    const previousPaid = order.paid_amount || 0;
    const newPaid = Number((previousPaid + toApply).toFixed(2));
    const isFullyPaid = newPaid >= order.amount - 0.01;

    order.paid_amount = newPaid;
    remainingPayment = Number((remainingPayment - toApply).toFixed(2));

    appliedOrders.push({
      orderId: order.id,
      originalAmount: order.amount,
      previousPaid,
      amountApplied: Number(toApply.toFixed(2)),
      newPaidAmount: newPaid,
      isFullyPaid
    });
  }

  const totalApplied = Number(((Number(paymentAmount) || 0) - remainingPayment).toFixed(2));

  return {
    appliedOrders,
    totalApplied,
    unappliedLeftover: remainingPayment,
    updatedOrders
  };
}

/**
 * 9. PUMP METER VARIANCE RECONCILIATION — per depot day, per pump.
 * Each pump's meter only counts up (like an odometer, never resets). Readings
 * are bucketed into depot-local calendar days; for each day that closes with
 * a reading:
 *   meterDelta = (day's last reading) - (last known reading before that day)
 *   expectedLitres = sum of litres sold that day, attributed to this pump
 *   variance = meterDelta - expectedLitres
 * Sales made after pump selection shipped carry their own `pump_id` and are
 * matched exactly. Older sales recorded before that (or made against a hub
 * with no pumps configured) have no `pump_id` — those fall back to every
 * non-voided sale of the pump's product that day, same as before; if two
 * pumps share a product, that legacy pool still reconciles them together.
 * Flag a variance alert when |variance| > thresholdLitres (default 20L).
 */
export function calculatePumpMeterVariance(
  pump: { id: string; label: string; product_id?: string },
  readings: { id: string; pump_id: string; reading: number; recorded_at: string; note?: string; is_reset?: boolean }[],
  orders: Order[],
  thresholdLitres = 20
): PumpVarianceAudit[] {
  const pumpReadings = readings
    .filter(r => r.pump_id === pump.id)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  const audits: PumpVarianceAudit[] = [];
  let baseline: (typeof pumpReadings)[number] | null = null;
  let currentDay: string | null = null;
  let dayBuffer: typeof pumpReadings = [];

  // Closes out whatever day is currently buffered, emitting an audit row if
  // there's a baseline to diff against (or seeding one from this day's own
  // first reading, matching the pre-existing "first reading ever" behavior).
  const flushDay = () => {
    if (!currentDay || dayBuffer.length === 0) return;
    if (!baseline) {
      if (dayBuffer.length === 1) {
        baseline = dayBuffer[0];
        dayBuffer = [];
        return;
      }
      baseline = dayBuffer[0];
    }

    const startReadingObj = baseline;
    const endReadingObj = dayBuffer[dayBuffer.length - 1];
    const meterDelta = Number((endReadingObj.reading - startReadingObj.reading).toFixed(2));

    const expectedLitres = Number(
      orders
        .filter(o =>
          !o.voided &&
          depotDateKey(o.date) === currentDay &&
          (o.pump_id ? o.pump_id === pump.id : o.product_id === pump.product_id)
        )
        .reduce((sum, o) => sum + Number(o.litres || 0), 0)
        .toFixed(2)
    );

    const variance = Number((meterDelta - expectedLitres).toFixed(2));
    const isOverThreshold = Math.abs(variance) > thresholdLitres;

    audits.push({
      pumpId: pump.id,
      pumpLabel: pump.label,
      startReading: startReadingObj.reading,
      endReading: endReadingObj.reading,
      meterDelta,
      expectedLitres,
      variance,
      isOverThreshold,
      startDate: startReadingObj.recorded_at,
      endDate: endReadingObj.recorded_at,
      day: currentDay,
      note: endReadingObj.note
    });

    baseline = endReadingObj;
    dayBuffer = [];
  };

  for (const r of pumpReadings) {
    if (r.is_reset) {
      // A deliberate meter reset (new/replaced meter) — never diff across
      // this boundary, or a legitimate reset reads as a giant theft/shortage
      // variance. Close out whatever was in progress, then start a fresh
      // baseline at the reset reading itself.
      flushDay();
      currentDay = null;
      baseline = r;
      continue;
    }
    const day = depotDateKey(r.recorded_at);
    if (day !== currentDay) {
      flushDay();
      currentDay = day;
    }
    dayBuffer.push(r);
  }
  flushDay();

  return audits;
}

/**
 * A single logged reading jumping by more than this in one go is almost
 * always a mistyped/mangled digit (e.g. a stray extra "00"), not a real
 * pump — nothing dispenses this much between two loggings. Deliberately
 * generous so it only catches genuine fat-finger territory, never a real
 * busy day. Below this: silent as before. Above it: `isValid` stays true
 * (never hard-blocks a real reading) but a `warning` comes back for the
 * caller to surface as a confirm-before-saving step.
 */
export const PUMP_READING_SANITY_JUMP_LITRES = 20000;

export function validateNewPumpReading(
  newReading: number,
  lastReading: number
): { isValid: boolean; error?: string; warning?: string } {
  const numNew = Number(newReading);
  const numLast = Number(lastReading) || 0;
  if (isNaN(numNew) || numNew <= 0) {
    return { isValid: false, error: 'Please enter a valid positive meter reading' };
  }
  if (numNew < numLast) {
    return {
      isValid: false,
      error: `Meter reading (${numNew}L) cannot be less than previous reading (${numLast}L). Pumps only count up.`
    };
  }
  const jump = numNew - numLast;
  if (jump > PUMP_READING_SANITY_JUMP_LITRES) {
    return {
      isValid: true,
      warning: `That's a jump of ${jump.toLocaleString()}L from the last reading (${numLast.toLocaleString()}L) — far more than a pump normally dispenses between loggings. Double-check the digits before saving. If the meter was actually replaced or zeroed, use Reset Meter instead.`
    };
  }
  return { isValid: true };
}

/**
 * The depot operates on Lagos time. All "which day did this happen" and
 * "today's totals" logic must use this timezone, not the browser's or UTC.
 */
export const DEPOT_TZ = 'Africa/Lagos';

/**
 * Returns the depot-local calendar day for an ISO timestamp, as 'YYYY-MM-DD'.
 * Use this instead of `date.slice(0, 10)` (which is UTC) anywhere a day bucket matters.
 */
export function depotDateKey(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    // en-CA gives ISO-style YYYY-MM-DD
    return d.toLocaleDateString('en-CA', { timeZone: DEPOT_TZ });
  } catch {
    return '';
  }
}

/** Today's depot-local calendar day as 'YYYY-MM-DD'. */
export function getDepotToday(): string {
  return depotDateKey(new Date());
}

/**
 * Format currency in Nigerian Naira (₦)
 */
export function formatNaira(amount: number): string {
  const num = Number(amount) || 0;
  return '₦' + num.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Format a numeric input string with commas every 3 digits (e.g. 100000 -> "100,000", 500 -> "500").
 * Preserves empty strings and a single decimal point (with whatever digits
 * follow it, even zero of them) so typing a fractional value — e.g. a pump
 * meter reading like "12450.5" — doesn't get silently truncated to an
 * integer character by character as the user types the '.'. Only the first
 * '.' survives; anything after a second one is treated as more digits.
 */
export function formatWithCommas(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const str = String(value);
  const dotIndex = str.indexOf('.');
  const wholeDigits = (dotIndex === -1 ? str : str.slice(0, dotIndex)).replace(/[^0-9]/g, '');
  if (dotIndex === -1) {
    return wholeDigits ? Number(wholeDigits).toLocaleString('en-US') : '';
  }
  const decimalDigits = str.slice(dotIndex + 1).replace(/[^0-9]/g, '');
  const wholeFormatted = wholeDigits ? Number(wholeDigits).toLocaleString('en-US') : '0';
  return `${wholeFormatted}.${decimalDigits}`;
}

/**
 * Sanitize a raw <input> value down to digits and at most one decimal point
 * — for plain `type="number"` fields (mechanical meter readings, which read
 * to a tenths-of-a-litre digit) where `formatWithCommas`'s thousands
 * separators would be rejected by the browser's own number-input parsing.
 * Same '.'-preserving behaviour as `formatWithCommas`, no comma grouping.
 */
export function keepDigitsAndDecimal(value: string): string {
  const dotIndex = value.indexOf('.');
  if (dotIndex === -1) return value.replace(/[^0-9]/g, '');
  const whole = value.slice(0, dotIndex).replace(/[^0-9]/g, '');
  const decimals = value.slice(dotIndex + 1).replace(/[^0-9]/g, '');
  return `${whole}.${decimals}`;
}

/**
 * Strips commas and parses an integer or float from a comma-separated string.
 */
export function parseFromCommas(value: string | number | null | undefined): number {
  if (value === '' || value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Read an owner-typed figure out of a Settings text field.
 *
 * Blank means "not configured" and yields the fallback. Everything else is
 * parsed with thousands separators stripped, so the grouped figure the field
 * itself displays — "1,125" — reads as 1125. A bare `parseFloat` used to stop
 * at the comma and save `1`, which then looked like a density of 1 L/ton.
 * Shares `parseFromCommas` with the cashier-facing amount fields, so the app
 * keeps one comma-aware reader instead of two that can drift apart.
 */
export function numberOrBlank(raw: string | number | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined) return fallback;
  const trimmed = String(raw).trim();
  if (trimmed === '') return fallback;
  // A field with no digit in it at all holds nothing usable → the fallback,
  // never an invented 0 that later reads as a configured figure.
  if (!/[0-9]/.test(trimmed)) return fallback;
  return parseFromCommas(trimmed);
}

/**
 * Spell a Naira amount in words for receipts, e.g. 1385000 -> "One million,
 * three hundred and eighty-five thousand naira only". Kobo is rounded off.
 */
export function formatNairaWords(amount: number): string {
  const n = Math.round(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Zero naira only';

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const under1000 = (num: number): string => {
    let out = '';
    if (num >= 100) {
      out += ones[Math.floor(num / 100)] + ' hundred';
      num %= 100;
      if (num) out += ' and ';
    }
    if (num >= 20) {
      out += tens[Math.floor(num / 10)];
      if (num % 10) out += '-' + ones[num % 10];
    } else if (num > 0) {
      out += ones[num];
    }
    return out;
  };

  const scales = [
    { value: 1_000_000_000, name: 'billion' },
    { value: 1_000_000, name: 'million' },
    { value: 1_000, name: 'thousand' }
  ];

  let remainder = n;
  const parts: string[] = [];
  for (const { value, name } of scales) {
    if (remainder >= value) {
      parts.push(under1000(Math.floor(remainder / value)) + ' ' + name);
      remainder %= value;
    }
  }
  if (remainder > 0) parts.push(under1000(remainder));

  const words = parts.join(', ');
  return words.charAt(0).toUpperCase() + words.slice(1) + ' naira only';
}

/**
 * Format date for depot displays (pinned to Lagos time)
 */
export function formatDepotDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      timeZone: DEPOT_TZ,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function formatDepotTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-GB', {
      timeZone: DEPOT_TZ,
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

/**
 * Convert an ISO timestamp (default now) into the value a `<input type="datetime-local">`
 * expects, in the viewer's own local time (that's what the input renders in).
 */
export function toDatetimeLocalValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Reverse of {@link toDatetimeLocalValue} — a datetime-local field's value back to an ISO string. */
export function fromDatetimeLocalValue(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * 12. SHIFT RECONCILIATION
 * expected_cash = opening_float + cash_sales - cash_expenses
 * cash_variance = cash_counted - expected_cash
 */
export function calculateShiftSummary(
  openingFloat: number,
  cashSales: number,
  cashExpenses: number,
  cashCounted?: number
): {
  openingFloat: number;
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
  cashCounted: number;
  cashVariance: number;
  hasVariance: boolean;
} {
  const op = Number(openingFloat) || 0;
  const sales = Number(cashSales) || 0;
  const exp = Number(cashExpenses) || 0;
  const expectedCash = Number((op + sales - exp).toFixed(2));
  const counted = cashCounted !== undefined ? Number(cashCounted) || 0 : expectedCash;
  const cashVariance = Number((counted - expectedCash).toFixed(2));

  return {
    openingFloat: op,
    cashSales: sales,
    cashExpenses: exp,
    expectedCash,
    cashCounted: counted,
    cashVariance,
    hasVariance: Math.abs(cashVariance) > 0.01
  };
}

/**
 * Single source of truth for a shift's cash position. Used by the live shift
 * banner, today's stats, and shift close so all three agree exactly.
 * Window: shift start_time .. (end_time or `now`).
 */
export function computeShiftCash(
  shift: { start_time: string; end_time?: string | null; opening_float: number },
  orders: Order[],
  expenses: { date: string; amount: number; voided?: boolean }[],
  now: Date = new Date(),
  sales?: Sale[]
): { cashSales: number; cashExpenses: number; expectedCash: number } {
  const startMs = new Date(shift.start_time).getTime();
  const endMs = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();

  let cashSales = 0;
  if (sales && sales.length > 0) {
    const shiftSales = sales.filter(s => {
      const t = new Date(s.date).getTime();
      return t >= startMs && t <= endMs && !s.voided;
    });
    for (const s of shiftSales) {
      if (s.payment_method === 'cash') {
        const saleLines = orders.filter(o => o.sale_id === s.id && !o.voided);
        cashSales += saleLines.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
      } else if (s.payment_method === 'split' && s.payment_splits) {
        const cashSplit = s.payment_splits.find(sp => sp.method === 'cash');
        if (cashSplit) cashSales += cashSplit.amount;
      }
    }
  } else {
    cashSales = orders
      .filter(o => {
        const t = new Date(o.date).getTime();
        return t >= startMs && t <= endMs && !o.voided && o.payment_method === 'cash';
      })
      .reduce((sum, o) => sum + (o.paid_amount || 0), 0);
  }

  const cashExpenses = expenses
    .filter(e => {
      const t = new Date(e.date).getTime();
      return t >= startMs && t <= endMs && !e.voided;
    })
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const expectedCash = Number((shift.opening_float + cashSales - cashExpenses).toFixed(2));
  return {
    cashSales: Number(cashSales.toFixed(2)),
    cashExpenses: Number(cashExpenses.toFixed(2)),
    expectedCash
  };
}

/**
 * 13. SHIFT-START METER GATE
 * A shift cannot be used to record ANY sale until all active depot pumps have an
 * opening meter reading logged for that shift.
 */
export interface ShiftOpeningGateStatus {
  isPassed: boolean;
  reason?: 'no_shift' | 'missing_readings';
  missingPumps: Pump[];
  loggedReadings: Record<string, number>;
}

export function checkShiftOpeningMetersGate(
  shift: Shift | null,
  pumps: Pump[],
  pumpReadings: PumpReading[] = [],
  products: Pick<Product, 'id' | 'supply_model'>[] = []
): ShiftOpeningGateStatus {
  // Only actual bulk liquid dispensing pumps require meter readings — a
  // pre-kegged product (e.g. palm oil) has no pump to read. A pump whose
  // product isn't recognised is treated as bulk (safer default: gate it).
  const activeBulkPumps = pumps.filter(p => {
    const product = products.find(pr => pr.id === p.product_id);
    return product ? product.supply_model === 'bulk_truck' : true;
  });

  const isShiftOpen = !!shift && (!shift.end_time || shift.status === 'open') && shift.status !== 'closed';
  if (!isShiftOpen) {
    return {
      isPassed: false,
      reason: 'no_shift',
      missingPumps: activeBulkPumps,
      loggedReadings: {}
    };
  }

  const shiftStartMs = new Date(shift.start_time).getTime();
  const loggedReadings: Record<string, number> = { ...(shift.opening_readings || {}) };
  const missingPumps: Pump[] = [];

  for (const pump of activeBulkPumps) {
    if (loggedReadings[pump.id] !== undefined && loggedReadings[pump.id] !== null) {
      continue;
    }
    // Check if there is a pumpReading recorded since shift start
    const readingSinceStart = pumpReadings
      .filter(r => r.pump_id === pump.id && new Date(r.recorded_at).getTime() >= shiftStartMs)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())[0];

    if (readingSinceStart) {
      loggedReadings[pump.id] = readingSinceStart.reading;
    } else {
      missingPumps.push(pump);
    }
  }

  return {
    isPassed: missingPumps.length === 0,
    reason: missingPumps.length > 0 ? 'missing_readings' : undefined,
    missingPumps,
    loggedReadings
  };
}



