/**
 * Unit Test Suite for AI Operations Intelligence System
 * Tests data extraction, deterministic audit engine, model switching, and copilot Q&A
 */

import { extractSystemSnapshot } from './dataExtractor';
import { runDeterministicOperationsAudit, answerCopilotQuestionDeterministic } from './deterministicEngine';
import { AVAILABLE_MODELS } from './types';
import { DEFAULT_SETTINGS, DEFAULT_SUPPLIERS } from '../../constants/config';
import {
  Tank,
  Product,
  PackPrice,
  Order,
  Customer,
  CustomerCalculatedStats,
  KegInventorySummary,
  PumpVarianceAudit,
  Shift,
  AppSettings
} from '../../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✓ PASS: ${msg}`);
  }
}

console.log('====================================================');
console.log('RUNNING AI OPERATIONS INTELLIGENCE TEST SUITE');
console.log('====================================================');

// Mock data setup
const mockTanks: Tank[] = [
  {
    id: 'tank-1',
    product_id: 'golden_oil_30l',
    truck_label: 'TRK-VEG-01',
    tons: 10,
    received_litres: 10750,
    remaining_litres: 2500,
    date: '2026-09-08',
    shortfall: 80,
    supplier_id: 'sup-1',
    supply_model: 'bulk_truck'
  },
  {
    id: 'tank-2',
    product_id: 'red_oil_25l',
    truck_label: 'PALM-DELIVERY-01',
    tons: 0,
    received_litres: 2500,
    remaining_litres: 1250,
    date: '2026-09-08',
    shortfall: 0,
    supplier_id: 'sup-2',
    supply_model: 'pre_kegged'
  }
];

/* ---------------------------------------------------------------------------
 * DEPOT-OWNED CATALOGUE
 * Nothing in this app ships with a product, a pack price or a sales history —
 * they are all blank by default (DEFAULT_PRODUCTS / DEFAULT_PACK_PRICES are
 * `[]`). The test therefore supplies them, and every naira/rate/threshold the
 * AI quotes below must trace back to THIS data rather than to a built-in
 * figure.
 * ------------------------------------------------------------------------- */
const mockProducts: Product[] = [
  {
    id: 'golden_oil_30l',
    name: 'Golden Vegetable Oil',
    supply_model: 'bulk_truck',
    litres_per_ton: 1075,
    litres_per_keg: 30,
    keg_sell_price: 42000,
    varieties: [{ id: 'var-golden-std', name: 'Standard' }],
    pack_config: [
      { pack_size_id: 'sz_30', returnable: false, container_buy_price: 0, sort: 0 },
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 2000, sort: 1 }
    ],
    color_light: '#f59e0b',
    color_dark: '#b45309'
  },
  {
    id: 'red_oil_25l',
    name: 'Red Palm Oil',
    supply_model: 'pre_kegged',
    litres_per_ton: null,
    litres_per_keg: 25,
    keg_sell_price: 28000,
    varieties: [{ id: 'var-red-std', name: 'Standard' }],
    pack_config: [
      { pack_size_id: 'sz_25', returnable: true, container_buy_price: 2000, sort: 0 }
    ],
    color_light: '#ef4444',
    color_dark: '#7f1d1d'
  }
];

// Retail tier only for the counter rate: 186,000 ÷ 30L = ₦6,200/L (veg) and
// 100,000 ÷ 25L = ₦4,000/L (palm). The agent-tier row exists purely to prove the
// engine reads the RETAIL tier and each product's OWN pack price.
const mockPackPrices: PackPrice[] = [
  { product_id: 'golden_oil_30l', variety_id: 'var-golden-std', pack_size_id: 'sz_30', tier: 'retail', price: 186000 },
  { product_id: 'golden_oil_30l', variety_id: 'var-golden-std', pack_size_id: 'sz_30', tier: 'agent', price: 150000 },
  { product_id: 'red_oil_25l', variety_id: 'var-red-std', pack_size_id: 'sz_25', tier: 'retail', price: 100000 }
];

/** One historical sale line — only `product_id` and `litres` feed velocity. */
function mockOrder(
  id: string,
  productId: string,
  varietyId: string,
  packSizeId: string,
  qty: number,
  litres: number,
  unitPrice: number
): Order {
  return {
    id,
    sale_id: `sale-${id}`,
    customer_id: 'cust-1',
    product_id: productId,
    variety_id: varietyId,
    variety_name: 'Standard',
    pack_size_id: packSizeId,
    qty,
    litres,
    unit_price: unitPrice,
    original_unit_price: unitPrice,
    price_adjusted: false,
    price_adjust_reason: null,
    oil_amount: qty * unitPrice,
    container_mode: 'taken',
    returnable: true,
    container_unit_price: 2000,
    container_amount: null,
    line_amount: qty * unitPrice,
    amount: qty * unitPrice,
    pricing_tier: 'retail',
    payment_method: 'cash',
    paid_amount: qty * unitPrice,
    due_date: null,
    date: '2026-09-09',
    source_tank_id: null,
    pump_id: null,
    hub_id: 'hub-1'
  };
}

// 6,720L veg + 1,225L palm over the last 7 days => 960L/day and 175L/day burn.
// Against 2,500L / 1,250L on hand that is a 2.6-day and 7.1-day runway, both
// still above the depot's own 1,000L low-stock threshold, so no dry-out alert
// fires and the reorder advice must be driven by that threshold, not by a
// built-in day count.
const mockOrders: Order[] = [
  mockOrder('line-1', 'golden_oil_30l', 'var-golden-std', 'sz_30', 112, 3360, 186000),
  mockOrder('line-2', 'golden_oil_30l', 'var-golden-std', 'sz_30', 112, 3360, 186000),
  mockOrder('line-3', 'red_oil_25l', 'var-red-std', 'sz_25', 20, 500, 100000),
  mockOrder('line-4', 'red_oil_25l', 'var-red-std', 'sz_25', 20, 500, 100000),
  mockOrder('line-5', 'red_oil_25l', 'var-red-std', 'sz_25', 9, 225, 100000)
];

const mockCustomer: Customer = {
  id: 'cust-1',
  name: 'Mama Nkechi Enterprises',
  phone: '08031234567',
  type: 'retail',
  credit_limit: 50000,
  credit_term_days: 7
};

const mockCustomerStatsMap: Record<string, CustomerCalculatedStats> = {
  'cust-1': {
    customer: mockCustomer,
    currentBalance: 72000, // over limit & overdue
    creditBalance: 0,
    totalCompanyKegsOut: 15,
    kegsOutByPack: { 'veg|sz_30': 15 },
    agingBadge: {
      status: 'overdue',
      label: '24d Overdue',
      days: 24,
      colorClass: 'text-rose-600'
    },
    openOrders: []
  }
};

const mockKegInventory: KegInventorySummary = {
  totalCompanyKegs: 500,
  totalKegsOut: 25,
  kegsAtDepot: 475,
  isDepotStockCritical: false
};

const mockPumpVarianceAudits: PumpVarianceAudit[] = [
  {
    pumpId: 'pump-2',
    pumpLabel: 'Pump 2 (Golden Veg)',
    startReading: 10000,
    endReading: 10500,
    meterDelta: 500,
    expectedLitres: 450,
    variance: 50, // +50L variance over 20L threshold
    isOverThreshold: true,
    startDate: '2026-09-09',
    endDate: '2026-09-09',
    day: '2026-09-09'
  }
];

const mockShifts: Shift[] = [
  {
    id: 'shift-1',
    start_time: '2026-09-09T08:00:00Z',
    end_time: '2026-09-09T18:00:00Z',
    opening_float: 20000,
    cashier_name: 'John Cashier',
    cash_variance: -5000,
    status: 'closed'
  }
];

const mockSettings: AppSettings = {
  company_name: 'Iyanuoluwa Digital Operations',
  company_phone: '08012345678',
  company_address: 'Alaba Rago, Ojo, Lagos',
  company_logo_url: null,
  litres_per_keg: 30,
  default_litres_per_ton: 1075,
  total_company_kegs: 500,
  kegs_at_depot_low_threshold: 20,
  low_stock_litres_threshold: 1000,
  truck_shortfall_threshold: 50,
  pump_variance_threshold: 20,
  shift_start_time: '07:00',
  shift_end_time: '18:00'
};

// ---------------------------------------------------------------------------
// TEST 1: Extract System Snapshot
// ---------------------------------------------------------------------------
const snapshot = extractSystemSnapshot({
  tanks: mockTanks,
  products: mockProducts,
  packPrices: mockPackPrices,
  suppliers: DEFAULT_SUPPLIERS,
  orders: mockOrders,
  customers: [mockCustomer],
  customerStatsMap: mockCustomerStatsMap,
  kegInventory: mockKegInventory,
  todayStats: {
    cashTransferSales: 450000,
    creditOutstanding: 72000,
    companyKegsOut: 25,
    kegsAtDepot: 475,
    kegsSoldToday: 15,
    purchasedKegsToday: 3,
    customerKegsFilledToday: 12,
    expensesToday: 5000
  },
  activeAlerts: {
    overdueCredit: [{ customer: mockCustomer, overdueDays: 24, amount: 72000 }],
    overLimit: [{ customer: mockCustomer, balance: 72000, limit: 50000, excess: 22000 }],
    deliveryShortfall: [{ tank: mockTanks[0], shortfallLitres: 80 }],
    pumpVariance: mockPumpVarianceAudits,
    totalAlertCount: 4
  },
  pumpVarianceAudits: mockPumpVarianceAudits,
  shifts: mockShifts,
  settings: mockSettings
});

assert(snapshot.depotSummary.totalLitres === 3750, 'Snapshot calculates total litres accurately (2500 + 1250 = 3750L)');
assert(snapshot.depotSummary.vegLitres === 2500, 'Snapshot identifies veg stock as 2500L');
assert(snapshot.depotSummary.palmLitres === 1250, 'Snapshot identifies palm stock as 1250L');
assert(snapshot.creditRiskAnalysis.totalDebtOwedNaira === 72000, 'Snapshot captures customer debt ₦72,000');
assert(snapshot.creditRiskAnalysis.topDebtors[0].name === 'Mama Nkechi Enterprises', 'Snapshot identifies top delinquent customer');
assert(snapshot.lossPreventionAudit.pumpVariances.length === 1, 'Snapshot captures pump variance audit record');
assert(snapshot.lossPreventionAudit.pumpVariances[0].varianceLitres === 50, 'Snapshot records +50L pump variance');
assert(snapshot.lossPreventionAudit.intakeShortfalls.length === 1, 'Snapshot captures bulk delivery shortfall (80L)');

// --- Every rate/threshold must come from the depot's own configuration ------
assert(
  snapshot.pricingAndProducts.counterRatePerLitre === 6200,
  'Counter rate is derived from the depot retail pack price ÷ pack litres (186,000 ÷ 30L = ₦6,200/L)'
);
assert(
  snapshot.pricingAndProducts.products.find(p => p.id === 'golden_oil_30l')?.retailPricePerLitre === 6200,
  'Veg product is rated at its own retail pack price, not the sibling product nor the wholesale tier'
);
assert(
  snapshot.pricingAndProducts.products.find(p => p.id === 'red_oil_25l')?.retailPricePerLitre === 4000,
  'Palm product is rated at its own retail pack price (100,000 ÷ 25L = ₦4,000/L)'
);
assert(
  snapshot.lossPreventionAudit.pumpVarianceThresholdLitres === 20,
  'Pump variance tolerance is read from Settings (pump_variance_threshold), not built in'
);
assert(
  snapshot.inventoryVelocity.veg.lowStockThresholdLitres === 1000 &&
    snapshot.inventoryVelocity.palm.lowStockThresholdLitres === 1000,
  'Low-stock litre threshold is read from Settings (low_stock_litres_threshold)'
);
assert(
  snapshot.depotSummary.kegsAtDepotLowThreshold === 20,
  'Keg yard low-stock threshold is read from Settings (kegs_at_depot_low_threshold)'
);
assert(
  snapshot.kegExposureAnalysis.unreturnedValueExposureNaira === 0,
  'No naira keg exposure is invented while no outright keg price is configured'
);
assert(
  snapshot.lossPreventionAudit.intakeShortfalls[0].estimatedLossNaira === 496000,
  'Intake shortfall is valued at THAT product own retail rate (80L × ₦6,200/L = ₦496,000)'
);

// --- Velocity is measured from real sales, never assumed --------------------
assert(
  snapshot.inventoryVelocity.veg.dailyBurnRateLitres === 960 &&
    snapshot.inventoryVelocity.palm.dailyBurnRateLitres === 175,
  'Burn rate is measured from recorded order litres (6,720L ÷ 7 = 960L/day, 1,225L ÷ 7 = 175L/day)'
);

// ---------------------------------------------------------------------------
// TEST 2: Deterministic Operations Audit Engine
// ---------------------------------------------------------------------------
const auditReport = runDeterministicOperationsAudit(snapshot, 'claude');

assert(auditReport.depotHealthScore < 85, 'Health score penalizes delinquent debt, pump variance, and supplier shortfall');
assert(auditReport.healthVerdict !== 'optimal', 'Health verdict flags attention needed due to multiple depot risks');
assert(auditReport.keyFindings.length >= 3, 'Audit generates detailed key findings across credit, pumps, and shortfalls');

const creditDecision = auditReport.actionableDecisions.find(d => d.category === 'credit');
assert(creditDecision !== undefined, 'Audit generates actionable credit freeze decision');
assert(creditDecision?.priority === 'P1 - Immediate', 'Credit risk prioritized as P1 - Immediate');

const pumpDecision = auditReport.actionableDecisions.find(d => d.category === 'loss_prevention');
assert(pumpDecision !== undefined, 'Audit generates actionable pump inspection decision');
assert(pumpDecision?.priority === 'P1 - Immediate', 'Pump leakage prioritized as P1 - Immediate');

const intakeDecision = auditReport.actionableDecisions.find(d => d.category === 'inventory');
assert(intakeDecision !== undefined, 'Audit generates supplier shortfall debit note decision');

assert(auditReport.inventoryForecasts.length === 2, 'Audit produces runway forecasts for both Veg and Palm Oil');
assert(auditReport.lossPreventionItems.length >= 2, 'Audit produces loss prevention item list with calculated Naira exposure');

// --- Reorder advice is threshold-derived, never a built-in day count --------
assert(
  auditReport.inventoryForecasts[0].estimatedDaysLeft === 2.6,
  'Veg runway is computed from measured burn rate (2,500L ÷ 960L/day = 2.6 days)'
);
assert(
  auditReport.inventoryForecasts[1].estimatedDaysLeft === 7.1,
  'Palm runway is computed from measured burn rate (1,250L ÷ 175L/day = 7.1 days)'
);
assert(
  auditReport.inventoryForecasts[1].reorderRecommendation.startsWith('WARNING') &&
    auditReport.inventoryForecasts[1].reorderRecommendation.includes('1,000L'),
  'Palm reorder trigger cites the depot own 1,000L threshold instead of a hardcoded day count'
);
assert(
  auditReport.inventoryForecasts[0].reorderRecommendation.startsWith('HEALTHY'),
  'Veg reorder advice is HEALTHY: stock covers 2.6 days vs the 1,000L (1 day of cover) threshold'
);
assert(
  auditReport.inventoryForecasts.every(f => !f.reorderRecommendation.match(/\b(72 hours|30-ton|25–30 tons)\b/)) === true,
  'No built-in tonnage or 72-hour lead time leaks into the reorder advice'
);

// --- Every naira figure in the report traces back to configured pricing -----
const pumpLossItem = auditReport.lossPreventionItems.find(i => i.source === 'pumps');
assert(
  pumpLossItem?.lossAmount.includes('310,000') === true,
  'Pump leakage is valued at the depot own counter rate (50L × ₦6,200/L = ₦310,000)'
);
const intakeLossItem = auditReport.lossPreventionItems.find(i => i.source === 'intake');
assert(
  intakeLossItem?.lossAmount.includes('496,000') === true,
  'Intake shortfall exposure uses the configured rate, not a built-in ₦/L figure'
);
const kegFinding = auditReport.keyFindings.find(f => f.title.startsWith('Returnable Keg Exposure'));
assert(
  kegFinding !== undefined && !kegFinding.detail.includes('₦'),
  'Keg exposure finding quotes no naira figure at all until an outright keg price is set'
);
assert(
  auditReport.actionableDecisions.every(
    d => d.expectedFinancialImpactNaira === undefined || d.expectedFinancialImpactNaira > 0
  ) === true,
  'No decision is ever sized at an invented ₦0'
);

// ---------------------------------------------------------------------------
// TEST 3: Claude Model Configuration
// ---------------------------------------------------------------------------
assert(AVAILABLE_MODELS.length >= 2, 'Provides at least 2 Claude models');
assert(AVAILABLE_MODELS.every(m => m.provider === 'claude'), 'Includes Anthropic Claude models exclusively');

// ---------------------------------------------------------------------------
// TEST 4: Copilot Interactive Q&A
// ---------------------------------------------------------------------------
const debtAnswer = answerCopilotQuestionDeterministic('Who owes us money right now?', snapshot);
assert(debtAnswer.includes('Mama Nkechi Enterprises'), 'Copilot identifies top debtor in response');
assert(debtAnswer.includes('72,000'), 'Copilot cites exact debt amount in response');

const pumpAnswer = answerCopilotQuestionDeterministic('Is Pump 2 leaking or unmetered?', snapshot);
assert(pumpAnswer.includes('Pump 2') && pumpAnswer.includes('50L'), 'Copilot cites specific pump variance numbers');

const tankAnswer = answerCopilotQuestionDeterministic('When should we book our next oil tanker?', snapshot);
assert(tankAnswer.includes('Golden Vegetable Oil') && tankAnswer.includes('runway'), 'Copilot provides inventory runway analysis');

// ---------------------------------------------------------------------------
// TEST 5: A brand-new, unconfigured depot is never quoted an invented figure
// ---------------------------------------------------------------------------
const unconfiguredSnapshot = extractSystemSnapshot({
  tanks: mockTanks,
  products: [],
  packPrices: [],
  suppliers: DEFAULT_SUPPLIERS,
  orders: [],
  customers: [mockCustomer],
  customerStatsMap: mockCustomerStatsMap,
  kegInventory: mockKegInventory,
  todayStats: {
    cashTransferSales: 0,
    creditOutstanding: 0,
    companyKegsOut: 0,
    kegsAtDepot: 0,
    kegsSoldToday: 0,
    purchasedKegsToday: 0,
    customerKegsFilledToday: 0,
    expensesToday: 0
  },
  activeAlerts: {
    overdueCredit: [],
    overLimit: [],
    deliveryShortfall: [{ tank: mockTanks[0], shortfallLitres: 80 }],
    pumpVariance: mockPumpVarianceAudits,
    totalAlertCount: 2
  },
  pumpVarianceAudits: mockPumpVarianceAudits,
  shifts: [],
  settings: { ...DEFAULT_SETTINGS }
});

assert(
  unconfiguredSnapshot.pricingAndProducts.counterRatePerLitre === 0,
  'Unconfigured depot reports a 0 counter rate (0 = not configured, never a real rate)'
);
assert(
  unconfiguredSnapshot.inventoryVelocity.veg.lowStockThresholdLitres === 0 &&
    unconfiguredSnapshot.depotSummary.kegsAtDepotLowThreshold === 0,
  'Unconfigured depot reports 0 thresholds instead of app-supplied default numbers'
);

const unconfiguredReport = runDeterministicOperationsAudit(unconfiguredSnapshot, 'claude');
const unconfiguredPumpLoss = unconfiguredReport.lossPreventionItems.find(i => i.source === 'pumps');
assert(
  unconfiguredPumpLoss?.lossAmount.includes('no ₦ value yet') === true,
  'Pump leakage is stated in litres only while no retail pack price exists'
);
assert(
  unconfiguredReport.actionableDecisions.every(d => d.expectedFinancialImpactNaira === undefined) === true,
  'An unconfigured depot is given no naira-sized decision at all (never a ₦0 impact)'
);
assert(
  unconfiguredReport.inventoryForecasts.every(f => f.reorderRecommendation.startsWith('NO DATA')) === true,
  'With no sales history the audit refuses to project a dry-out date'
);
assert(
  unconfiguredReport.inventoryForecasts.every(f => !f.reorderRecommendation.match(/\d+\s?days?\b/)) === true,
  'No invented day count reaches the reorder advice for an unconfigured depot'
);

const unconfiguredMarketAnswer = answerCopilotQuestionDeterministic(
  'What is the current CPO market price?',
  unconfiguredSnapshot
);
assert(
  unconfiguredMarketAnswer.includes('No products configured yet') && !unconfiguredMarketAnswer.includes('₦'),
  'Copilot admits there is no configured pricing and no live market feed instead of quoting a rate'
);

console.log('====================================================');
console.log('AI TEST SUITE RESULTS: ALL TESTS PASSED (100%)');
console.log('====================================================');
