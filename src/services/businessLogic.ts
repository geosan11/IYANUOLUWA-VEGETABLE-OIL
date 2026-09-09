import {
  Customer,
  Order,
  KegReturn,
  Transfer,
  CustomerCredit,
  Tank,
  RateCard,
  CustomerType,
  CustomerCalculatedStats,
  TankDrawResult,
  PaymentApplicationResult,
  UnitType,
  KegSource,
  Pump,
  PumpReading,
  Shift
} from '../types';
import { LITRES_PER_KEG } from '../constants/config';

/**
 * 1. UNIT CONVERSION
 * litres = unit === 'ton' ? qty * litresPerTon : unit === 'keg' ? qty * litresPerKeg : qty
 */
export function calculateLitres(
  unit: UnitType,
  qty: number,
  litresPerKeg = LITRES_PER_KEG,
  litresPerTon: number | null = 1075
): number {
  const numericQty = Number(qty) || 0;
  if (unit === 'ton') return numericQty * (litresPerTon || 1075);
  if (unit === 'keg') return numericQty * litresPerKeg;
  return numericQty;
}

/**
 * 2. TRUCK INTAKE METRICS (bulk_truck only)
 * expected_litres = tons * product.litres_per_ton
 * expected_kegs   = expected_litres / litresPerKeg
 * recovered       = (actual_kegs_filled * litresPerKeg) + leftover_litres_recovered
 * shortfall       = expected_litres - recovered
 * isShortfallHigh = shortfall > 50L
 */
export interface IntakeMetrics {
  expectedLitres: number;
  expectedKegs: number;
  recoveredLitres: number;
  shortfall: number;
  isShortfallHigh: boolean; // > 50L
  exceedsDepotKegCapacity: boolean;
}

export function calculateIntakeMetrics(
  tons: number,
  litresPerTon: number,
  actualKegsFilled: number,
  leftoverLitresRecovered: number,
  kegsAtDepot: number,
  litresPerKeg = LITRES_PER_KEG
): IntakeMetrics {
  const numTons = Number(tons) || 0;
  const numActualKegs = Number(actualKegsFilled) || 0;
  const numLeftovers = Number(leftoverLitresRecovered) || 0;

  const expectedLitres = numTons * (litresPerTon || 1075);
  const expectedKegs = expectedLitres > 0 ? expectedLitres / litresPerKeg : 0;
  const recoveredLitres = (numActualKegs * litresPerKeg) + numLeftovers;
  const shortfall = expectedLitres - recoveredLitres;

  return {
    expectedLitres: Number(expectedLitres.toFixed(2)),
    expectedKegs: Number(expectedKegs.toFixed(1)),
    recoveredLitres: Number(recoveredLitres.toFixed(2)),
    shortfall: Number(shortfall.toFixed(2)),
    isShortfallHigh: shortfall > 50,
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
  const exactLitres = Number((kegs * (litresPerKeg || 25)).toFixed(2));
  return {
    exactLitres,
    kegsReceived: kegs
  };
}

/**
 * 8. RATE LOOKUP
 * rate_per_litre = rate_cards[product_id][customer.type]
 * keg price = rate_per_litre * litres_per_keg
 */
export function lookupRatePerLitre(
  rateCards: RateCard[],
  productId: string,
  customerType: CustomerType
): number {
  const card = rateCards.find(r => r.product_id === productId && r.tier === customerType);
  if (card) return card.rate_per_litre;
  // Fallbacks if not seeded
  if (productId === 'veg') {
    if (customerType === 'retail') return 5200;
    if (customerType === 'agent') return 4800;
    return 4500;
  } else {
    if (customerType === 'retail') return 5600;
    if (customerType === 'agent') return 5100;
    return 4800;
  }
}

export function calculateOrderPricing(
  unit: UnitType,
  qty: number,
  ratePerLitre: number,
  litresPerKeg = LITRES_PER_KEG,
  litresPerTon: number | null = 1075,
  kegSource: KegSource = null,
  kegSellPrice: number | null = null
): {
  litres: number;
  oilAmount: number;
  kegAmount: number;
  amount: number;
  ratePerKeg: number;
} {
  const litres = calculateLitres(unit, qty, litresPerKeg, litresPerTon);
  const ratePerKeg = ratePerLitre * litresPerKeg;
  const oilAmount = Number((litres * ratePerLitre).toFixed(2));
  const isPurchasedKeg = unit === 'keg' && kegSource === 'purchased' && kegSellPrice !== null && kegSellPrice !== undefined;
  const kegAmount = isPurchasedKeg ? Number(((Number(qty) || 0) * (kegSellPrice || 0)).toFixed(2)) : 0;
  const amount = Number((oilAmount + kegAmount).toFixed(2));
  return {
    litres: Number(litres.toFixed(2)),
    oilAmount,
    kegAmount,
    amount,
    ratePerKeg
  };
}

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

  const customerOrders = orders.filter(o => o.customer_id === customer.id);

  // Store credit the depot owes this customer (overpayments, minus what has been redeemed).
  const creditBalance = Math.max(
    0,
    credits
      .filter(c => c.customer_id === customer.id)
      .reduce((sum, c) => sum + Number(c.amount || 0), 0)
  );

  
  // Open credit orders where amount > paid_amount and payment_method === 'credit'
  const openOrders = customerOrders.filter(
    o => o.payment_method === 'credit' && (o.amount - (o.paid_amount || 0)) > 0.01
  );

  const currentBalance = openOrders.reduce(
    (sum, o) => sum + (o.amount - (o.paid_amount || 0)),
    0
  );

  // Kegs out = sum(orders where keg_source='company', qty) - sum(keg_returns.qty) - transfers_out + transfers_in
  const totalCompanyKegsSupplied = customerOrders
    .filter(o => o.keg_source === 'company' && o.unit === 'keg')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  const customerReturns = kegReturns
    .filter(r => r.customer_id === customer.id)
    .reduce((sum, r) => sum + Number(r.qty || 0), 0);

  const kegsTransferredOut = transfers
    .filter(t => t.from_customer_id === customer.id && t.item_type === 'keg')
    .reduce((sum, t) => sum + Number(t.qty || 0), 0);

  const kegsTransferredIn = transfers
    .filter(t => t.to_customer_id === customer.id && t.item_type === 'keg')
    .reduce((sum, t) => sum + Number(t.qty || 0), 0);

  const totalCompanyKegsOut = Math.max(
    0,
    totalCompanyKegsSupplied - customerReturns - kegsTransferredOut + kegsTransferredIn
  );

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
 * 6. KEG INVENTORY SUMMARY
 * kegs_out (per customer) = sum(orders where keg_source='company', qty) - sum(keg_returns.qty)
 * total_kegs_out = sum across all customers
 * kegs_at_depot = total_company_kegs - total_kegs_out
 * flag red if kegs_at_depot < 20
 */
export interface KegInventorySummary {
  totalCompanyKegs: number;
  totalKegsOut: number;
  kegsAtDepot: number;
  isDepotStockCritical: boolean; // < 20
}

export function calculateKegInventory(
  totalCompanyKegs: number,
  orders: Order[],
  kegReturns: KegReturn[]
): KegInventorySummary {
  // Company loan obligations: kegs loaned to customers that are expected back
  const totalCompanySupplied = orders
    .filter(o => o.keg_source === 'company' && o.unit === 'keg')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  // Outright purchased kegs: physical company keg permanently sold to customer (no return obligation)
  const totalPurchased = orders
    .filter(o => o.keg_source === 'purchased' && o.unit === 'keg')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  const totalReturned = kegReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);

  const totalKegsOut = Math.max(0, totalCompanySupplied - totalReturned);
  // Physical stock in depot is reduced by both loaned kegs and outright purchased kegs
  const kegsAtDepot = Math.max(0, totalCompanyKegs - totalKegsOut - totalPurchased);

  return {
    totalCompanyKegs,
    totalKegsOut,
    kegsAtDepot,
    isDepotStockCritical: kegsAtDepot < 20
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
    .filter(o => o.customer_id === customerId && o.payment_method === 'credit' && (o.amount - (o.paid_amount || 0)) > 0.001)
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
 * 9. PUMP METER VARIANCE RECONCILIATION
 * Each pump's meter only counts up (like an odometer, never resets).
 * Between any two consecutive readings for the same pump (sorted by recorded_at ascending):
 *   meter_delta = reading_2 - reading_1
 *   expected_litres = sum of litres from all orders on that pump_id between the two recorded_at timestamps
 *   variance = meter_delta - expected_litres
 * Flag a variance alert when |variance| > thresholdLitres (default 20L).
 */
export function calculatePumpMeterVariance(
  pump: { id: string; label: string; last_meter_reading: number },
  readings: { id: string; pump_id: string; reading: number; recorded_at: string; note?: string }[],
  orders: Order[],
  thresholdLitres = 20
): {
  pumpId: string;
  pumpLabel: string;
  startReading: number;
  endReading: number;
  meterDelta: number;
  expectedLitres: number;
  variance: number;
  isOverThreshold: boolean;
  startDate: string;
  endDate: string;
  note?: string;
}[] {
  const pumpReadings = readings
    .filter(r => r.pump_id === pump.id)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  if (pumpReadings.length < 2) {
    return [];
  }

  const audits = [];

  for (let i = 0; i < pumpReadings.length - 1; i++) {
    const r1 = pumpReadings[i];
    const r2 = pumpReadings[i + 1];

    const time1 = new Date(r1.recorded_at).getTime();
    const time2 = new Date(r2.recorded_at).getTime();

    const meterDelta = Number((r2.reading - r1.reading).toFixed(2));

    // Sum litres from orders on this pump within the reading interval
    const matchingOrders = orders.filter(o => {
      if (o.pump_id !== pump.id) return false;
      const orderTime = new Date(o.date).getTime();
      return orderTime >= time1 && orderTime <= time2;
    });

    const expectedLitres = Number(
      matchingOrders.reduce((sum, o) => sum + Number(o.litres || 0), 0).toFixed(2)
    );

    const variance = Number((meterDelta - expectedLitres).toFixed(2));
    const isOverThreshold = Math.abs(variance) > thresholdLitres;

    audits.push({
      pumpId: pump.id,
      pumpLabel: pump.label,
      startReading: r1.reading,
      endReading: r2.reading,
      meterDelta,
      expectedLitres,
      variance,
      isOverThreshold,
      startDate: r1.recorded_at,
      endDate: r2.recorded_at,
      note: r2.note
    });
  }

  return audits;
}

export function validateNewPumpReading(
  newReading: number,
  lastReading: number
): { isValid: boolean; error?: string } {
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
 * 10. PER-ORDER PUMP METER VARIANCE
 * On submit, if pump_id and meter_reading are provided:
 * previous_reading = last recorded meter_reading on that pump (from prior order with meter_reading, or pump.last_meter_reading)
 * delta = meter_reading - previous_reading
 * expected = order's litres
 * variance = delta - expected
 * flag if |variance| > thresholdLitres (default 20L)
 */
export function calculatePerOrderMeterVariance(
  pumpId: string,
  currentReading: number,
  orderLitres: number,
  allOrders: Order[],
  pumpLastReading = 0,
  thresholdLitres = 20
): {
  previousReading: number;
  meterDelta: number;
  expectedLitres: number;
  variance: number;
  isOverThreshold: boolean;
} {
  const current = Number(currentReading) || 0;
  const expected = Number(orderLitres) || 0;

  // Find prior orders on this pump that have a valid meter_reading, sorted descending by date
  const priorOrdersWithMeter = allOrders
    .filter(o => o.pump_id === pumpId && o.meter_reading !== undefined && o.meter_reading !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const previousReading = priorOrdersWithMeter.length > 0
    ? Number(priorOrdersWithMeter[0].meter_reading)
    : Number(pumpLastReading) || 0;

  const meterDelta = Number((current - previousReading).toFixed(2));
  const variance = Number((meterDelta - expected).toFixed(2));
  const isOverThreshold = Math.abs(variance) > thresholdLitres;

  return {
    previousReading,
    meterDelta,
    expectedLitres: expected,
    variance,
    isOverThreshold
  };
}

/**
 * 11. TANK DIPSTICK VERIFICATION
 * Physical stick measurement for depot bulk storage tanks.
 * variance = reading_litres - tank.remaining_litres
 * flag if |variance| > thresholdLitres (default 30L)
 */
export function calculateDipstickVariance(
  readingLitres: number,
  tankRemainingLitres: number,
  thresholdLitres = 30
): {
  readingLitres: number;
  tankLitres: number;
  variance: number;
  isOverThreshold: boolean;
} {
  const reading = Number(readingLitres) || 0;
  const tankLitres = Number(tankRemainingLitres) || 0;
  const variance = Number((reading - tankLitres).toFixed(2));
  const isOverThreshold = Math.abs(variance) > thresholdLitres;

  return {
    readingLitres: reading,
    tankLitres,
    variance,
    isOverThreshold
  };
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
  expenses: { date: string; amount: number }[],
  now: Date = new Date()
): { cashSales: number; cashExpenses: number; expectedCash: number } {
  const startMs = new Date(shift.start_time).getTime();
  const endMs = shift.end_time ? new Date(shift.end_time).getTime() : now.getTime();

  const cashSales = orders
    .filter(o => {
      const t = new Date(o.date).getTime();
      return t >= startMs && t <= endMs && o.payment_method === 'cash';
    })
    .reduce((sum, o) => sum + (o.paid_amount || 0), 0);

  const cashExpenses = expenses
    .filter(e => {
      const t = new Date(e.date).getTime();
      return t >= startMs && t <= endMs;
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
  pumpReadings: PumpReading[] = []
): ShiftOpeningGateStatus {
  // Only actual bulk liquid dispensing pumps require meter readings.
  // Palm oil is supplied in pre-kegged containers and has no dispensing pumps.
  const activeBulkPumps = pumps.filter(
    p => p.product_id !== 'red' && p.product_id !== 'red_oil_25l' && !p.label.toLowerCase().includes('palm')
  );

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



