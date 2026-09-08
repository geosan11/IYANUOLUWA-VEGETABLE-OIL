import {
  Customer,
  Order,
  KegReturn,
  Tank,
  RateCard,
  CustomerType,
  CustomerCalculatedStats,
  TankDrawResult,
  PaymentApplicationResult,
  UnitType
} from '../types';
import { LITRES_PER_KEG } from '../constants/config';

/**
 * 1. UNIT CONVERSION
 * litres = unit === 'keg' ? qty * LITRES_PER_KEG : qty
 */
export function calculateLitres(unit: UnitType, qty: number, litresPerKeg = LITRES_PER_KEG): number {
  const numericQty = Number(qty) || 0;
  return unit === 'keg' ? numericQty * litresPerKeg : numericQty;
}

/**
 * 2. TRUCK INTAKE METRICS
 * expected_litres = tons * product.litres_per_ton
 * expected_kegs   = expected_litres / LITRES_PER_KEG
 * recovered       = (actual_kegs_filled * LITRES_PER_KEG) + leftover_litres_recovered
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

  const expectedLitres = numTons * (litresPerTon || 1090);
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
 * 8. RATE LOOKUP
 * rate_per_litre = rate_cards[product_id][customer.type]
 * keg price = rate_per_litre * LITRES_PER_KEG
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
  litresPerKeg = LITRES_PER_KEG
): { litres: number; amount: number; ratePerKeg: number } {
  const litres = calculateLitres(unit, qty, litresPerKeg);
  const ratePerKeg = ratePerLitre * litresPerKeg;
  const amount = litres * ratePerLitre;
  return {
    litres: Number(litres.toFixed(2)),
    amount: Number(amount.toFixed(2)),
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
  referenceDate: Date = new Date()
): CustomerCalculatedStats {
  const customerOrders = orders.filter(o => o.customer_id === customer.id);
  
  // Open credit orders where amount > paid_amount and payment_method === 'credit'
  const openOrders = customerOrders.filter(
    o => o.payment_method === 'credit' && (o.amount - (o.paid_amount || 0)) > 0.01
  );

  const currentBalance = openOrders.reduce(
    (sum, o) => sum + (o.amount - (o.paid_amount || 0)),
    0
  );

  // Kegs out = sum(orders where keg_source='company', qty) - sum(keg_returns.qty)
  const totalCompanyKegsSupplied = customerOrders
    .filter(o => o.keg_source === 'company' && o.unit === 'keg')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  const customerReturns = kegReturns
    .filter(r => r.customer_id === customer.id)
    .reduce((sum, r) => sum + Number(r.qty || 0), 0);

  const totalCompanyKegsOut = Math.max(0, totalCompanyKegsSupplied - customerReturns);

  // Compute Aging
  let worstOverdueDays = -Infinity; // Days past due (positive = overdue, negative = days remaining)

  if (openOrders.length === 0) {
    worstOverdueDays = -999; // Clean
  } else {
    for (const ord of openOrders) {
      if (!ord.due_date) continue;
      const dueDate = new Date(ord.due_date);
      // diff in days = (today - dueDate)
      const diffMs = referenceDate.getTime() - dueDate.getTime();
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
  const totalCompanySupplied = orders
    .filter(o => o.keg_source === 'company' && o.unit === 'keg')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  const totalReturned = kegReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);

  const totalKegsOut = Math.max(0, totalCompanySupplied - totalReturned);
  const kegsAtDepot = Math.max(0, totalCompanyKegs - totalKegsOut);

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
 * Format date for depot displays
 */
export function formatDepotDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
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
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}
