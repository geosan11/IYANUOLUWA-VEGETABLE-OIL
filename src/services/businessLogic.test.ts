import {
  calculateLitres,
  calculateIntakeMetrics,
  calculateCustomerStats,
  buildCustomerStatement,
  calculateKegInventory,
  executeFifoTankDraw,
  applyFifoPayment,
  calculatePumpMeterVariance,
  validateNewPumpReading,
  calculatePerOrderMeterVariance,
  calculateDipstickVariance,
  calculateShiftSummary,
  computeShiftCash,
  calculatePreKeggedIntakeMetrics,
  checkShiftOpeningMetersGate,
  depotDateKey,
  getDepotToday,
  formatNairaWords
} from './businessLogic';
import { lookupPackPrice, priceSaleLine } from './pricing';
import {
  Customer,
  Order,
  KegReturn,
  Tank,
  Transfer,
  Payment,
  Pump,
  Product,
  PackPrice,
  Shift
} from '../types';

console.log('====================================================');
console.log('RUNNING IYANUOLUWA DIGITAL OPERATIONS LOGIC VERIFICATION');
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

/** Fill the new required Order (sale-line) fields so test literals stay terse. */
function mkOrder(
  p: Partial<Order> &
    Pick<Order, 'id' | 'customer_id' | 'product_id' | 'qty' | 'litres' | 'amount' | 'payment_method' | 'date'>
): Order {
  return {
    sale_id: `sale-${p.id}`,
    variety_id: 'veg-soya',
    variety_name: 'Pure Soya',
    pack_size_id: 'sz_30',
    unit_price: 0,
    original_unit_price: null,
    price_adjusted: false,
    price_adjust_reason: null,
    oil_amount: p.amount,
    container_mode: 'none',
    returnable: false,
    container_unit_price: null,
    container_amount: null,
    line_amount: p.amount,
    pricing_tier: 'agent',
    paid_amount: 0,
    due_date: null,
    source_tank_id: null,
    ...p
  } as Order;
}

// 1. UNIT CONVERSION
assert(calculateLitres('keg', 10, 30) === 300, 'Unit conversion: 10 kegs = 300L');
assert(calculateLitres('litre', 150, 30) === 150, 'Unit conversion: 150L = 150L');

// 2. TRUCK INTAKE & SHORTFALL
const intake1 = calculateIntakeMetrics(10, 1090, 360, 20, 100, 30);
assert(intake1.expectedLitres === 10900, 'Intake: expectedLitres is 10,900L');
assert(intake1.recoveredLitres === 10820, 'Intake: recoveredLitres is 10,820L');
assert(intake1.shortfall === 80, 'Intake: shortfall is 80L');
assert(intake1.isShortfallHigh === true, 'Intake: 80L shortfall > default 50L threshold flagged true');
assert(intake1.exceedsDepotKegCapacity === true, 'Intake: 363.3 expected kegs > 100 depot kegs warning');

const intakeHiThresh = calculateIntakeMetrics(10, 1090, 360, 20, 100, 30, 100);
assert(intakeHiThresh.shortfall === 80, 'Intake: shortfall still 80L with a custom threshold');
assert(intakeHiThresh.isShortfallHigh === false, 'Intake: 80L shortfall is within a configured 100L threshold');

// 3. FIFO TANK DRAW
const mockTanks: Tank[] = [
  {
    id: 'tank-1',
    product_id: 'veg',
    truck_label: 'TRK-1 (Oldest)',
    tons: 10,
    received_litres: 1000,
    remaining_litres: 400,
    date: '2026-09-01T00:00:00Z',
    shortfall: 10
  },
  {
    id: 'tank-2',
    product_id: 'veg',
    truck_label: 'TRK-2 (Newer)',
    tons: 10,
    received_litres: 1000,
    remaining_litres: 800,
    date: '2026-09-05T00:00:00Z',
    shortfall: 10
  }
];

const drawResult = executeFifoTankDraw(mockTanks, 'veg', 600);
assert(drawResult.success === true, 'FIFO Tank Draw: successfully allocated across multiple tanks');
assert(drawResult.allocations.length === 2, 'FIFO Tank Draw: allocated across 2 tanks');
assert(drawResult.allocations[0].tankId === 'tank-1' && drawResult.allocations[0].drawnLitres === 400, 'FIFO Tank Draw: drained Tank-1 to 0');
assert(drawResult.allocations[1].tankId === 'tank-2' && drawResult.allocations[1].drawnLitres === 200, 'FIFO Tank Draw: pulled remainder (200L) from Tank-2');
assert(drawResult.updatedTanks[0].remaining_litres === 0, 'FIFO Tank Draw: Tank-1 remaining is 0L');
assert(drawResult.updatedTanks[1].remaining_litres === 600, 'FIFO Tank Draw: Tank-2 remaining is 600L');

const orderTankAllocations = drawResult.allocations.map(a => ({ tank_id: a.tankId, litres: a.drawnLitres }));
assert(orderTankAllocations.length === 2, 'Order tank_allocations: 2-tank sale records 2 allocations');
assert(
  orderTankAllocations.reduce((sum, a) => sum + a.litres, 0) === 600,
  'Order tank_allocations: allocation litres sum to the 600L order'
);

const failDraw = executeFifoTankDraw(mockTanks, 'veg', 1500);
assert(failDraw.success === false, 'FIFO Tank Draw: hard stop when stock is insufficient (1200 available vs 1500 requested)');

// 4. CUSTOMER CREDIT & AGING RULES
const sampleCustomer: Customer = {
  id: 'c-test',
  name: 'Test Customer',
  type: 'agent',
  credit_limit: 200000,
  credit_term_days: 14,
  phone: '+2348011112222'
};

const sampleOrders: Order[] = [
  mkOrder({
    id: 'o-1',
    customer_id: 'c-test',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 10,
    litres: 300,
    amount: 48000,
    payment_method: 'credit',
    container_mode: 'taken',
    date: '2026-08-01T00:00:00Z',
    due_date: '2026-08-15T00:00:00Z',
    source_tank_id: 'tank-1'
  }),
  mkOrder({
    id: 'o-2',
    customer_id: 'c-test',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 5,
    litres: 150,
    amount: 24000,
    payment_method: 'credit',
    container_mode: 'taken',
    date: '2026-09-01T00:00:00Z',
    due_date: '2026-09-15T00:00:00Z',
    source_tank_id: 'tank-1'
  })
];

const sampleKegReturns: KegReturn[] = [
  {
    id: 'ret-1',
    customer_id: 'c-test',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 3,
    date: '2026-08-20T00:00:00Z'
  }
];

const refDate = new Date('2026-09-08T12:00:00Z');
const stats = calculateCustomerStats(sampleCustomer, sampleOrders, sampleKegReturns, refDate);

assert(stats.currentBalance === 72000, 'Customer Balance: 48000 + 24000 = ₦72,000');
assert(stats.totalCompanyKegsOut === 12, 'Customer Kegs Out: 15 taken - 3 returned = 12 containers');
assert(stats.kegsOutByPack['veg|sz_30'] === 12, 'Customer Kegs Out: bucketed under veg|sz_30');
assert(stats.agingBadge.status === 'overdue', 'Customer Aging: flagged overdue');
assert(stats.agingBadge.days === 24, 'Customer Aging: 24 days overdue');

// A voided line must not count toward balance or kegs out.
const withVoided = calculateCustomerStats(
  sampleCustomer,
  [...sampleOrders, mkOrder({ id: 'o-void', customer_id: 'c-test', product_id: 'veg', qty: 4, litres: 120, amount: 20000, payment_method: 'credit', container_mode: 'taken', date: '2026-09-02T00:00:00Z', due_date: '2026-09-16T00:00:00Z', voided: true })],
  sampleKegReturns,
  refDate
);
assert(withVoided.currentBalance === 72000, 'Voided line: excluded from customer balance');
assert(withVoided.totalCompanyKegsOut === 12, 'Voided line: excluded from kegs out');

// 5. FIFO PAYMENT APPLICATION
const paymentResult = applyFifoPayment(sampleOrders, 'c-test', 50000);
assert(paymentResult.totalApplied === 50000, 'FIFO Payment: totalApplied is ₦50,000');
assert(paymentResult.appliedOrders.length === 2, 'FIFO Payment: allocated across 2 orders');
assert(paymentResult.appliedOrders[0].orderId === 'o-1' && paymentResult.appliedOrders[0].isFullyPaid === true, 'FIFO Payment: oldest due date order o-1 fully settled');
assert(paymentResult.appliedOrders[1].orderId === 'o-2' && paymentResult.appliedOrders[1].amountApplied === 2000, 'FIFO Payment: remainder ₦2,000 applied to o-2');
assert(paymentResult.unappliedLeftover === 0, 'FIFO Payment: 0 leftover');

const overPaymentResult = applyFifoPayment(sampleOrders, 'c-test', 100000);
assert(overPaymentResult.totalApplied === 72000, 'FIFO Overpayment: total applied is exactly open balance ₦72,000');
assert(overPaymentResult.unappliedLeftover === 28000, 'FIFO Overpayment: reported ₦28,000 unapplied leftover');

// 6. KEG INVENTORY SUMMARY
const kegSummary = calculateKegInventory(500, sampleOrders, sampleKegReturns);
assert(kegSummary.totalCompanyKegs === 500, 'Keg Inventory: total fleet = 500');
assert(kegSummary.totalKegsOut === 12, 'Keg Inventory: total out = 12 (15 taken - 3 returned)');
assert(kegSummary.kegsAtDepot === 488, 'Keg Inventory: depot stock = 488');
assert(kegSummary.isDepotStockCritical === false, 'Keg Inventory: not critical (>20)');

// 7. PUMP METER VARIANCE RECONCILIATION
const mockPump = {
  id: 'p-test',
  label: 'Test Pump 1',
  last_meter_reading: 10500
};

const mockReadings = [
  { id: 'pr-1', pump_id: 'p-test', reading: 10000, recorded_at: '2026-09-08T06:00:00Z' },
  { id: 'pr-2', pump_id: 'p-test', reading: 10500, recorded_at: '2026-09-08T18:00:00Z' }
];

const pumpOrdersVariance: Order[] = [
  mkOrder({
    id: 'po-1',
    customer_id: 'c-test',
    product_id: 'veg',
    qty: 15,
    litres: 450,
    amount: 72000,
    paid_amount: 72000,
    payment_method: 'transfer',
    container_mode: 'none',
    date: '2026-09-08T10:00:00Z',
    source_tank_id: 'tank-1',
    pump_id: 'p-test'
  })
];

const auditA = calculatePumpMeterVariance(mockPump, mockReadings, pumpOrdersVariance, 20);
assert(auditA.length === 1, 'Pump Reconciliation: produced 1 audit interval');
assert(auditA[0].meterDelta === 500, 'Pump Reconciliation: meter delta is 500L (10500 - 10000)');
assert(auditA[0].expectedLitres === 450, 'Pump Reconciliation: expected litres from logged orders is 450L');
assert(auditA[0].variance === 50, 'Pump Reconciliation: variance is +50L');
assert(auditA[0].isOverThreshold === true, 'Pump Reconciliation: flagged alert for 50L variance > 20L threshold');

const pumpOrdersExact: Order[] = [
  ...pumpOrdersVariance,
  mkOrder({
    id: 'po-2',
    customer_id: 'c-test',
    product_id: 'veg',
    qty: 50,
    litres: 50,
    amount: 240000,
    paid_amount: 240000,
    payment_method: 'cash',
    date: '2026-09-08T14:00:00Z',
    source_tank_id: 'tank-1',
    pump_id: 'p-test'
  })
];

const auditB = calculatePumpMeterVariance(mockPump, mockReadings, pumpOrdersExact, 20);
assert(auditB[0].variance === 0, 'Pump Reconciliation: variance is exactly 0L');
assert(auditB[0].isOverThreshold === false, 'Pump Reconciliation: no alert for 0L variance');

assert(validateNewPumpReading(10600, 10500).isValid === true, 'Pump Validation: higher reading passes');
assert(validateNewPumpReading(10400, 10500).isValid === false, 'Pump Validation: lower reading fails (meters only count up)');

// 10. PACK-SIZE PRICING
const vegProduct: Product = {
  id: 'veg',
  name: 'Golden Vegetable Oil',
  supply_model: 'bulk_truck',
  litres_per_ton: 1075,
  litres_per_keg: 30,
  keg_sell_price: 3500,
  varieties: [{ id: 'veg-soya', name: 'Pure Soya' }],
  pack_config: [
    { pack_size_id: 'sz_25', returnable: true, container_buy_price: 3500 },
    { pack_size_id: 'sz_1', returnable: false, container_buy_price: 0 }
  ],
  color_light: '#fff',
  color_dark: '#000'
};
const testPackPrices: PackPrice[] = [
  { product_id: 'veg', variety_id: 'veg-soya', pack_size_id: 'sz_25', tier: 'agent', price: 125000 },
  { product_id: 'veg', variety_id: 'veg-soya', pack_size_id: 'sz_1', tier: 'retail', price: 6000 }
];

assert(lookupPackPrice(testPackPrices, 'veg', 'veg-soya', 'sz_25', 'agent') === 125000, 'lookupPackPrice: 25L agent price is ₦125,000');
assert(lookupPackPrice(testPackPrices, 'veg', 'veg-soya', 'sz_1', 'agent') === null, 'lookupPackPrice: unpriced combination returns null');

const priceTaken = priceSaleLine({
  product: vegProduct,
  varietyId: 'veg-soya',
  packSizeId: 'sz_25',
  tier: 'agent',
  qty: 10,
  containerMode: 'taken',
  packPrices: testPackPrices
});
assert(priceTaken.litres === 250, 'priceSaleLine: 10 x 25L = 250L');
assert(priceTaken.oilAmount === 1250000, 'priceSaleLine: 10 packs at ₦125,000 = ₦1,250,000');
assert(priceTaken.containerAmount === 0, 'priceSaleLine: taken containers add nothing');
assert(priceTaken.lineAmount === 1250000, 'priceSaleLine: line total is ₦1,250,000');
assert(priceTaken.returnable === true, 'priceSaleLine: 25L pack is returnable');

const priceBought = priceSaleLine({
  product: vegProduct,
  varietyId: 'veg-soya',
  packSizeId: 'sz_25',
  tier: 'agent',
  qty: 10,
  containerMode: 'bought',
  packPrices: testPackPrices
});
assert(priceBought.containerAmount === 35000, 'priceSaleLine: 10 bought containers at ₦3,500 = ₦35,000');
assert(priceBought.lineAmount === 1285000, 'priceSaleLine: oil + containers = ₦1,285,000');

const priceUnpriced = priceSaleLine({
  product: vegProduct,
  varietyId: 'veg-soya',
  packSizeId: 'sz_1',
  tier: 'agent',
  qty: 5,
  containerMode: 'none',
  packPrices: testPackPrices
});
assert(priceUnpriced.unpriced === true, 'priceSaleLine: flags an unpriced line');

const priceOverride = priceSaleLine({
  product: vegProduct,
  varietyId: 'veg-soya',
  packSizeId: 'sz_25',
  tier: 'agent',
  qty: 1,
  containerMode: 'none',
  overrideUnitPrice: 130000,
  packPrices: testPackPrices
});
assert(priceOverride.priceAdjusted === true, 'priceSaleLine: an override away from the matrix flags price_adjusted');
assert(priceOverride.unitPrice === 130000, 'priceSaleLine: override price is used');

// 11. INTER-CUSTOMER / INTER-AGENT TRANSFERS
const transferSender: Customer = {
  id: 'c-sender',
  name: 'Sender Agent',
  type: 'agent',
  credit_limit: 500000,
  credit_term_days: 14,
  phone: '08011111111'
};
const transferReceiver: Customer = {
  id: 'c-receiver',
  name: 'Receiver Agent',
  type: 'agent',
  credit_limit: 500000,
  credit_term_days: 14,
  phone: '08022222222'
};

const senderOrders: Order[] = [
  mkOrder({
    id: 'ord-s1',
    customer_id: 'c-sender',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 20,
    litres: 600,
    amount: 96000,
    paid_amount: 96000,
    payment_method: 'cash',
    container_mode: 'taken',
    date: '2026-09-01T10:00:00Z',
    source_tank_id: 'tank-1'
  })
];

const mockTransfers: Transfer[] = [
  {
    id: 'tr-1',
    from_customer_id: 'c-sender',
    to_customer_id: 'c-receiver',
    item_type: 'keg',
    qty: 6,
    product_id: 'veg',
    pack_size_id: 'sz_30',
    date: '2026-09-05T12:00:00Z',
    note: 'Yard transfer from Sender to Receiver'
  }
];

const senderStats = calculateCustomerStats(transferSender, senderOrders, [], mockTransfers);
assert(senderStats.totalCompanyKegsOut === 14, 'Customer Transfers: Sender kegs out reduced by 6 (20 - 6 = 14)');

const receiverStats = calculateCustomerStats(transferReceiver, [], [], mockTransfers);
assert(receiverStats.totalCompanyKegsOut === 6, 'Customer Transfers: Receiver kegs out increased by 6 (0 + 6 = 6)');

// 12. PER-ORDER PUMP METER RECONCILIATION
const sampleOrdersForPump: Order[] = [
  mkOrder({
    id: 'ord-p1',
    customer_id: 'c-sender',
    product_id: 'veg',
    qty: 300,
    litres: 300,
    amount: 1440000,
    paid_amount: 1440000,
    payment_method: 'cash',
    date: '2026-09-08T09:00:00Z',
    source_tank_id: 'tank-1',
    pump_id: 'pump-1',
    meter_reading: 10300
  })
];

const perOrderAudit1 = calculatePerOrderMeterVariance('pump-1', 10500, 200, sampleOrdersForPump, 10000, 20);
assert(perOrderAudit1.previousReading === 10300, 'Per-order meter: detects previous reading 10300 from prior order');
assert(perOrderAudit1.meterDelta === 200, 'Per-order meter: delta is 200L (10500 - 10300)');
assert(perOrderAudit1.variance === 0, 'Per-order meter: variance is 0L (200 - 200)');
assert(perOrderAudit1.isOverThreshold === false, 'Per-order meter: no alert for 0L variance');

const ordersWithP2: Order[] = [
  ...sampleOrdersForPump,
  mkOrder({
    id: 'ord-p2',
    customer_id: 'c-receiver',
    product_id: 'veg',
    qty: 200,
    litres: 200,
    amount: 960000,
    paid_amount: 960000,
    payment_method: 'cash',
    date: '2026-09-08T11:00:00Z',
    source_tank_id: 'tank-1',
    pump_id: 'pump-1',
    meter_reading: 10500
  })
];
const perOrderAudit2 = calculatePerOrderMeterVariance('pump-1', 10650, 100, ordersWithP2, 10000, 20);
assert(perOrderAudit2.previousReading === 10500, 'Per-order meter: detects latest prior order reading 10500');
assert(perOrderAudit2.meterDelta === 150, 'Per-order meter: delta is 150L (10650 - 10500)');
assert(perOrderAudit2.variance === 50, 'Per-order meter: variance is +50L (150 - 100)');
assert(perOrderAudit2.isOverThreshold === true, 'Per-order meter: correctly flags variance > 20L');

// 13. TANK DIPSTICK PHYSICAL VERIFICATION
const dipstickValid = calculateDipstickVariance(5015, 5000, 30);
assert(dipstickValid.variance === 15, 'Dipstick verification: variance is +15L');
assert(dipstickValid.isOverThreshold === false, 'Dipstick verification: 15L is within 30L threshold');

const dipstickHigh = calculateDipstickVariance(4940, 5000, 30);
assert(dipstickHigh.variance === -60, 'Dipstick verification: variance is -60L');
assert(dipstickHigh.isOverThreshold === true, 'Dipstick verification: -60L exceeds 30L threshold');

// 14. SHIFT RECONCILIATION & CLOSEOUT
const shiftBalanced = calculateShiftSummary(20000, 180000, 30000, 170000);
assert(shiftBalanced.expectedCash === 170000, 'Shift summary: expected cash is ₦170,000');
assert(shiftBalanced.cashVariance === 0, 'Shift summary: balanced cash variance is 0');
assert(shiftBalanced.hasVariance === false, 'Shift summary: hasVariance is false');

const shiftDiscrepancy = calculateShiftSummary(20000, 180000, 30000, 165000);
assert(shiftDiscrepancy.cashCounted === 165000, 'Shift summary: cash counted is ₦165,000');
assert(shiftDiscrepancy.cashVariance === -5000, 'Shift summary: cash variance is -₦5,000 (shortfall)');
assert(shiftDiscrepancy.hasVariance === true, 'Shift summary: hasVariance is true for ₦5,000 discrepancy');

// 15. DEPOT TIMEZONE DAY BUCKETS (Africa/Lagos, UTC+1)
assert(depotDateKey('2026-09-08T23:30:00Z') === '2026-09-09', 'Depot day: late-UTC evening rolls into next Lagos day');
assert(depotDateKey('2026-09-08T10:00:00Z') === '2026-09-08', 'Depot day: daytime stays on same Lagos day');
assert(/^\d{4}-\d{2}-\d{2}$/.test(getDepotToday()), 'Depot day: getDepotToday returns YYYY-MM-DD');

// 16. SHIFT CASH — single source of truth
const scShift = { start_time: '2026-09-08T07:00:00Z', end_time: null, opening_float: 20000 };
const scOrders: Order[] = [
  mkOrder({ id: 'sc-1', customer_id: 'c-test', product_id: 'veg', qty: 100, litres: 100, amount: 480000, paid_amount: 480000, payment_method: 'cash', date: '2026-09-08T09:00:00Z' }),
  mkOrder({ id: 'sc-2', customer_id: 'c-test', product_id: 'veg', qty: 50, litres: 50, amount: 240000, paid_amount: 240000, payment_method: 'transfer', date: '2026-09-08T10:00:00Z' }),
  mkOrder({ id: 'sc-3', customer_id: 'c-test', product_id: 'veg', qty: 10, litres: 10, amount: 48000, paid_amount: 48000, payment_method: 'cash', date: '2026-09-08T06:00:00Z' }),
  mkOrder({ id: 'sc-4', customer_id: 'c-test', product_id: 'veg', qty: 20, litres: 20, amount: 96000, paid_amount: 96000, payment_method: 'cash', date: '2026-09-08T12:00:00Z', voided: true })
];
const scExpenses = [{ date: '2026-09-08T08:00:00Z', amount: 5000 }, { date: '2026-09-08T06:00:00Z', amount: 9999 }];
const sc = computeShiftCash(scShift, scOrders, scExpenses, new Date('2026-09-08T18:00:00Z'));
assert(sc.cashSales === 480000, 'Shift cash: only in-window non-voided cash orders counted');
assert(sc.cashExpenses === 5000, 'Shift cash: only in-window expenses counted');
assert(sc.expectedCash === 495000, 'Shift cash: expected = 20000 + 480000 - 5000');

// 17. CUSTOMER STORE CREDIT (overpayment ledger)
const creditCustomer: Customer = { id: 'c-credit', name: 'Credit Cust', type: 'agent', credit_limit: 100000, credit_term_days: 14, phone: '0800' };
const creditEntries = [
  { id: 'cc-1', customer_id: 'c-credit', amount: 28000, created_at: '2026-09-08T10:00:00Z' },
  { id: 'cc-2', customer_id: 'c-credit', amount: -10000, created_at: '2026-09-09T10:00:00Z' },
  { id: 'cc-3', customer_id: 'c-other', amount: 5000, created_at: '2026-09-09T10:00:00Z' }
];
const creditStats = calculateCustomerStats(creditCustomer, [], [], [], new Date('2026-09-10T00:00:00Z'), creditEntries);
assert(creditStats.creditBalance === 18000, 'Store credit: 28000 added - 10000 redeemed = 18000 for this customer only');

// 18. PRE-KEGGED INTAKE METRICS (Palm Oil - No tons, exact volume)
const preKegged = calculatePreKeggedIntakeMetrics(100, 25);
assert(preKegged.exactLitres === 2500, 'Pre-kegged intake: 100 kegs * 25L = 2,500L exact volume');
assert(preKegged.kegsReceived === 100, 'Pre-kegged intake: kegs received preserved as 100');

// 19. OUTRIGHT CONTAINER PURCHASE + KEG INVENTORY
const purchasedOrders: Order[] = [
  mkOrder({
    id: 'ord-pur-1',
    customer_id: 'c-test',
    product_id: 'veg',
    pack_size_id: 'sz_30',
    qty: 15,
    litres: 450,
    amount: 2250000,
    paid_amount: 2250000,
    payment_method: 'cash',
    container_mode: 'bought',
    date: '2026-09-09T10:00:00Z'
  })
];
const invWithPurchased = calculateKegInventory(500, purchasedOrders, []);
assert(invWithPurchased.totalKegsOut === 0, 'Outright container inventory: zero return debt created');
assert(invWithPurchased.kegsAtDepot === 485, 'Outright container inventory: depot stock reduced by 15 (500 - 15 = 485)');

// 20. SHIFT-START METER HARD GATE (Bulk pumps only; pre-kegged palm never blocks the gate)
const testPumps: Pump[] = [
  { id: 'pump-1', label: 'Pump 1 (Veg Line 1)', last_meter_reading: 1000, product_id: 'veg' },
  { id: 'pump-2', label: 'Pump 2 (Veg Line 2)', last_meter_reading: 2000, product_id: 'veg' },
  { id: 'pump-3', label: 'Legacy Pump (Palm Line)', last_meter_reading: 3000, product_id: 'red' }
];

const shiftMissing: Shift = {
  id: 'shift-test-1',
  status: 'open',
  cashier_name: 'Counter Cashier',
  start_time: '2026-09-09T08:00:00Z',
  end_time: null,
  opening_float: 50000,
  opening_readings: { 'pump-1': 1000 }
};
const gateCheckFail = checkShiftOpeningMetersGate(shiftMissing, testPumps);
assert(gateCheckFail.isPassed === false, 'Shift meter gate: blocked when bulk pump-2 is missing');
assert(gateCheckFail.missingPumps.length === 1 && gateCheckFail.missingPumps[0].id === 'pump-2', 'Shift meter gate: accurately identifies pump-2 as missing (and ignores pre-kegged palm)');

const shiftComplete: Shift = {
  ...shiftMissing,
  opening_readings: { 'pump-1': 1000, 'pump-2': 2000 }
};
const gateCheckPass = checkShiftOpeningMetersGate(shiftComplete, testPumps);
assert(gateCheckPass.isPassed === true, 'Shift meter gate: unlocked when all bulk pumps logged without requiring palm oil');
assert(gateCheckPass.missingPumps.length === 0, 'Shift meter gate: zero missing pumps on pass');

// 21. PER-PRODUCT LITRES PER KEG (Veg 30L vs Palm 25L)
assert(calculateLitres('keg', 10, 30) === 300, 'Per-product capacity: 10 veg kegs (30L) = 300L');
assert(calculateLitres('keg', 10, 25) === 250, 'Per-product capacity: 10 palm kegs (25L) = 250L');

// 22b. CUSTOMER RUNNING STATEMENT
const stmtCustomer: Customer = { id: 'c-stmt', name: 'Statement Cust', type: 'agent', credit_limit: 200000, credit_term_days: 14, phone: '0800' };
const stmtOrders: Order[] = [
  mkOrder({
    id: 'st-1', sale_id: 'sale-st-1', customer_id: 'c-stmt', product_id: 'veg', pack_size_id: 'sz_25',
    qty: 4, litres: 100, amount: 100000, line_amount: 100000, oil_amount: 100000, paid_amount: 0,
    payment_method: 'credit', container_mode: 'taken', date: '2026-09-01T09:00:00Z', due_date: '2026-09-15T09:00:00Z'
  }),
  mkOrder({
    id: 'st-2', sale_id: 'sale-st-2', customer_id: 'c-stmt', product_id: 'veg', pack_size_id: 'sz_25',
    qty: 2, litres: 50, amount: 50000, line_amount: 50000, oil_amount: 50000, paid_amount: 50000,
    payment_method: 'cash', container_mode: 'none', date: '2026-09-03T09:00:00Z'
  })
];
const stmtPayments: Payment[] = [
  { id: 'pay-st-1', customer_id: 'c-stmt', amount: 30000, method: 'transfer', date: '2026-09-05T10:00:00Z', applied_to: [{ order_id: 'st-1', amount: 30000 }], overpayment_to_credit: 0, source: 'payment' }
];
const stmtReturns: KegReturn[] = [
  { id: 'kr-st-1', customer_id: 'c-stmt', product_id: 'veg', pack_size_id: 'sz_25', qty: 1, date: '2026-09-06T10:00:00Z' }
];
const statement = buildCustomerStatement(stmtCustomer, stmtOrders, stmtPayments, [], stmtReturns);
assert(statement.length === 4, 'Statement: 2 sales + 1 payment + 1 keg return = 4 rows');
assert(statement[0].kind === 'keg_return' && statement[0].kegBalance === 3, 'Statement: newest first; 4 taken - 1 returned = 3 kegs on loan');
const oldest = statement[statement.length - 1];
assert(oldest.kind === 'sale' && oldest.debit === 100000 && oldest.runningBalance === 100000, 'Statement: first credit sale owes ₦100,000');
const paymentRow = statement.find(r => r.kind === 'payment');
assert(!!paymentRow && paymentRow.credit === 30000 && paymentRow.runningBalance === 70000, 'Statement: ₦30,000 payment leaves ₦70,000 owed');
const cashSaleRow = statement.find(r => r.label.includes('(cash)'));
assert(!!cashSaleRow && cashSaleRow.debit === 0, 'Statement: a cash sale does not add to the owed balance');

// 23. AMOUNT IN WORDS (receipt spell-out)
assert(formatNairaWords(0) === 'Zero naira only', 'Amount words: zero');
assert(formatNairaWords(1385000) === 'One million, three hundred and eighty-five thousand naira only', 'Amount words: 1,385,000');
assert(formatNairaWords(4500) === 'Four thousand, five hundred naira only', 'Amount words: 4,500');
assert(formatNairaWords(215) === 'Two hundred and fifteen naira only', 'Amount words: 215');

console.log('====================================================');
console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');
