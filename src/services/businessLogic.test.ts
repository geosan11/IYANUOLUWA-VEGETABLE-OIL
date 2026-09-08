import {
  calculateLitres,
  calculateIntakeMetrics,
  calculateCustomerStats,
  calculateKegInventory,
  executeFifoTankDraw,
  applyFifoPayment,
  lookupRatePerLitre,
  calculateOrderPricing
} from './businessLogic';
import {
  Customer,
  Order,
  KegReturn,
  Tank,
  RateCard
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
import { calculatePumpMeterVariance, validateNewPumpReading } from './businessLogic';

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

console.log('====================================================');
console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');

