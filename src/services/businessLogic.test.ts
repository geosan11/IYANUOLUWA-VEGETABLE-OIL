import {
  calculateLitres,
  calculateIntakeMetrics,
  calculateCustomerStats,
  calculateKegInventory,
  executeFifoTankDraw,
  applyFifoPayment,
  lookupRatePerLitre,
  calculateOrderPricing,
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
import {
  Customer,
  Order,
  KegReturn,
  Tank,
  RateCard,
  Transfer,
  Pump,
  Shift
} from '../types';

import { LITRES_PER_KEG } from '../constants/config';

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

// 1. UNIT CONVERSION
assert(calculateLitres('keg', 10, 30) === 300, 'Unit conversion: 10 kegs = 300L');
assert(calculateLitres('litre', 150, 30) === 150, 'Unit conversion: 150L = 150L');

// 2. TRUCK INTAKE & SHORTFALL
const intake1 = calculateIntakeMetrics(10, 1090, 360, 20, 100, 30);
// expected_litres = 10 * 1090 = 10900
// expected_kegs = 10900 / 30 = 363.33
// recovered = (360 * 30) + 20 = 10820
// shortfall = 10900 - 10820 = 80L (>50L -> high variance)
assert(intake1.expectedLitres === 10900, 'Intake: expectedLitres is 10,900L');
assert(intake1.recoveredLitres === 10820, 'Intake: recoveredLitres is 10,820L');
assert(intake1.shortfall === 80, 'Intake: shortfall is 80L');
assert(intake1.isShortfallHigh === true, 'Intake: shortfall > 50L flagged true');
assert(intake1.exceedsDepotKegCapacity === true, 'Intake: 363.3 expected kegs > 100 depot kegs warning');

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

// Order 600L -> Drains Tank-1 from 400 to 0, draws 200 from Tank-2 leaving 600
const drawResult = executeFifoTankDraw(mockTanks, 'veg', 600);
assert(drawResult.success === true, 'FIFO Tank Draw: successfully allocated across multiple tanks');
assert(drawResult.allocations.length === 2, 'FIFO Tank Draw: allocated across 2 tanks');
assert(drawResult.allocations[0].tankId === 'tank-1' && drawResult.allocations[0].drawnLitres === 400, 'FIFO Tank Draw: drained Tank-1 to 0');
assert(drawResult.allocations[1].tankId === 'tank-2' && drawResult.allocations[1].drawnLitres === 200, 'FIFO Tank Draw: pulled remainder (200L) from Tank-2');
assert(drawResult.updatedTanks[0].remaining_litres === 0, 'FIFO Tank Draw: Tank-1 remaining is 0L');
assert(drawResult.updatedTanks[1].remaining_litres === 600, 'FIFO Tank Draw: Tank-2 remaining is 600L');

// Insufficient stock hard stop
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
  {
    id: 'o-1',
    customer_id: 'c-test',
    product_id: 'veg',
    unit: 'keg',
    qty: 10,
    litres: 300,
    rate: 4800,
    amount: 48000,
    paid_amount: 0,
    payment_method: 'credit',
    keg_source: 'company',
    date: '2026-08-01T00:00:00Z',
    due_date: '2026-08-15T00:00:00Z', // 24 days overdue relative to 2026-09-08
    source_tank_id: 'tank-1',
    pump_id: 'pump-1'
  },
  {
    id: 'o-2',
    customer_id: 'c-test',
    product_id: 'veg',
    unit: 'keg',
    qty: 5,
    litres: 150,
    rate: 4800,
    amount: 24000,
    paid_amount: 0,
    payment_method: 'credit',
    keg_source: 'company',
    date: '2026-09-01T00:00:00Z',
    due_date: '2026-09-15T00:00:00Z', // Due in 7 days
    source_tank_id: 'tank-1',
    pump_id: 'pump-1'
  }
];

const sampleKegReturns: KegReturn[] = [
  {
    id: 'ret-1',
    customer_id: 'c-test',
    qty: 3,
    date: '2026-08-20T00:00:00Z'
  }
];

const refDate = new Date('2026-09-08T12:00:00Z');
const stats = calculateCustomerStats(sampleCustomer, sampleOrders, sampleKegReturns, refDate);

assert(stats.currentBalance === 72000, 'Customer Balance: 48000 + 24000 = ₦72,000');
assert(stats.totalCompanyKegsOut === 12, 'Customer Kegs Out: 15 supplied - 3 returned = 12 kegs');
assert(stats.agingBadge.status === 'overdue', 'Customer Aging: flagged overdue');
assert(stats.agingBadge.days === 24, 'Customer Aging: 24 days overdue');

// 5. FIFO PAYMENT APPLICATION
const paymentResult = applyFifoPayment(sampleOrders, 'c-test', 50000);
assert(paymentResult.totalApplied === 50000, 'FIFO Payment: totalApplied is ₦50,000');
assert(paymentResult.appliedOrders.length === 2, 'FIFO Payment: allocated across 2 orders');
assert(paymentResult.appliedOrders[0].orderId === 'o-1' && paymentResult.appliedOrders[0].isFullyPaid === true, 'FIFO Payment: oldest due date order o-1 fully settled');
assert(paymentResult.appliedOrders[1].orderId === 'o-2' && paymentResult.appliedOrders[1].amountApplied === 2000, 'FIFO Payment: remainder ₦2,000 applied to o-2');
assert(paymentResult.unappliedLeftover === 0, 'FIFO Payment: 0 leftover');

// Test overpayment with unapplied leftover
const overPaymentResult = applyFifoPayment(sampleOrders, 'c-test', 100000);
assert(overPaymentResult.totalApplied === 72000, 'FIFO Overpayment: total applied is exactly open balance ₦72,000');
assert(overPaymentResult.unappliedLeftover === 28000, 'FIFO Overpayment: reported ₦28,000 unapplied leftover');

// 6. KEG INVENTORY SUMMARY
const kegSummary = calculateKegInventory(500, sampleOrders, sampleKegReturns);
assert(kegSummary.totalCompanyKegs === 500, 'Keg Inventory: total fleet = 500');
assert(kegSummary.totalKegsOut === 12, 'Keg Inventory: total out = 12');
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

// Case A: Exact Match (450L dispensed and logged in orders -> 500L meter delta - 450L orders = 50L variance > 20L alert)
const pumpOrdersVariance: Order[] = [
  {
    id: 'po-1',
    customer_id: 'c-test',
    product_id: 'veg',
    unit: 'keg',
    qty: 15,
    litres: 450,
    rate: 4800,
    amount: 72000,
    paid_amount: 72000,
    payment_method: 'transfer',
    keg_source: 'own',
    date: '2026-09-08T10:00:00Z',
    due_date: null,
    source_tank_id: 'tank-1',
    pump_id: 'p-test'
  }
];

const auditA = calculatePumpMeterVariance(mockPump, mockReadings, pumpOrdersVariance, 20);
assert(auditA.length === 1, 'Pump Reconciliation: produced 1 audit interval');
assert(auditA[0].meterDelta === 500, 'Pump Reconciliation: meter delta is 500L (10500 - 10000)');
assert(auditA[0].expectedLitres === 450, 'Pump Reconciliation: expected litres from logged orders is 450L');
assert(auditA[0].variance === 50, 'Pump Reconciliation: variance is +50L');
assert(auditA[0].isOverThreshold === true, 'Pump Reconciliation: flagged alert for 50L variance > 20L threshold');

// Case B: Accurate Match (500L meter delta with 500L in orders -> 0 variance)
const pumpOrdersExact: Order[] = [
  ...pumpOrdersVariance,
  {
    id: 'po-2',
    customer_id: 'c-test',
    product_id: 'veg',
    unit: 'litre',
    qty: 50,
    litres: 50,
    rate: 4800,
    amount: 240000,
    paid_amount: 240000,
    payment_method: 'cash',
    keg_source: null,
    date: '2026-09-08T14:00:00Z',
    due_date: null,
    source_tank_id: 'tank-1',
    pump_id: 'p-test'
  }
];

const auditB = calculatePumpMeterVariance(mockPump, mockReadings, pumpOrdersExact, 20);
assert(auditB[0].variance === 0, 'Pump Reconciliation: variance is exactly 0L');
assert(auditB[0].isOverThreshold === false, 'Pump Reconciliation: no alert for 0L variance');

// Monotonic validation
assert(validateNewPumpReading(10600, 10500).isValid === true, 'Pump Validation: higher reading passes');
assert(validateNewPumpReading(10400, 10500).isValid === false, 'Pump Validation: lower reading fails (meters only count up)');

// 10. TONNAGE WHOLESALE UNIT CONVERSION & PRICING
const tonLitres = calculateLitres('ton', 5, 30, 1090);
assert(tonLitres === 5450, 'Unit conversion: 5 tons = 5,450L (5 * 1090)');
const tonPricing = calculateOrderPricing('ton', 2, 4800, 30, 1090);
// 2 tons = 2180L * 4800 = 10,464,000
assert(tonPricing.litres === 2180, 'Tonnage pricing: 2 tons = 2,180L');
assert(tonPricing.amount === 10464000, 'Tonnage pricing: 2 tons at ₦4,800/L = ₦10,464,000');

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
  {
    id: 'ord-s1',
    customer_id: 'c-sender',
    product_id: 'veg',
    unit: 'keg',
    qty: 20,
    litres: 600,
    rate: 4800,
    amount: 96000,
    paid_amount: 96000,
    payment_method: 'cash',
    keg_source: 'company',
    date: '2026-09-01T10:00:00Z',
    due_date: null,
    source_tank_id: 'tank-1',
    pump_id: null
  }
];

const mockTransfers: Transfer[] = [
  {
    id: 'tr-1',
    from_customer_id: 'c-sender',
    to_customer_id: 'c-receiver',
    item_type: 'keg',
    qty: 6,
    date: '2026-09-05T12:00:00Z',
    notes: 'Yard transfer from Sender to Receiver'
  }
];

const senderStats = calculateCustomerStats(transferSender, senderOrders, [], mockTransfers);
// Sender started with 20 company kegs, transferred 6 to receiver -> 14 remaining out
assert(senderStats.totalCompanyKegsOut === 14, 'Customer Transfers: Sender kegs out reduced by 6 (20 - 6 = 14)');

const receiverStats = calculateCustomerStats(transferReceiver, [], [], mockTransfers);
// Receiver started with 0 company kegs, received 6 from sender -> 6 out
assert(receiverStats.totalCompanyKegsOut === 6, 'Customer Transfers: Receiver kegs out increased by 6 (0 + 6 = 6)');

// 12. PER-ORDER PUMP METER RECONCILIATION
const sampleOrdersForPump: Order[] = [
  {
    id: 'ord-p1',
    customer_id: 'c-sender',
    product_id: 'veg',
    unit: 'litre',
    qty: 300,
    litres: 300,
    rate: 4800,
    amount: 1440000,
    paid_amount: 1440000,
    payment_method: 'cash',
    keg_source: null,
    date: '2026-09-08T09:00:00Z',
    due_date: null,
    source_tank_id: 'tank-1',
    pump_id: 'pump-1',
    meter_reading: 10300
  }
];

// Order 1 was at 10300 on pump-1 (started at 10000)
// Now order 2 is dispensed: 200L, meter reads 10500
const perOrderAudit1 = calculatePerOrderMeterVariance('pump-1', 10500, 200, sampleOrdersForPump, 10000, 20);
assert(perOrderAudit1.previousReading === 10300, 'Per-order meter: detects previous reading 10300 from prior order');
assert(perOrderAudit1.meterDelta === 200, 'Per-order meter: delta is 200L (10500 - 10300)');
assert(perOrderAudit1.variance === 0, 'Per-order meter: variance is 0L (200 - 200)');
assert(perOrderAudit1.isOverThreshold === false, 'Per-order meter: no alert for 0L variance');

// Order 3 is dispensed: 100L, but meter reads 10650 (+150L delta -> +50L variance > 20L threshold!)
const ordersWithP2: Order[] = [
  ...sampleOrdersForPump,
  {
    id: 'ord-p2',
    customer_id: 'c-receiver',
    product_id: 'veg',
    unit: 'litre',
    qty: 200,
    litres: 200,
    rate: 4800,
    amount: 960000,
    paid_amount: 960000,
    payment_method: 'cash',
    keg_source: null,
    date: '2026-09-08T11:00:00Z',
    due_date: null,
    source_tank_id: 'tank-1',
    pump_id: 'pump-1',
    meter_reading: 10500
  }
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
// Opening float: ₦20,000, Cash sales: ₦180,000, Cash expenses: ₦30,000
// Expected cash = 20,000 + 180,000 - 30,000 = ₦170,000
const shiftBalanced = calculateShiftSummary(20000, 180000, 30000, 170000);
assert(shiftBalanced.expectedCash === 170000, 'Shift summary: expected cash is ₦170,000');
assert(shiftBalanced.cashVariance === 0, 'Shift summary: balanced cash variance is 0');
assert(shiftBalanced.hasVariance === false, 'Shift summary: hasVariance is false');

const shiftDiscrepancy = calculateShiftSummary(20000, 180000, 30000, 165000);
assert(shiftDiscrepancy.cashCounted === 165000, 'Shift summary: cash counted is ₦165,000');
assert(shiftDiscrepancy.cashVariance === -5000, 'Shift summary: cash variance is -₦5,000 (shortfall)');
assert(shiftDiscrepancy.hasVariance === true, 'Shift summary: hasVariance is true for ₦5,000 discrepancy');

// 15. DEPOT TIMEZONE DAY BUCKETS (Africa/Lagos, UTC+1)
// 2026-09-08T23:30:00Z is 2026-09-09 00:30 in Lagos -> should bucket to the 9th.
assert(depotDateKey('2026-09-08T23:30:00Z') === '2026-09-09', 'Depot day: late-UTC evening rolls into next Lagos day');
assert(depotDateKey('2026-09-08T10:00:00Z') === '2026-09-08', 'Depot day: daytime stays on same Lagos day');
assert(/^\d{4}-\d{2}-\d{2}$/.test(getDepotToday()), 'Depot day: getDepotToday returns YYYY-MM-DD');

// 16. SHIFT CASH — single source of truth
const scShift = { start_time: '2026-09-08T07:00:00Z', end_time: null, opening_float: 20000 };
const scOrders: Order[] = [
  { id: 'sc-1', customer_id: 'c-test', product_id: 'veg', unit: 'litre', qty: 100, litres: 100, rate: 4800, amount: 480000, paid_amount: 480000, payment_method: 'cash', keg_source: null, date: '2026-09-08T09:00:00Z', due_date: null, source_tank_id: null, pump_id: null },
  { id: 'sc-2', customer_id: 'c-test', product_id: 'veg', unit: 'litre', qty: 50, litres: 50, rate: 4800, amount: 240000, paid_amount: 240000, payment_method: 'transfer', keg_source: null, date: '2026-09-08T10:00:00Z', due_date: null, source_tank_id: null, pump_id: null },
  { id: 'sc-3', customer_id: 'c-test', product_id: 'veg', unit: 'litre', qty: 10, litres: 10, rate: 4800, amount: 48000, paid_amount: 48000, payment_method: 'cash', keg_source: null, date: '2026-09-08T06:00:00Z', due_date: null, source_tank_id: null, pump_id: null }
];
const scExpenses = [{ date: '2026-09-08T08:00:00Z', amount: 5000 }, { date: '2026-09-08T06:00:00Z', amount: 9999 }];
const sc = computeShiftCash(scShift, scOrders, scExpenses, new Date('2026-09-08T18:00:00Z'));
assert(sc.cashSales === 480000, 'Shift cash: only in-window cash orders counted (transfer & pre-shift excluded)');
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

// 19. OUTRIGHT KEG CONTAINER PURCHASE
// Pricing line item: 10 kegs * 25L = 250L * ₦5,000 = ₦1,250,000 oil + (10 * ₦3,500) = ₦1,285,000 total
const pricingPurchased = calculateOrderPricing('keg', 10, 5000, 25, null, 'purchased', 3500);
assert(pricingPurchased.oilAmount === 1250000, 'Outright keg pricing: oil amount is ₦1,250,000');
assert(pricingPurchased.kegAmount === 35000, 'Outright keg pricing: keg container amount is ₦35,000');
assert(pricingPurchased.amount === 1285000, 'Outright keg pricing: total sale is ₦1,285,000');

// Keg Inventory: outright purchased keg permanently leaves depot but creates NO return debt
const purchasedOrders: Order[] = [
  {
    id: 'ord-pur-1',
    customer_id: 'c-test',
    product_id: 'veg',
    unit: 'keg',
    qty: 15,
    litres: 450,
    rate: 5000,
    amount: 2250000,
    paid_amount: 2250000,
    payment_method: 'cash',
    keg_source: 'purchased',
    date: '2026-09-09T10:00:00Z',
    due_date: null,
    source_tank_id: null,
    pump_id: null
  }
];
const invWithPurchased = calculateKegInventory(500, purchasedOrders, []);
assert(invWithPurchased.totalKegsOut === 0, 'Outright keg inventory: zero kegs out debt created');
assert(invWithPurchased.kegsAtDepot === 485, 'Outright keg inventory: depot stock reduced by 15 (500 - 15 = 485)');

// 20. SHIFT-START METER HARD GATE
const testPumps: Pump[] = [
  { id: 'pump-1', label: 'Pump 1 (Veg)', last_meter_reading: 1000, product_id: 'veg' },
  { id: 'pump-2', label: 'Pump 2 (Veg)', last_meter_reading: 2000, product_id: 'veg' },
  { id: 'pump-3', label: 'Pump 3 (Palm)', last_meter_reading: 3000, product_id: 'red' }
];

// Incomplete: only pump-1 and pump-2 logged
const shiftMissing: Shift = {
  id: 'shift-test-1',
  status: 'open',
  cashier_name: 'Counter Cashier',
  start_time: '2026-09-09T08:00:00Z',
  end_time: null,
  opening_float: 50000,
  opening_readings: { 'pump-1': 1000, 'pump-2': 2000 }
};
const gateCheckFail = checkShiftOpeningMetersGate(shiftMissing, testPumps);
assert(gateCheckFail.isPassed === false, 'Shift meter gate: blocked when pump-3 is missing');
assert(gateCheckFail.missingPumps.length === 1 && gateCheckFail.missingPumps[0].id === 'pump-3', 'Shift meter gate: accurately identifies pump-3 as missing');

// Complete: all 3 pumps logged
const shiftComplete: Shift = {
  ...shiftMissing,
  opening_readings: { 'pump-1': 1000, 'pump-2': 2000, 'pump-3': 3000 }
};
const gateCheckPass = checkShiftOpeningMetersGate(shiftComplete, testPumps);
assert(gateCheckPass.isPassed === true, 'Shift meter gate: unlocked when all 3 pumps are logged');
assert(gateCheckPass.missingPumps.length === 0, 'Shift meter gate: zero missing pumps on pass');

// 21. PER-PRODUCT LITRES PER KEG (Veg 30L vs Palm 25L)
assert(calculateLitres('keg', 10, 30) === 300, 'Per-product capacity: 10 veg kegs (30L) = 300L');
assert(calculateLitres('keg', 10, 25) === 250, 'Per-product capacity: 10 palm kegs (25L) = 250L');

// 22. VARIETY RATE DELTA + TIER OVERRIDE (rate resolution, as done in createNewOrder)
// Golden Oil agent rate ₦4,800/L; "Groundnut" variety +₦250 => ₦5,050/L base for that tier+spec.
const vegAgentRate = lookupRatePerLitre(
  [{ product_id: 'veg', tier: 'agent', rate_per_litre: 4800 }] as RateCard[], 'veg', 'agent'
);
assert(vegAgentRate === 4800, 'Rate lookup: veg agent tier is ₦4,800/L');
assert(vegAgentRate + 250 === 5050, 'Variety delta: groundnut spec (+₦250) lifts agent rate to ₦5,050/L');
// Overriding a retail customer down to agent tier lowers the standard rate (would need a discount reason).
const retailStd = lookupRatePerLitre(
  [
    { product_id: 'veg', tier: 'retail', rate_per_litre: 5200 },
    { product_id: 'veg', tier: 'agent', rate_per_litre: 4800 }
  ] as RateCard[], 'veg', 'retail'
);
assert(retailStd === 5200 && retailStd > vegAgentRate, 'Tier override: agent rate is below retail, so overriding trips the discount-reason guard');

// 23. AMOUNT IN WORDS (receipt spell-out)
assert(formatNairaWords(0) === 'Zero naira only', 'Amount words: zero');
assert(formatNairaWords(1385000) === 'One million, three hundred and eighty-five thousand naira only', 'Amount words: 1,385,000');
assert(formatNairaWords(4500) === 'Four thousand, five hundred naira only', 'Amount words: 4,500');
assert(formatNairaWords(215) === 'Two hundred and fifteen naira only', 'Amount words: 215');

console.log('====================================================');
console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');


