/**
 * AI Operations Intelligence & Executive Advisor Types
 * Scalable multi-provider interface supporting Gemini, Claude, or Dual Comparison ("Both")
 */

export type AIProviderType = 'gemini' | 'claude' | 'both';

export interface AIModelOption {
  id: string;
  name: string;
  provider: 'gemini' | 'claude';
  description: string;
  speed: 'Ultra Fast' | 'Fast' | 'Balanced';
  badge?: string;
}

export const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Google high-speed multimodal model with instant throughput for depot operations',
    speed: 'Ultra Fast',
    badge: 'Recommended'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Google advanced reasoning model for deep forensic accounting & logistics audits',
    speed: 'Balanced'
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'claude',
    description: 'Anthropic flagship intelligence model with nuanced operational strategy',
    speed: 'Fast',
    badge: 'Strategic'
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
  };
  todayPerformance: {
    cashSalesNaira: number;
    creditSalesNaira: number;
    totalRevenueNaira: number;
    kegsSoldToday: number;
    purchasedKegsToday: number;
    customerKegsFilledToday: number;
    expensesTodayNaira: number;
    dailyFloatRemainingNaira: number;
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
    unreturnedValueExposureNaira: number; // calculated at outright price (e.g. ₦3,500/keg)
    highKegHolders: {
      name: string;
      kegsOut: number;
      unreturnedDays: number;
      financialRiskNaira: number;
    }[];
  };
  lossPreventionAudit: {
    pumpVariances: {
      pumpId: string;
      pumpName: string;
      expectedLitres: number;
      actualMeterLitres: number;
      varianceLitres: number;
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
    products: {
      id: string;
      name: string;
      supplyModel: string;
      litresPerKeg: number;
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
  comparison?: {
    geminiInsights?: string;
    claudeInsights?: string;
    consensusAgreement: string;
  };
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
  geminiModel?: string;
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
