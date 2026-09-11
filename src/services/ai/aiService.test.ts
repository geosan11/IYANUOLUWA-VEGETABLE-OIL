/**
 * Unit Test Suite for AI Operations Intelligence System
 * Tests data extraction, deterministic audit engine, model switching, and copilot Q&A
 */

import { extractSystemSnapshot } from './dataExtractor';
import { runDeterministicOperationsAudit, answerCopilotQuestionDeterministic } from './deterministicEngine';
import { AVAILABLE_MODELS } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_SUPPLIERS } from '../../constants/config';
import { Tank, Customer, CustomerCalculatedStats, KegInventorySummary, PumpVarianceAudit, Shift, AppSettings } from '../../types';

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
  total_company_kegs: 500,
  kegs_at_depot_low_threshold: 20,
  low_stock_litres_threshold: 1000,
  truck_shortfall_threshold: 50,
  pump_variance_threshold: 20,
  dipstick_variance_threshold: 30,
  default_daily_float: 20000,
  daily_float: 20000
};

// ---------------------------------------------------------------------------
// TEST 1: Extract System Snapshot
// ---------------------------------------------------------------------------
const snapshot = extractSystemSnapshot({
  tanks: mockTanks,
  products: DEFAULT_PRODUCTS,
  suppliers: DEFAULT_SUPPLIERS,
  orders: [],
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
    expensesToday: 5000,
    dailyFloatRemaining: 15000
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

// ---------------------------------------------------------------------------
// TEST 2: Deterministic Operations Audit Engine
// ---------------------------------------------------------------------------
const auditReport = runDeterministicOperationsAudit(snapshot, 'gemini');

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

// ---------------------------------------------------------------------------
// TEST 3: Multi-Provider Model Configuration & Dual Comparison
// ---------------------------------------------------------------------------
const dualReport = runDeterministicOperationsAudit(snapshot, 'both');
assert(dualReport.comparison !== undefined, 'Dual mode produces consensus and comparative insights');
assert(typeof dualReport.comparison?.consensusAgreement === 'string', 'Dual mode produces synthesized consensus agreement');

assert(AVAILABLE_MODELS.length >= 4, 'Provides at least 4 models across Gemini and Claude');
assert(AVAILABLE_MODELS.some(m => m.provider === 'gemini'), 'Includes Google Gemini models');
assert(AVAILABLE_MODELS.some(m => m.provider === 'claude'), 'Includes Anthropic Claude models');

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

console.log('====================================================');
console.log('AI TEST SUITE RESULTS: ALL TESTS PASSED (100%)');
console.log('====================================================');
