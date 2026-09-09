import {
  Tank,
  Product,
  Supplier,
  Order,
  Customer,
  CustomerCalculatedStats,
  KegInventorySummary,
  PumpVarianceAudit,
  Shift,
  AppSettings
} from '../../types';
import { SystemSnapshot } from './types';

interface ExtractParams {
  tanks: Tank[];
  products: Product[];
  suppliers: Supplier[];
  orders: Order[];
  customers: Customer[];
  customerStatsMap: Record<string, CustomerCalculatedStats>;
  kegInventory: KegInventorySummary;
  todayStats: {
    cashTransferSales: number;
    creditOutstanding: number;
    companyKegsOut: number;
    kegsAtDepot: number;
    kegsSoldToday: number;
    purchasedKegsToday: number;
    customerKegsFilledToday: number;
    expensesToday: number;
    dailyFloatRemaining: number;
  };
  activeAlerts: {
    overdueCredit: { customer: Customer; overdueDays: number; amount: number }[];
    overLimit: { customer: Customer; balance: number; limit: number; excess: number }[];
    deliveryShortfall: { tank: Tank; shortfallLitres: number }[];
    pumpVariance: PumpVarianceAudit[];
    totalAlertCount: number;
  };
  pumpVarianceAudits: PumpVarianceAudit[];
  shifts: Shift[];
  settings: AppSettings;
}

export function extractSystemSnapshot(params: ExtractParams): SystemSnapshot {
  const {
    tanks,
    products,
    suppliers,
    orders,
    customers,
    customerStatsMap,
    kegInventory,
    todayStats,
    activeAlerts,
    pumpVarianceAudits,
    shifts,
    settings
  } = params;

  // 1. Tank Stock by Product
  const vegTanks = tanks.filter(t => t.product_id === 'golden_oil_30l');
  const palmTanks = tanks.filter(t => t.product_id === 'red_oil_25l');

  const vegLitres = vegTanks.reduce((acc, t) => acc + (t.remaining_litres || 0), 0);
  const palmLitres = palmTanks.reduce((acc, t) => acc + (t.remaining_litres || 0), 0);
  const totalLitres = vegLitres + palmLitres;

  // 2. Velocity & Burn Rate (Litres per day estimate)
  // Calculate average daily litres over available orders
  const vegOrders = orders.filter(o => o.product_id === 'golden_oil_30l');
  const palmOrders = orders.filter(o => o.product_id === 'red_oil_25l');

  const totalVegSold = vegOrders.reduce((sum, o) => sum + (o.litres || 0), 0);
  const totalPalmSold = palmOrders.reduce((sum, o) => sum + (o.litres || 0), 0);

  // Use a minimum 1-day divisor for safety, estimate daily velocity
  const vegDailyBurn = totalVegSold > 0 ? Math.max(Math.round(totalVegSold / 7), 250) : 350;
  const palmDailyBurn = totalPalmSold > 0 ? Math.max(Math.round(totalPalmSold / 7), 100) : 150;

  const vegRunwayDays = vegDailyBurn > 0 ? Math.round((vegLitres / vegDailyBurn) * 10) / 10 : 99;
  const palmRunwayDays = palmDailyBurn > 0 ? Math.round((palmLitres / palmDailyBurn) * 10) / 10 : 99;

  // 3. Customer Credit & Debt Risk
  const topDebtors = Object.values(customerStatsMap)
    .filter(stats => stats.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance)
    .slice(0, 5)
    .map(stats => ({
      name: stats.customer.name,
      balanceNaira: stats.currentBalance,
      overdueDays: stats.agingBadge.days,
      creditLimitNaira: stats.customer.credit_limit,
      phone: stats.customer.phone
    }));

  const totalDebtOwed = Object.values(customerStatsMap).reduce(
    (acc, stats) => acc + stats.currentBalance,
    0
  );

  // 4. Keg Inventory Exposure
  const outrightKegPrice = 3500; // standard replacement cost in Lagos
  const unreturnedValueExposureNaira = kegInventory.totalKegsOut * outrightKegPrice;

  const highKegHolders = Object.values(customerStatsMap)
    .filter(stats => stats.totalCompanyKegsOut > 0)
    .sort((a, b) => b.totalCompanyKegsOut - a.totalCompanyKegsOut)
    .slice(0, 5)
    .map(stats => ({
      name: stats.customer.name,
      kegsOut: stats.totalCompanyKegsOut,
      unreturnedDays: stats.agingBadge.days,
      financialRiskNaira: stats.totalCompanyKegsOut * outrightKegPrice
    }));

  // 5. Loss Prevention Audit
  const pumpVariances = pumpVarianceAudits.map(audit => ({
    pumpId: audit.pumpId,
    pumpName: audit.pumpLabel,
    expectedLitres: audit.expectedLitres,
    actualMeterLitres: audit.meterDelta,
    varianceLitres: audit.variance,
    alert: audit.isOverThreshold
  }));

  const intakeShortfalls = tanks
    .filter(t => (t.shortfall || 0) > 0)
    .map(t => {
      const supplier = suppliers.find(s => s.id === t.supplier_id);
      const isVeg = t.product_id === 'golden_oil_30l';
      const estimatedRate = isVeg ? 3500 : 3000;
      return {
        truckOrWaybill: t.truck_label,
        supplier: supplier?.name || 'Bulk Hauler',
        product: isVeg ? 'Golden Vegetable Oil' : 'Red Palm Oil',
        shortfallLitres: t.shortfall,
        estimatedLossNaira: t.shortfall * estimatedRate
      };
    });

  const shiftDiscrepancies = shifts
    .filter(s => s.cash_variance !== null && s.cash_variance !== undefined && s.cash_variance !== 0)
    .slice(0, 5)
    .map(s => ({
      shiftId: s.id,
      date: s.start_time.split('T')[0] || s.start_time,
      cashier: s.cashier_name || 'Cashier',
      discrepancyNaira: s.cash_variance || 0
    }));

  // 6. Pricing and Product Structure
  const productsSummary = products.map(p => {
    const isVeg = p.id === 'golden_oil_30l' || p.id === 'veg';
    const retailRate = isVeg ? 3500 : 3000;
    return {
      id: p.id,
      name: p.name,
      supplyModel: p.supply_model,
      litresPerKeg: p.litres_per_keg,
      retailPricePerLitre: retailRate,
      effectiveRetailKegPrice: retailRate * p.litres_per_keg,
      kegSellPrice: p.keg_sell_price || undefined
    };
  });

  return {
    timestamp: new Date().toISOString(),
    depotSummary: {
      totalLitres,
      vegLitres,
      palmLitres,
      kegsAtDepot: kegInventory.kegsAtDepot,
      totalFleet: kegInventory.totalCompanyKegs,
      kegsWithCustomers: kegInventory.totalKegsOut
    },
    todayPerformance: {
      cashSalesNaira: todayStats.cashTransferSales,
      creditSalesNaira: todayStats.creditOutstanding,
      totalRevenueNaira: todayStats.cashTransferSales + todayStats.creditOutstanding,
      kegsSoldToday: todayStats.kegsSoldToday,
      purchasedKegsToday: todayStats.purchasedKegsToday,
      customerKegsFilledToday: todayStats.customerKegsFilledToday,
      expensesTodayNaira: todayStats.expensesToday,
      dailyFloatRemainingNaira: todayStats.dailyFloatRemaining,
      activeAlertsCount: activeAlerts.totalAlertCount
    },
    inventoryVelocity: {
      veg: {
        currentLitres: vegLitres,
        dailyBurnRateLitres: vegDailyBurn,
        daysRunway: vegRunwayDays,
        lowStockThresholdLitres: settings.low_stock_litres_threshold || 1000,
        tankCount: vegTanks.length
      },
      palm: {
        currentLitres: palmLitres,
        dailyBurnRateLitres: palmDailyBurn,
        daysRunway: palmRunwayDays,
        lowStockThresholdLitres: settings.low_stock_litres_threshold || 1000,
        tankCount: palmTanks.length
      }
    },
    creditRiskAnalysis: {
      totalDebtOwedNaira: totalDebtOwed,
      overdueCount: activeAlerts.overdueCredit.length,
      overLimitCount: activeAlerts.overLimit.length,
      topDebtors
    },
    kegExposureAnalysis: {
      totalKegsOut: kegInventory.totalKegsOut,
      unreturnedValueExposureNaira,
      highKegHolders
    },
    lossPreventionAudit: {
      pumpVariances,
      intakeShortfalls,
      shiftDiscrepancies
    },
    pricingAndProducts: {
      products: productsSummary
    }
  };
}
