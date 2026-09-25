import {
  Tank,
  Product,
  Supplier,
  Order,
  Customer,
  CustomerCalculatedStats,
  KegInventorySummary,
  PackPrice,
  PumpVarianceAudit,
  Shift,
  AppSettings
} from '../../types';
import { retailRatePerLitre, retailRatePerLitreByProduct } from '../pricing';
import { SystemSnapshot } from './types';

interface ExtractParams {
  tanks: Tank[];
  products: Product[];
  packPrices: PackPrice[];
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
    packPrices,
    suppliers,
    orders,
    customerStatsMap,
    kegInventory,
    todayStats,
    activeAlerts,
    pumpVarianceAudits,
    shifts,
    settings
  } = params;

  // 0. Counter rate — the depot's own retail price per litre, derived from the
  // owner's pack-price matrix (retail pack price ÷ that pack's litres). No ₦/L
  // rate is built into this app: 0 means "no retail pack priced yet", and every
  // money figure downstream is omitted rather than invented when it is 0.
  const counterRatePerLitre = retailRatePerLitre(packPrices);
  const retailRateByProduct = retailRatePerLitreByProduct(packPrices);

  // 1. Tank Stock by Product
  // The depot names its own products, so nothing here may assume a particular
  // product id exists: bulk (tank-fed) products are the tank side of the
  // snapshot, everything else is the pre-kegged/keg side. On a depot that has
  // not been configured yet both sets are empty and every figure below stays
  // honestly at 0 instead of describing products that aren't there.
  const bulkProductIds = new Set(
    products.filter(p => p.supply_model === 'bulk_truck').map(p => p.id)
  );
  const vegTanks = tanks.filter(t => bulkProductIds.has(t.product_id));
  const palmTanks = tanks.filter(t => !bulkProductIds.has(t.product_id));

  const vegLitres = vegTanks.reduce((acc, t) => acc + (t.remaining_litres || 0), 0);
  const palmLitres = palmTanks.reduce((acc, t) => acc + (t.remaining_litres || 0), 0);
  const totalLitres = vegLitres + palmLitres;

  // 2. Velocity & Burn Rate (Litres per day estimate)
  // Calculate average daily litres over available orders
  const vegOrders = orders.filter(o => bulkProductIds.has(o.product_id));
  const palmOrders = orders.filter(o => !bulkProductIds.has(o.product_id));

  const totalVegSold = vegOrders.reduce((sum, o) => sum + (o.litres || 0), 0);
  const totalPalmSold = palmOrders.reduce((sum, o) => sum + (o.litres || 0), 0);

  // Velocity is derived only from actual sales over the last week. With no
  // orders yet there is no burn rate to report, so it is 0 rather than an
  // invented litres-per-day figure.
  const vegDailyBurn = totalVegSold > 0 ? Math.round(totalVegSold / 7) : 0;
  const palmDailyBurn = totalPalmSold > 0 ? Math.round(totalPalmSold / 7) : 0;

  // 0 = "unknown" here, matching the 0/'' unconfigured contract used across the
  // app: a depot with no sales history has no runway to state.
  const vegRunwayDays = vegDailyBurn > 0 ? Math.round((vegLitres / vegDailyBurn) * 10) / 10 : 0;
  const palmRunwayDays = palmDailyBurn > 0 ? Math.round((palmLitres / palmDailyBurn) * 10) / 10 : 0;

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
  // Valued at the depot's own configured outright keg price. Unset = 0, so the
  // advisory reports no figure rather than an invented Lagos replacement cost.
  const outrightKegPrice = settings.outright_keg_price || 0;
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
      // Valued at the depot's own counter rate for THAT product (retail pack
      // price ÷ pack litres). 0 = the product has no retail price yet, so the
      // shortfall is reported in litres only — never at an invented ₦/L rate.
      const estimatedRate = retailRateByProduct[t.product_id] ?? 0;
      return {
        truckOrWaybill: t.truck_label,
        supplier: supplier?.name || 'Bulk Hauler',
        // The product's real name — never a guessed 'Golden Vegetable Oil'.
        product: products.find(p => p.id === t.product_id)?.name || t.product_id,
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
  // Every retail figure comes out of the owner's own pack-price matrix. A
  // product with no retail pack priced yet reports 0 for both fields, which the
  // prompts read as "not configured" instead of quoting a rate nobody set.
  const productsSummary = products.map(p => {
    const retailRate = retailRateByProduct[p.id] ?? 0;
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
      kegsWithCustomers: kegInventory.totalKegsOut,
      kegsAtDepotLowThreshold: settings.kegs_at_depot_low_threshold || 0
    },
    todayPerformance: {
      cashSalesNaira: todayStats.cashTransferSales,
      creditSalesNaira: todayStats.creditOutstanding,
      totalRevenueNaira: todayStats.cashTransferSales + todayStats.creditOutstanding,
      kegsSoldToday: todayStats.kegsSoldToday,
      purchasedKegsToday: todayStats.purchasedKegsToday,
      customerKegsFilledToday: todayStats.customerKegsFilledToday,
      expensesTodayNaira: todayStats.expensesToday,
      activeAlertsCount: activeAlerts.totalAlertCount
    },
    inventoryVelocity: {
      veg: {
        currentLitres: vegLitres,
        dailyBurnRateLitres: vegDailyBurn,
        daysRunway: vegRunwayDays,
        lowStockThresholdLitres: settings.low_stock_litres_threshold || 0,
        tankCount: vegTanks.length
      },
      palm: {
        currentLitres: palmLitres,
        dailyBurnRateLitres: palmDailyBurn,
        daysRunway: palmRunwayDays,
        lowStockThresholdLitres: settings.low_stock_litres_threshold || 0,
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
      pumpVarianceThresholdLitres: settings.pump_variance_threshold || 0,
      pumpVariances,
      intakeShortfalls,
      shiftDiscrepancies
    },
    pricingAndProducts: {
      counterRatePerLitre,
      products: productsSummary
    }
  };
}
