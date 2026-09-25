import {
  SystemSnapshot,
  AIAnalysisReport,
  AIProviderType,
  AIKeyFinding,
  AIActionableDecision,
  AIInventoryForecast,
  AILossPreventionItem
} from './types';

/**
 * Quoted whenever a stock bucket has no recorded sales to measure a burn rate
 * from. No dry-out date may be invented for a depot that has not sold anything.
 */
const NO_SALES_HISTORY =
  'NO DATA: no sales recorded yet, so no burn rate or runway can be projected.';

/**
 * How far above the depot's own `low_stock_litres_threshold` a product may sit
 * and still count as "approaching" the reorder trigger rather than sitting clear
 * of it. The owner's threshold is the ONLY reorder trigger this engine knows
 * about — it is never swapped for a built-in day count, tonnage or lead time.
 */
const REORDER_WARNING_BAND = 2;

/**
 * Every naira figure in the snapshot is 0 when the owner has not configured the
 * pricing it would come from. 0 therefore means "not configured" and must never
 * be quoted as though it were a valuation, so it collapses to `undefined`.
 */
function configuredNaira(value: number): number | undefined {
  return value > 0 ? value : undefined;
}

/**
 * The depot names its own products, so the two stock buckets are labelled from
 * the owner's catalogue (bulk/tank-fed vs pre-kegged/container) instead of from
 * hardcoded product names that may not exist on this depot.
 */
function stockBucketName(snapshot: SystemSnapshot, bulkTruck: boolean): string {
  const match = snapshot.pricingAndProducts.products.find(p =>
    bulkTruck ? p.supplyModel === 'bulk_truck' : p.supplyModel !== 'bulk_truck'
  );
  if (match) return match.name;
  return bulkTruck ? 'Bulk (tank-fed) stock' : 'Pre-kegged / container stock';
}

/**
 * Reorder advice derived from the depot's own litre threshold.
 *
 * The owner's `low_stock_litres_threshold` is the trigger — the same level the
 * depot itself uses elsewhere ("Tank Running Low") — so the advice states litres
 * against that threshold instead of inventing a day count or a tonnage figure:
 *
 *   - below the threshold           -> CRITICAL, the trigger is already crossed
 *   - within REORDER_WARNING_BAND×  -> WARNING, approaching the trigger
 *   - otherwise                     -> HEALTHY, sitting clear of the trigger
 */
function buildReorderAdvice(
  productName: string,
  currentLitres: number,
  lowStockThresholdLitres: number,
  burnRatePerDayL: number
): { reorderRecommendation: string; criticalWarning: boolean } {
  // Nothing has been sold, so there is no measured runway to reason from.
  if (burnRatePerDayL <= 0) {
    return { reorderRecommendation: NO_SALES_HISTORY, criticalWarning: false };
  }

  // No depot trigger configured — say so rather than substituting a guess.
  if (lowStockThresholdLitres <= 0) {
    return {
      reorderRecommendation:
        `NO DATA: no low_stock_litres_threshold is configured, so ${productName}'s ` +
        `${currentLitres.toLocaleString()}L cannot be measured against a depot trigger.`,
      criticalWarning: false
    };
  }

  const stockLabel = `${currentLitres.toLocaleString()}L`;
  const thresholdLabel = `${lowStockThresholdLitres.toLocaleString()}L`;

  if (currentLitres < lowStockThresholdLitres) {
    return {
      reorderRecommendation:
        `CRITICAL: ${stockLabel} is already below your own ${thresholdLabel} low-stock trigger ` +
        `for ${productName}. Place the next replenishment order now.`,
      criticalWarning: true
    };
  }

  if (currentLitres < lowStockThresholdLitres * REORDER_WARNING_BAND) {
    return {
      reorderRecommendation:
        `WARNING: ${stockLabel} is within ${REORDER_WARNING_BAND}× your own ${thresholdLabel} low-stock ` +
        `trigger for ${productName}. Book the next replenishment before it crosses the trigger.`,
      criticalWarning: false
    };
  }

  return {
    reorderRecommendation:
      `HEALTHY: ${stockLabel} sits clear of your own ${thresholdLabel} low-stock trigger for ${productName}.`,
    criticalWarning: false
  };
}

export function runDeterministicOperationsAudit(
  snapshot: SystemSnapshot,
  provider: AIProviderType = 'claude'
): AIAnalysisReport {
  let healthScore = 100;
  const keyFindings: AIKeyFinding[] = [];
  const actionableDecisions: AIActionableDecision[] = [];
  const lossPreventionItems: AILossPreventionItem[] = [];

  const {
    inventoryVelocity,
    creditRiskAnalysis,
    kegExposureAnalysis,
    lossPreventionAudit,
    depotSummary,
    pricingAndProducts
  } = snapshot;

  // 1. Evaluate Credit & Aging Debt Risks
  if (creditRiskAnalysis.overdueCount > 0) {
    const penalty = Math.min(creditRiskAnalysis.overdueCount * 8, 25);
    healthScore -= penalty;

    const topOverdue = creditRiskAnalysis.topDebtors[0];
    keyFindings.push({
      title: `${creditRiskAnalysis.overdueCount} Delinquent Customer Account(s)`,
      detail: topOverdue
        ? `Total outstanding debt is ₦${creditRiskAnalysis.totalDebtOwedNaira.toLocaleString()}. ${topOverdue.name} leads with ₦${topOverdue.balanceNaira.toLocaleString()} overdue by ${topOverdue.overdueDays} days.`
        : `Total overdue customer credit stands at ₦${creditRiskAnalysis.totalDebtOwedNaira.toLocaleString()}.`,
      severity: 'critical',
      metric: `₦${creditRiskAnalysis.totalDebtOwedNaira.toLocaleString()}`
    });

    actionableDecisions.push({
      id: 'dec-credit-freeze',
      category: 'credit',
      priority: 'P1 - Immediate',
      action: 'Freeze credit line & demand payment before releasing next oil order',
      rationale: `${creditRiskAnalysis.overdueCount} account(s) have passed depot payment grace periods. Continued dispensing increases bad-debt risk.`,
      expectedFinancialImpactNaira: configuredNaira(creditRiskAnalysis.totalDebtOwedNaira),
      impactDescription:
        creditRiskAnalysis.totalDebtOwedNaira > 0
          ? 'Recovers up to ₦' + creditRiskAnalysis.totalDebtOwedNaira.toLocaleString() + ' working capital for immediate inventory replenishment.'
          : 'Recovers outstanding working capital for immediate inventory replenishment.',
      ownerActionRole: 'Managing Director'
    });
  } else {
    keyFindings.push({
      title: 'Customer Debt Controlled',
      detail: 'No customer accounts currently exceed depot payment aging limits.',
      severity: 'positive'
    });
  }

  // 2. Evaluate Pump Dispensing Variances (Forensic Leakage / Theft)
  const flaggedPumps = lossPreventionAudit.pumpVariances.filter(p => p.alert || Math.abs(p.varianceLitres) > 20);
  if (flaggedPumps.length > 0) {
    healthScore -= Math.min(flaggedPumps.length * 15, 30);
    flaggedPumps.forEach(pump => {
      const isOverDispensing = pump.varianceLitres > 0;
      // Valued at the depot's own retail counter rate. 0 means "no retail pack
      // priced yet", so the leak is reported in litres alone rather than at a
      // built-in ₦/L figure.
      const pumpVarianceValueNaira = configuredNaira(
        Math.abs(pump.varianceLitres) * pricingAndProducts.counterRatePerLitre
      );
      const pumpToleranceLitres = lossPreventionAudit.pumpVarianceThresholdLitres;
      keyFindings.push({
        title: `${pump.pumpName} Discrepancy (${pump.varianceLitres > 0 ? '+' : ''}${pump.varianceLitres}L)`,
        detail: `Actual flowmeter registered ${pump.actualMeterLitres}L while logged cashier orders accounted for ${pump.expectedLitres}L (${isOverDispensing ? 'unmetered discharge or unregistered sales' : 'short-dispensing to customers'}).`,
        severity: 'critical',
        metric: `${pump.varianceLitres}L`
      });

      lossPreventionItems.push({
        source: 'pumps',
        description: `${pump.pumpName}: Meter variance of ${pump.varianceLitres}L between physical pump counter and counter sales tickets.`,
        lossAmount:
          pumpVarianceValueNaira !== undefined
            ? `~₦${pumpVarianceValueNaira.toLocaleString()}`
            : 'Litres only — no ₦ value yet, because no retail pack price is configured to value the variance.',
        urgency: 'high'
      });

      actionableDecisions.push({
        id: `dec-pump-${pump.pumpId}`,
        category: 'loss_prevention',
        priority: 'P1 - Immediate',
        action: `Physically verify the tank level & inspect nozzle calibration on ${pump.pumpName}`,
        rationale: `Discrepancy exceeds the depot's configured mechanical tolerance${pumpToleranceLitres > 0 ? ` (${pumpToleranceLitres}L)` : ''}. Risk of unregistered counter dispensing or pipe leakage.`,
        expectedFinancialImpactNaira: pumpVarianceValueNaira,
        impactDescription:
          pumpVarianceValueNaira !== undefined
            ? 'Plugs potential recurring stock leakage of up to ₦' + pumpVarianceValueNaira.toLocaleString() + ' per shift.'
            : 'Plugs potential recurring stock leakage that cannot be valued until a retail pack price is configured.',
        ownerActionRole: 'Driver / Yardman'
      });
    });
  } else {
    keyFindings.push({
      title: 'Dispensing Pumps Aligned',
      detail: 'Pump mechanical meters match cashier ticket volumes within standard depot tolerance (±20L).',
      severity: 'positive'
    });
  }

  // 3. Evaluate Truck Delivery Shortfalls Against Suppliers
  const shortfalls = lossPreventionAudit.intakeShortfalls;
  if (shortfalls.length > 0) {
    healthScore -= Math.min(shortfalls.length * 10, 20);
    const totalShortfallLitres = shortfalls.reduce((acc, s) => acc + s.shortfallLitres, 0);
    const totalShortfallNaira = shortfalls.reduce((acc, s) => acc + s.estimatedLossNaira, 0);

    keyFindings.push({
      title: `Supplier Delivery Shortfall Detected (${totalShortfallLitres}L)`,
      detail:
        `Received volume was below waybill billing across ${shortfalls.length} delivery offload(s).` +
        (totalShortfallNaira > 0
          ? ` Offload loss equals ₦${totalShortfallNaira.toLocaleString()}.`
          : ' No offload loss is quoted, because no retail pack price is configured to value it.'),
      severity: 'warning',
      metric: `${totalShortfallLitres}L short`
    });

    lossPreventionItems.push({
      source: 'intake',
      description: `Bulk delivery discrepancy: ${shortfalls[0].truckOrWaybill} (${shortfalls[0].supplier}) arrived ${shortfalls[0].shortfallLitres}L short of billed capacity.`,
      lossAmount:
        totalShortfallNaira > 0
          ? `₦${totalShortfallNaira.toLocaleString()}`
          : 'Litres only — no ₦ value yet, because no retail pack price is configured to value the shortfall.',
      urgency: 'high'
    });

    actionableDecisions.push({
      id: 'dec-intake-recovery',
      category: 'inventory',
      priority: 'P2 - This Week',
      action: `Issue formal debit note / deduction against ${shortfalls[0].supplier} for ${totalShortfallLitres}L delivery shortfall`,
      rationale: 'Depot accepted fewer litres into physical yard tanks than invoiced on the bulk waybill.',
      expectedFinancialImpactNaira: configuredNaira(totalShortfallNaira),
      impactDescription:
        totalShortfallNaira > 0
          ? 'Recovers ₦' + totalShortfallNaira.toLocaleString() + ' in direct supplier credit or replacement volume.'
          : 'Recovers the shortfall in direct supplier credit or replacement volume.',
      ownerActionRole: 'Managing Director'
    });
  }

  // 4. Evaluate Inventory Runway & Reorder Triggers
  // Every reorder judgement below is made against the depot's own litre
  // threshold, so no built-in day count, tonnage or lead time is ever quoted.
  const vegDays = inventoryVelocity.veg.daysRunway;
  const palmDays = inventoryVelocity.palm.daysRunway;

  const vegProductName = stockBucketName(snapshot, true);
  const palmProductName = stockBucketName(snapshot, false);

  const vegAdvice = buildReorderAdvice(
    vegProductName,
    inventoryVelocity.veg.currentLitres,
    inventoryVelocity.veg.lowStockThresholdLitres,
    inventoryVelocity.veg.dailyBurnRateLitres
  );
  const palmAdvice = buildReorderAdvice(
    palmProductName,
    inventoryVelocity.palm.currentLitres,
    inventoryVelocity.palm.lowStockThresholdLitres,
    inventoryVelocity.palm.dailyBurnRateLitres
  );

  const inventoryForecasts: AIInventoryForecast[] = [
    {
      productName: vegProductName,
      currentStockL: inventoryVelocity.veg.currentLitres,
      burnRatePerDayL: inventoryVelocity.veg.dailyBurnRateLitres,
      estimatedDaysLeft: vegDays,
      reorderRecommendation: vegAdvice.reorderRecommendation,
      criticalWarning: vegAdvice.criticalWarning
    },
    {
      productName: palmProductName,
      currentStockL: inventoryVelocity.palm.currentLitres,
      burnRatePerDayL: inventoryVelocity.palm.dailyBurnRateLitres,
      estimatedDaysLeft: palmDays,
      reorderRecommendation: palmAdvice.reorderRecommendation,
      criticalWarning: palmAdvice.criticalWarning
    }
  ];

  // The depot's own low-stock litre threshold is the dry-out trigger — the same
  // level its "Tank Running Low" alert uses — so a depot still above that level
  // is never told to expect a dry-out on a day count this app cannot verify.
  const vegThresholdL = inventoryVelocity.veg.lowStockThresholdLitres;
  const palmThresholdL = inventoryVelocity.palm.lowStockThresholdLitres;
  const vegBelowThreshold = vegThresholdL > 0 && inventoryVelocity.veg.currentLitres < vegThresholdL;
  const palmBelowThreshold =
    palmThresholdL > 0 && inventoryVelocity.palm.currentLitres < palmThresholdL;

  if (vegBelowThreshold || palmBelowThreshold) {
    healthScore -= 15;

    const reportVeg = vegBelowThreshold;
    const reportName = reportVeg ? vegProductName : palmProductName;
    const reportStockL = reportVeg ? inventoryVelocity.veg.currentLitres : inventoryVelocity.palm.currentLitres;
    const reportThresholdL = reportVeg ? vegThresholdL : palmThresholdL;
    const reportBurnRateL = reportVeg
      ? inventoryVelocity.veg.dailyBurnRateLitres
      : inventoryVelocity.palm.dailyBurnRateLitres;

    keyFindings.push({
      title: 'Low Inventory Runway Alert',
      detail: `${reportName} is down to ${reportStockL.toLocaleString()}L, below the depot's own ${reportThresholdL.toLocaleString()}L low-stock trigger. Daily counter consumption is ~${reportBurnRateL}L.`,
      severity: 'critical',
      metric: `${reportStockL.toLocaleString()}L`
    });

    actionableDecisions.push({
      id: 'dec-reorder-tanker',
      category: 'inventory',
      priority: 'P1 - Immediate',
      action: `Book the next replenishment for ${reportName} — yard stock is below the depot's own ${reportThresholdL.toLocaleString()}L low-stock trigger`,
      rationale: `Stock has crossed the depot's configured low_stock_litres_threshold, so the dispensing counter is at risk of running dry before the next delivery lands.`,
      impactDescription: 'Prevents revenue stoppage at the dispensing counter and protects retail market share.',
      ownerActionRole: 'Managing Director'
    });
  }

  // 5. Evaluate Keg Fleet & Missing Returnable Exposure
  // A naira exposure figure only exists once the owner has configured an
  // outright keg price, so the finding stays in literal keg counts until then.
  if (kegExposureAnalysis.totalKegsOut > 20) {
    keyFindings.push({
      title: `Returnable Keg Exposure (${kegExposureAnalysis.totalKegsOut} Kegs Out)`,
      detail:
        `${kegExposureAnalysis.totalKegsOut} depot containers are currently with customers and yard stock is down to ${depotSummary.kegsAtDepot} kegs.` +
        (kegExposureAnalysis.unreturnedValueExposureNaira > 0
          ? ` Replacement exposure is ₦${kegExposureAnalysis.unreturnedValueExposureNaira.toLocaleString()} at the depot's configured outright keg price.`
          : ' No replacement exposure is quoted, because no outright keg price is configured yet.'),
      severity: depotSummary.kegsAtDepot < 30 ? 'warning' : 'info',
      metric: `${kegExposureAnalysis.totalKegsOut} kegs`
    });

    actionableDecisions.push({
      id: 'dec-keg-recall',
      category: 'operations',
      priority: 'P2 - This Week',
      action: 'Dispatch WhatsApp container return reminders & enforce empty-keg exchange on new sales',
      rationale: 'Unreturned kegs limit depot dispensing throughput and represent unhedged replacement capital.',
      expectedFinancialImpactNaira: configuredNaira(kegExposureAnalysis.unreturnedValueExposureNaira),
      impactDescription: 'Restores yard packaging inventory without spending cash to purchase new containers.',
      ownerActionRole: 'Depot Cashier'
    });
  }

  // 6. Evaluate Shift Discrepancies
  if (lossPreventionAudit.shiftDiscrepancies.length > 0) {
    const netShiftVariance = lossPreventionAudit.shiftDiscrepancies.reduce((a, b) => a + b.discrepancyNaira, 0);
    if (netShiftVariance < -1000) {
      lossPreventionItems.push({
        source: 'cash_drawer',
        description: `Cash drawer shortfall recorded during cashier shift reconciliation.`,
        lossAmount: `₦${Math.abs(netShiftVariance).toLocaleString()}`,
        urgency: 'medium'
      });
    }
  }

  // Bound Health Score
  healthScore = Math.max(Math.min(healthScore, 100), 20);

  const healthVerdict =
    healthScore >= 85
      ? 'optimal'
      : healthScore >= 70
      ? 'good'
      : healthScore >= 50
      ? 'attention_needed'
      : 'critical';

  const modelLabel = 'Claude 3.5 Sonnet (Deterministic Audit Engine)';

  return {
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    providerUsed: provider,
    modelName: modelLabel,
    depotHealthScore: healthScore,
    healthVerdict,
    executiveSummary:
      healthVerdict === 'optimal'
        ? 'Iyanuoluwa Depot operations are running smoothly with balanced pump reconciliation, controlled customer debit limits, and sufficient inventory buffer across both product varieties.'
        : healthVerdict === 'good'
        ? `Depot operations are stable (Health Score ${healthScore}/100), but attention is needed regarding ${keyFindings.filter(f => f.severity === 'critical' || f.severity === 'warning').map(f => f.title).join(', ')}.`
        : `Immediate managerial intervention required (Health Score ${healthScore}/100). Significant operational risks detected in unmetered pump variances, delinquent receivables, or imminent stockout.`,
    keyFindings,
    actionableDecisions,
    inventoryForecasts,
    lossPreventionItems
  };
}

export function answerCopilotQuestionDeterministic(
  question: string,
  snapshot: SystemSnapshot
): string {
  const q = question.toLowerCase();

  // 1. Internet & External Commodity Market Intelligence
  if (
    q.includes('search') ||
    q.includes('market') ||
    q.includes('price') ||
    q.includes('mile 12') ||
    q.includes('daleko') ||
    q.includes('cpo') ||
    q.includes('diesel') ||
    q.includes('rate') ||
    q.includes('logistics') ||
    q.includes('tariff') ||
    q.includes('fx') ||
    q.includes('dollar') ||
    q.includes('competitor')
  ) {
    // The only pricing this app can stand behind is the owner's own catalogue,
    // so every market answer below falls back to it instead of a built-in figure.
    const configuredPricing =
      snapshot.pricingAndProducts.products.length === 0
        ? `• No products configured yet. Add them in Settings → Products & Keg Sizes and your own pricing will show here.\n`
        : snapshot.pricingAndProducts.products
            .map(p => {
              const kegSize = p.litresPerKeg > 0 ? `${p.litresPerKeg}L keg` : 'keg size not set';
              const containerPrice = p.kegSellPrice
                ? `container ₦${p.kegSellPrice.toLocaleString()}`
                : 'container price not set';
              return `• **${p.name}** (${kegSize}): ${containerPrice}\n`;
            })
            .join('');

    if (q.includes('diesel') || q.includes('logistics') || q.includes('freight') || q.includes('transport')) {
      return `🌐 **Logistics & Freight Costing:**\n\n` +
        `No live diesel or haulage feed is connected to this app, so it cannot quote a per-litre diesel price or a tanker freight rate — and a guessed figure would corrupt your landed cost.\n\n` +
        `**What to do instead:** cost each trip from your own supplier invoice — record the haulage charge and diesel spend against the delivery in Truck Intake, then compare the result with your landed cost per litre.`;
    }

    if (q.includes('cpo') || q.includes('crude palm') || q.includes('bursa') || q.includes('tariff') || q.includes('import')) {
      return `🌐 **Commodity Benchmarks:**\n\n` +
        `No live commodity feed is connected to this app, so it will not quote a Bursa Malaysia CPO, mill-gate or tariff figure it cannot verify.\n\n` +
        `**What this depot can quote — its own configured pricing:**\n` + configuredPricing +
        `\n💡 **Managing Director Strategy:** Compare the prices above against written quotes from your mill/refinery suppliers before committing to a supply contract.`;
    }

    return `🌐 **Market Intelligence:**\n\n` +
      `This app has no live market or competitor price feed, so it cannot quote the Mile 12 / Daleko / Trade Fair index — and guessing it would misprice your kegs.\n\n` +
      `**Your configured pricing right now:**\n` + configuredPricing;
  }

  // 2. Receivables & Debtors
  if (q.includes('who owes') || q.includes('debt') || q.includes('debit') || q.includes('credit') || q.includes('customer')) {
    const debtors = snapshot.creditRiskAnalysis.topDebtors;
    if (debtors.length === 0) {
      return 'Currently, there are no overdue customer balances recorded in the depot ledger. All debit limits are within compliance.';
    }
    const top = debtors[0];
    return `Depot customers currently owe a total of ₦${snapshot.creditRiskAnalysis.totalDebtOwedNaira.toLocaleString()}.\n\n` +
      `The largest outstanding account is **${top.name}** owing **₦${top.balanceNaira.toLocaleString()}** (overdue by ${top.overdueDays} days, debit limit: ₦${top.creditLimitNaira.toLocaleString()}).\n\n` +
      `**Recommendation:** Instruct the cashier to stop releasing oil on debit to ${top.name} until at least 70% of the past-due balance is liquidated via bank transfer or cash.`;
  }

  // 3. Tanks, Stock, Runway & Reorders
  if (q.includes('tank') || q.includes('runway') || q.includes('order') || q.includes('truck') || q.includes('stock')) {
    const veg = snapshot.inventoryVelocity.veg;
    const palm = snapshot.inventoryVelocity.palm;
    const vegName = stockBucketName(snapshot, true);
    const palmName = stockBucketName(snapshot, false);
    const belowThreshold =
      (veg.lowStockThresholdLitres > 0 && veg.currentLitres < veg.lowStockThresholdLitres) ||
      (palm.lowStockThresholdLitres > 0 && palm.currentLitres < palm.lowStockThresholdLitres);
    const vegRunway =
      veg.dailyBurnRateLitres > 0
        ? `At an average counter burn rate of ~${veg.dailyBurnRateLitres}L/day, you have **${veg.daysRunway} days of runway left**.`
        : 'No sales recorded yet, so there is no burn rate or runway figure to report.';
    const palmRunway =
      palm.dailyBurnRateLitres > 0
        ? `Estimated runway is **${palm.daysRunway} days**.`
        : 'No sales recorded yet, so there is no burn rate or runway figure to report.';
    return `**Current Depot Fuel/Oil Inventory Status:**\n\n` +
      `• **${vegName}:** ${veg.currentLitres.toLocaleString()}L remaining across ${veg.tankCount} tank(s). ${vegRunway}\n` +
      `• **${palmName}:** ${palm.currentLitres.toLocaleString()}L remaining across ${palm.tankCount} tank(s). ${palmRunway}\n\n` +
      `**Executive Advice:** ${
        belowThreshold
          ? 'Yard stock is below the low_stock_litres_threshold configured in Settings — book the next replenishment now.'
          : 'Inventory levels are above your configured low-stock threshold for regular counter operations.'
      }`;
  }

  // 4. Pumps, Meters & Variance Audit
  if (q.includes('pump') || q.includes('leak') || q.includes('theft') || q.includes('meter')) {
    const variances = snapshot.lossPreventionAudit.pumpVariances;
    const flagged = variances.filter(p => p.alert || Math.abs(p.varianceLitres) > 20);
    if (flagged.length === 0) {
      return 'All 3 dispensing pumps are operating within the standard ±20L variance threshold. No irregular leakage or unmetered dispensing detected today.';
    }
    return `**Pump Forensic Audit Alert:**\n\n` +
      flagged.map(p => `• **${p.pumpName}:** Meter delta was ${p.actualMeterLitres}L vs cashier tickets of ${p.expectedLitres}L (Variance: **${p.varianceLitres > 0 ? '+' : ''}${p.varianceLitres}L**)`).join('\n') +
      `\n\n**Action:** Inspect nozzle calibration and physically verify the source tank's level immediately to verify if oil was dispensed without a sales ticket or lost to line dripping.`;
  }

  // 5. Keg Containers & Fleet
  if (q.includes('keg') || q.includes('container') || q.includes('fleet')) {
    const kegs = snapshot.kegExposureAnalysis;
    return `**Keg Packaging Summary:**\n\n` +
      `• Total Company Fleet: ${snapshot.depotSummary.totalFleet} kegs\n` +
      `• Kegs Currently at Depot: ${snapshot.depotSummary.kegsAtDepot} kegs\n` +
      `• Kegs Out with Customers: ${kegs.totalKegsOut} kegs` +
      (kegs.unreturnedValueExposureNaira > 0
        ? ` (Represents **₦${kegs.unreturnedValueExposureNaira.toLocaleString()}** in replacement value at your configured outright keg price)\n\n`
        : ` (No replacement value is quoted until an outright keg price is configured in Settings)\n\n`) +
      `**Recommendation:** Enforce empty keg exchanges on new sales to avoid purchasing replacement containers.`;
  }

  // General operations summary
  return `**Iyanuoluwa Depot Intelligence Briefing:**\n\n` +
    `• Total Oil on Hand: ${snapshot.depotSummary.totalLitres.toLocaleString()}L (${snapshot.depotSummary.vegLitres.toLocaleString()}L Veg, ${snapshot.depotSummary.palmLitres.toLocaleString()}L Palm)\n` +
    `• Today's Revenue: ₦${snapshot.todayPerformance.totalRevenueNaira.toLocaleString()} (Cash/Transfer: ₦${snapshot.todayPerformance.cashSalesNaira.toLocaleString()})\n` +
    `• Total Customer Debit: ₦${snapshot.creditRiskAnalysis.totalDebtOwedNaira.toLocaleString()} across ${snapshot.creditRiskAnalysis.overdueCount} overdue debtor(s)\n` +
    `• Depot Health Index: ${snapshot.creditRiskAnalysis.overdueCount > 0 ? 'Requires attention on debit collections & pump variances' : 'Healthy and stable'}.\n\n` +
    `You can ask me specific questions about customer debit balances, pump meter leakage, tank reordering, or for your own configured pricing — note that this app has no live market feed, so it will not quote exchange, competitor or commodity index prices.`;
}
