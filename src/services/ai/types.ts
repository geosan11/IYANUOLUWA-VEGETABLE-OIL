/**
 * AI Operations Intelligence & Executive Advisor Types
 * Scalable multi-provider interface supporting Gemini, Claude, or Dual Comparison ("Both")
 */

export type AIProviderType = 'claude';

export interface AIModelOption {
  id: string;
  name: string;
  provider: 'claude';
  description: string;
  speed: 'Ultra Fast' | 'Fast' | 'Balanced';
  badge?: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'claude',
    description: 'Anthropic flagship intelligence model with nuanced operational strategy',
    speed: 'Fast',
    badge: 'Recommended'
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'claude',
    description: 'Anthropic lightweight model for rapid answers & fast KPI summaries',
    speed: 'Ultra Fast'
  }
];

export interface SystemSnapshot {
  timestamp: string;
  depotSummary: {
    totalLitres: number;
    vegLitres: number;
    palmLitres: number;
    kegsAtDepot: number;
    totalFleet: number;
    kegsWithCustomers: number;
    /** The depot's own `kegs_at_depot_low_threshold`; 0 = none configured. */
    kegsAtDepotLowThreshold: number;
  };
  todayPerformance: {
    cashSalesNaira: number;
    creditSalesNaira: number;
    totalRevenueNaira: number;
    kegsSoldToday: number;
    purchasedKegsToday: number;
    customerKegsFilledToday: number;
    expensesTodayNaira: number;
    activeAlertsCount: number;
  };
  inventoryVelocity: {
    veg: {
      currentLitres: number;
      dailyBurnRateLitres: number;
      daysRunway: number;
      lowStockThresholdLitres: number;
      tankCount: number;
    };
    palm: {
      currentLitres: number;
      dailyBurnRateLitres: number;
      daysRunway: number;
      lowStockThresholdLitres: number;
      tankCount: number;
    };
  };
  creditRiskAnalysis: {
    totalDebtOwedNaira: number;
    overdueCount: number;
    overLimitCount: number;
    topDebtors: {
      name: string;
      balanceNaira: number;
      overdueDays: number;
      creditLimitNaira: number;
      phone: string;
    }[];
  };
  kegExposureAnalysis: {
    totalKegsOut: number;
    /** Kegs out × the depot's own configured `outright_keg_price` (0 when unset). */
    unreturnedValueExposureNaira: number;
    highKegHolders: {
      name: string;
      kegsOut: number;
      unreturnedDays: number;
      financialRiskNaira: number;
    }[];
  };
  lossPreventionAudit: {
    /** The depot's own `pump_variance_threshold`; 0 = none configured. */
    pumpVarianceThresholdLitres: number;
    pumpVariances: {
      pumpId: string;
      pumpName: string;
      expectedLitres: number;
      actualMeterLitres: number;
      varianceLitres: number;
      /** Carried from the depot's configured threshold — never re-guessed here. */
      alert: boolean;
    }[];
    intakeShortfalls: {
      truckOrWaybill: string;
      supplier: string;
      product: string;
      shortfallLitres: number;
      estimatedLossNaira: number;
    }[];
    shiftDiscrepancies: {
      shiftId: string;
      date: string;
      cashier: string;
      discrepancyNaira: number;
    }[];
  };
  pricingAndProducts: {
    /**
     * Depot-wide counter rate per litre, derived from the owner's retail pack
     * prices (`retailRatePerLitre`). 0 = no retail pack priced yet, so no money
     * figure may be quoted from it.
     */
    counterRatePerLitre: number;
    products: {
      id: string;
      name: string;
      supplyModel: string;
      litresPerKeg: number;
      /** This product's own retail pack price ÷ pack litres; 0 = not priced. */
      retailPricePerLitre: number;
      effectiveRetailKegPrice: number;
      kegSellPrice?: number;
    }[];
  };
}

export interface AIKeyFinding {
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  metric?: string;
}

export interface AIActionableDecision {
  id: string;
  category: 'inventory' | 'pricing' | 'credit' | 'loss_prevention' | 'operations';
  priority: 'P1 - Immediate' | 'P2 - This Week' | 'P3 - Strategic';
  action: string;
  rationale: string;
  expectedFinancialImpactNaira?: number;
  impactDescription: string;
  ownerActionRole: 'Managing Director' | 'Depot Cashier' | 'Driver / Yardman';
}

export interface AIInventoryForecast {
  productName: string;
  currentStockL: number;
  burnRatePerDayL: number;
  estimatedDaysLeft: number;
  reorderRecommendation: string;
  criticalWarning: boolean;
}

export interface AILossPreventionItem {
  source: 'pumps' | 'intake' | 'cash_drawer';
  description: string;
  lossAmount: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface AIAnalysisReport {
  id: string;
  timestamp: string;
  providerUsed: AIProviderType;
  modelName: string;
  depotHealthScore: number; // 0 to 100
  healthVerdict: 'critical' | 'attention_needed' | 'good' | 'optimal';
  executiveSummary: string;
  keyFindings: AIKeyFinding[];
  actionableDecisions: AIActionableDecision[];
  inventoryForecasts: AIInventoryForecast[];
  lossPreventionItems: AILossPreventionItem[];
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  provider?: AIProviderType;
}

export interface AIRequestPayload {
  action: 'audit' | 'chat';
  provider: AIProviderType;
  claudeModel?: string;
  snapshot: SystemSnapshot;
  chatMessage?: string;
  chatHistory?: { role: 'user' | 'assistant'; text: string }[];
}

export interface AIResponsePayload {
  success: boolean;
  providerUsed: AIProviderType;
  modelName: string;
  report?: AIAnalysisReport;
  chatReply?: string;
  error?: string;
  source: 'vercel_serverless' | 'local_deterministic';
}
