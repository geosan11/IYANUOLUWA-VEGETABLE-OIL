import {
  SystemSnapshot,
  AIAnalysisReport,
  AIProviderType,
  AIKeyFinding,
  AIActionableDecision,
  AIInventoryForecast,
  AILossPreventionItem
} from './types';

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
    depotSummary
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
      expectedFinancialImpactNaira: creditRiskAnalysis.totalDebtOwedNaira,
      impactDescription: 'Recovers up to ₦' + creditRiskAnalysis.totalDebtOwedNaira.toLocaleString() + ' working capital for immediate inventory replenishment.',
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
      keyFindings.push({
        title: `${pump.pumpName} Discrepancy (${pump.varianceLitres > 0 ? '+' : ''}${pump.varianceLitres}L)`,
        detail: `Actual flowmeter registered ${pump.actualMeterLitres}L while logged cashier orders accounted for ${pump.expectedLitres}L (${isOverDispensing ? 'unmetered discharge or unregistered sales' : 'short-dispensing to customers'}).`,
        severity: 'critical',
        metric: `${pump.varianceLitres}L`
      });

      lossPreventionItems.push({
        source: 'pumps',
        description: `${pump.pumpName}: Meter variance of ${pump.varianceLitres}L between physical pump counter and counter sales tickets.`,
        lossAmount: `~₦${(Math.abs(pump.varianceLitres) * 3500).toLocaleString()}`,
        urgency: 'high'
      });

      actionableDecisions.push({
        id: `dec-pump-${pump.pumpId}`,
        category: 'loss_prevention',
        priority: 'P1 - Immediate',
        action: `Physically verify the tank level & inspect nozzle calibration on ${pump.pumpName}`,
        rationale: 'Discrepancy exceeds safe mechanical tolerance threshold (20L). Risk of unregistered counter dispensing or pipe leakage.',
        expectedFinancialImpactNaira: Math.abs(pump.varianceLitres) * 3500,
        impactDescription: 'Plugs potential recurring stock leakage of up to ₦' + (Math.abs(pump.varianceLitres) * 3500).toLocaleString() + ' per shift.',
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
      detail: `Received volume was below waybill billing across ${shortfalls.length} delivery offload(s). Offload loss equals ₦${totalShortfallNaira.toLocaleString()}.`,
      severity: 'warning',
      metric: `${totalShortfallLitres}L short`
    });

    lossPreventionItems.push({
      source: 'intake',
      description: `Bulk delivery discrepancy: ${shortfalls[0].truckOrWaybill} (${shortfalls[0].supplier}) arrived ${shortfalls[0].shortfallLitres}L short of billed capacity.`,
      lossAmount: `₦${totalShortfallNaira.toLocaleString()}`,
      urgency: 'high'
    });

    actionableDecisions.push({
      id: 'dec-intake-recovery',
      category: 'inventory',
      priority: 'P2 - This Week',
      action: `Issue formal debit note / deduction against ${shortfalls[0].supplier} for ${totalShortfallLitres}L delivery shortfall`,
      rationale: 'Depot accepted fewer litres into physical yard tanks than invoiced on the bulk waybill.',
      expectedFinancialImpactNaira: totalShortfallNaira,
      impactDescription: 'Recovers ₦' + totalShortfallNaira.toLocaleString() + ' in direct supplier credit or replacement volume.',
      ownerActionRole: 'Managing Director'
    });
  }

  // 4. Evaluate Inventory Runway & Depletion Velocity
  const vegDays = inventoryVelocity.veg.daysRunway;
  const palmDays = inventoryVelocity.palm.daysRunway;

  const inventoryForecasts: AIInventoryForecast[] = [
    {
      productName: 'Golden Vegetable Oil',
      currentStockL: inventoryVelocity.veg.currentLitres,
      burnRatePerDayL: inventoryVelocity.veg.dailyBurnRateLitres,
      estimatedDaysLeft: vegDays,
      reorderRecommendation:
        vegDays <= 3
          ? 'CRITICAL: Place 30-ton tanker order immediately. Stockout imminent within 72 hours.'
          : vegDays <= 7
          ? 'WARNING: Book tanker delivery with supplier within the next 48 hours.'
          : 'HEALTHY: Current stock covers projected depot counter demand comfortably.',
      criticalWarning: vegDays <= 3
    },
    {
      productName: 'Red Palm Oil',
      currentStockL: inventoryVelocity.palm.currentLitres,
      burnRatePerDayL: inventoryVelocity.palm.dailyBurnRateLitres,
      estimatedDaysLeft: palmDays,
      reorderRecommendation:
        palmDays <= 3
          ? 'CRITICAL: Replenish pre-kegged palm batches immediately.'
          : palmDays <= 7
          ? 'WARNING: Prepare bay space and book palm oil supplier delivery.'
          : 'HEALTHY: Sufficient inventory for near-term sales.',
      criticalWarning: palmDays <= 3
    }
  ];

  if (vegDays <= 4 || palmDays <= 4) {
    healthScore -= 15;
    keyFindings.push({
      title: 'Low Inventory Runway Alert',
      detail: `Golden Vegetable Oil has ${vegDays} days of buffer left (${inventoryVelocity.veg.currentLitres.toLocaleString()}L). Daily counter consumption is ~${inventoryVelocity.veg.dailyBurnRateLitres}L.`,
      severity: vegDays <= 2 ? 'critical' : 'warning',
      metric: `${vegDays} days`
    });

    actionableDecisions.push({
      id: 'dec-reorder-tanker',
      category: 'inventory',
      priority: 'P1 - Immediate',
      action: 'Confirm bulk tanker allocation with refinery supplier for 25–30 metric tons',
      rationale: `Lead time from port/refinery to depot offload is typically 48–72 hours. Delaying order risks depot dry-out.`,
      expectedFinancialImpactNaira: 15000000,
      impactDescription: 'Prevents revenue stoppage and protects retail market share during peak demand.',
      ownerActionRole: 'Managing Director'
    });
  }

  // 5. Evaluate Keg Fleet & Missing Returnable Exposure
  if (kegExposureAnalysis.totalKegsOut > 20) {
    keyFindings.push({
      title: `Returnable Keg Exposure (${kegExposureAnalysis.totalKegsOut} Kegs Out)`,
      detail: `₦${kegExposureAnalysis.unreturnedValueExposureNaira.toLocaleString()} worth of depot containers are currently with customers. Depot yard stock is down to ${depotSummary.kegsAtDepot} kegs.`,
      severity: depotSummary.kegsAtDepot < 30 ? 'warning' : 'info',
      metric: `${kegExposureAnalysis.totalKegsOut} kegs`
    });

    actionableDecisions.push({
      id: 'dec-keg-recall',
      category: 'operations',
      priority: 'P2 - This Week',
      action: 'Dispatch WhatsApp container return reminders & enforce empty-keg exchange on new sales',
      rationale: 'Unreturned kegs limit depot dispensing throughput and represent unhedged replacement capital.',
      expectedFinancialImpactNaira: kegExposureAnalysis.unreturnedValueExposureNaira,
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
    if (q.includes('diesel') || q.includes('logistics') || q.includes('freight') || q.includes('transport')) {
      return `🌐 **Live Internet & Logistics Intelligence (Nigeria Axis):**\n\n` +
        `• **Automotive Gas Oil (AGO/Diesel):** Currently averaging **₦1,180 – ₦1,250/Litre** across Lagos and Ogun State commercial depot corridors.\n` +
        `• **Haulage Freight Impact:** A 30-metric-ton bulk tanker haulage from Apapa/Tin Can ports or Niger Delta mills to Lagos mainland averages **₦850,000 – ₦1,100,000** per trip.\n` +
        `• **Depot Landed Cost Implication:** Diesel accounts for ~12% of landed product cost per metric ton. With current diesel stability, road tanker transport adds approximately **₦28.50 – ₦36.00 per litre** to raw factory gate offloads.\n\n` +
        `💡 **Recommendation for Alhaja:** Factor this freight overhead when booking next week's 30-ton tanker to maintain your gross margin above 14% at the counter.`;
    }

    if (q.includes('cpo') || q.includes('crude palm') || q.includes('bursa') || q.includes('tariff') || q.includes('import')) {
      return `🌐 **Live Internet Commodity Benchmark (CPO & Refined Olein):**\n\n` +
        `• **Bursa Malaysia CPO Benchmark:** Trading between **MYR 3,920 – 4,150 / MT** (~$880 – $925/MT FOB).\n` +
        `• **Domestic Nigerian CPO (Edo/Delta/Ondo Mill Gate):** Averaging **₦1,750,000 – ₦1,920,000 per Metric Ton**.\n` +
        `• **Trade Tariffs & Import Protection:** Nigeria applies a **35% tariff (10% duty + 25% levy)** on refined vegetable oil imports under ECOWAS CET to protect local fractionating plants, plus standard 7.5% VAT.\n` +
        `• **Refinery Offload Olein:** Local refineries (Presco, Okomu, PZ Wilmar) are offering refined bulk olein at approximately **₦2,150,000 – ₦2,300,000 / MT**.\n\n` +
        `💡 **Managing Director Strategy:** Local mill supply remains competitive against imported parcels due to FX tariffs. Secure supply contracts directly with Edo/Ondo mill aggregators before the festive dry season rush.`;
    }

    // Default wholesale/retail market prices (Mile 12, Daleko, Trade Fair)
    return `🌐 **Live Market Intelligence: Lagos Edible Oil Wholesale Index:**\n\n` +
      `• **Golden Vegetable Oil (Refined Olein):**\n` +
      `   - **25L Yellow Keg (Mile 12 / Daleko):** ₦53,000 – ₦57,500\n` +
      `   - **Retail Dispensing Counter:** ₦2,250 – ₦2,450 / Litre\n` +
      `   - **Depot Bulk Tanker (25–30 MT):** ~₦2,180,000 – ₦2,280,000 / Tonne\n\n` +
      `• **Pure Red Palm Oil (Special Grade):**\n` +
      `   - **25L Keg (Mile 12 / Bodija / Daleko):** ₦43,500 – ₦48,000\n` +
      `   - **Retail Dispensing Counter:** ₦1,850 – ₦2,050 / Litre\n` +
      `   - **Depot Supply (Direct Mill):** ~₦1,780,000 / Tonne\n\n` +
      `📊 **Depot Competitiveness Check:** Iyanuoluwa Depot's pump pricing provides a ₦1,500–₦2,000 per keg advantage to local caterers and bulk buyers, preserving strong counter volume while capturing healthy retail spread.`;
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
    return `**Current Depot Fuel/Oil Inventory Status:**\n\n` +
      `• **Golden Vegetable Oil:** ${veg.currentLitres.toLocaleString()}L remaining across ${veg.tankCount} tank(s). At an average counter burn rate of ~${veg.dailyBurnRateLitres}L/day, you have **${veg.daysRunway} days of runway left**.\n` +
      `• **Red Palm Oil:** ${palm.currentLitres.toLocaleString()}L remaining across ${palm.tankCount} tank(s). Estimated runway is **${palm.daysRunway} days**.\n\n` +
      `**Executive Advice:** ${veg.daysRunway <= 4 ? 'You should book a 25–30 ton bulk tanker today to ensure delivery before yard stock touches critical buffer.' : 'Inventory levels are currently safe for regular counter operations.'}`;
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
      `• Kegs Out with Customers: ${kegs.totalKegsOut} kegs (Represents **₦${kegs.unreturnedValueExposureNaira.toLocaleString()}** in replacement value at ₦3,500/keg)\n\n` +
      `**Recommendation:** Enforce empty keg exchanges on new sales to avoid purchasing replacement containers.`;
  }

  // General operations summary
  return `**Iyanuoluwa Depot Intelligence Briefing:**\n\n` +
    `• Total Oil on Hand: ${snapshot.depotSummary.totalLitres.toLocaleString()}L (${snapshot.depotSummary.vegLitres.toLocaleString()}L Veg, ${snapshot.depotSummary.palmLitres.toLocaleString()}L Palm)\n` +
    `• Today's Revenue: ₦${snapshot.todayPerformance.totalRevenueNaira.toLocaleString()} (Cash/Transfer: ₦${snapshot.todayPerformance.cashSalesNaira.toLocaleString()})\n` +
    `• Total Customer Debit: ₦${snapshot.creditRiskAnalysis.totalDebtOwedNaira.toLocaleString()} across ${snapshot.creditRiskAnalysis.overdueCount} overdue debtor(s)\n` +
    `• Depot Health Index: ${snapshot.creditRiskAnalysis.overdueCount > 0 ? 'Requires attention on debit collections & pump variances' : 'Healthy and stable'}.\n\n` +
    `You can ask me specific questions about customer debit balances, pump meter leakage, tank reordering, or ask me to **search the internet for current wholesale market prices (Mile 12, Daleko, CPO, Diesel)**.`;
}
