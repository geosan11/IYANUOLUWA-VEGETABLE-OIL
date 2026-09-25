import React, { useState } from 'react';
import { useStore } from '../services/store';
import { useToast } from '../services/toast';
import { usePermissions } from '../services/permissions';
import { extractSystemSnapshot } from '../services/ai/dataExtractor';
import {
  requestOperationsAudit,
  askOperationsQuestion,
  getCachedReport
} from '../services/ai/aiService';
import {
  AIProviderType,
  AIAnalysisReport,
  AIChatMessage
} from '../services/ai/types';
import { formatNaira } from '../services/businessLogic';
import { PACK_SIZES } from '../constants/config';
import {
  Sparkle as Sparkles,
  ShieldCheck,
  ArrowsClockwise as RefreshCw,
  Lock,
  PaperPlaneTilt as Send,
  Copy,
  Check,
  ChatCircle as MessageSquare,
  Globe
} from '@phosphor-icons/react';

export const AIAdvisorScreen: React.FC = () => {
  const store = useStore();
  const { userRole, setUserRole } = store;

  // Strict Admin Gate: only the owner may view AI Operations Intelligence.
  const { can } = usePermissions();
  const isAdmin = can('viewAIAdvisor');
  const { showToast } = useToast();

  // Provider is fixed to Claude
  const provider: AIProviderType = 'claude';
  const [report, setReport] = useState<AIAnalysisReport | null>(() => getCachedReport());

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');

  // Copilot Chat State
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Good day. I am monitoring your tanks, pump flowmeters, and debtor accounts. Ask me any question or run a full audit below.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Trigger On-Demand Audit
  const handleRunAudit = async () => {
    setIsLoading(true);
    setLoadingStage('Auditing depot tanks, pumps & debtor aging...');

    try {
      const snapshot = extractSystemSnapshot({
        tanks: store.tanks,
        products: store.products,
        suppliers: store.suppliers,
        orders: store.orders,
        customers: store.customers,
        customerStatsMap: store.customerStatsMap,
        kegInventory: store.kegInventory,
        todayStats: store.todayStats,
        activeAlerts: store.activeAlerts,
        pumpVarianceAudits: store.pumpVarianceAudits,
        shifts: store.shifts,
        settings: store.settings,
        packPrices: store.packPrices
      });

      await new Promise(r => setTimeout(r, 450));
      setLoadingStage('Formulating strategic decisions with Claude 3.5 Sonnet...');

      const newReport = await requestOperationsAudit(snapshot, {
        userRole
      });

      setReport(newReport);
    } catch (err) {
      console.error('Failed to run operations audit:', err);
      showToast('error', 'Could not complete the operations audit. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Interactive Copilot Q&A
  const handleSendChat = async (questionText?: string) => {
    const q = (questionText || chatInput).trim();
    if (!q || isChatLoading) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const snapshot = extractSystemSnapshot({
        tanks: store.tanks,
        products: store.products,
        suppliers: store.suppliers,
        orders: store.orders,
        customers: store.customers,
        customerStatsMap: store.customerStatsMap,
        kegInventory: store.kegInventory,
        todayStats: store.todayStats,
        activeAlerts: store.activeAlerts,
        pumpVarianceAudits: store.pumpVarianceAudits,
        shifts: store.shifts,
        settings: store.settings,
        packPrices: store.packPrices
      });

      const replyText = await askOperationsQuestion(q, snapshot, {
        userRole
      });

      const botMsg: AIChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'claude'
      };

      setChatMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Copilot question failed:', err);
      showToast('error', 'Could not get a reply from the AI advisor. Please try again.');
    } finally {
      setIsChatLoading(false);
    }
  };

  // 1-Click WhatsApp Executive Brief
  const handleCopyWhatsAppBriefing = () => {
    if (!report) return;

    const text = `*IYANUOLUWA DEPOT — EXECUTIVE INTELLIGENCE BRIEF*\n` +
      `📅 *Date:* ${new Date(report.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n` +
      `🩺 *Health Score:* ${report.depotHealthScore}/100 (${report.healthVerdict.toUpperCase()})\n` +
      `🤖 *Engine:* ${report.modelName}\n\n` +
      `*EXECUTIVE SUMMARY:*\n${report.executiveSummary}\n\n` +
      `*TOP ACTIONS FOR TODAY:*\n` +
      report.actionableDecisions.slice(0, 3).map((d, i) => `${i + 1}. [${d.priority}] ${d.action} — ${d.impactDescription}`).join('\n') +
      `\n\n*INVENTORY RUNWAY:*\n` +
      report.inventoryForecasts.map(f => `• ${f.productName}: ${f.currentStockL.toLocaleString()}L (${f.burnRatePerDayL > 0 ? `${f.estimatedDaysLeft} days left` : 'runway unknown — no sales recorded yet'})`).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  // Render Access Denied if non-admin attempts direct access
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Managing Director Clearance Required
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              The AI Operations Advisor contains confidential company profit figures, customer credit debts, and forensic pump variance audits.
            </p>
          </div>
          <button
            onClick={() => setUserRole('owner')}
            className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Switch to Owner / Admin Mode
          </button>
        </div>
      </div>
    );
  }

  // Counter value per litre, derived from the owner's own retail pack pricing
  // (retail-tier pack price ÷ that pack's litres). Nothing configured = 0, so an
  // invented ₦/litre rate is never used to size a loss.
  const counterRatePerLitre = (() => {
    for (const pp of store.packPrices) {
      if (pp.tier !== 'retail' || pp.price <= 0) continue;
      const litres = PACK_SIZES.find(s => s.id === pp.pack_size_id)?.litres || 0;
      if (litres > 0) return pp.price / litres;
    }
    return 0;
  })();

  const shortfallLitresAtRisk = store.activeAlerts.deliveryShortfall.reduce((acc, s) => acc + s.shortfallLitres, 0);
  const varianceLitresAtRisk = store.activeAlerts.pumpVariance.reduce((acc, p) => acc + Math.abs(p.variance), 0);

  // Calculate high-level summary indicators
  const totalMoneyAtRisk = store.todayStats.creditOutstanding +
    ((shortfallLitresAtRisk + varianceLitresAtRisk) * counterRatePerLitre);

  // AI runway buckets are the depot's own products (bulk = tank-fed, everything
  // else = pre-kegged). The old 'veg'/'red' keys matched no product id at all,
  // so these figures always fell back to invented placeholder litres.
  const bulkProducts = store.products.filter(p => p.supply_model === 'bulk_truck');
  const kegProducts = store.products.filter(p => p.supply_model !== 'bulk_truck');
  const bulkProductName = bulkProducts[0]?.name || 'Bulk (tank-fed) oil';
  const kegProductName = kegProducts[0]?.name || 'Pre-kegged / container oil';
  const bulkYardLitres = bulkProducts.reduce((acc, p) => acc + (store.tankStockByProduct[p.id]?.totalLitres || 0), 0);
  const kegYardLitres = kegProducts.reduce((acc, p) => acc + (store.tankStockByProduct[p.id]?.totalLitres || 0), 0);

  // A runway figure only exists once the depot has sales history: with no burn
  // rate there is no day count to show, so the cards dash out instead.
  const vegForecast = report?.inventoryForecasts[0];
  const palmForecast = report?.inventoryForecasts[1];
  const vegRunway = vegForecast && vegForecast.burnRatePerDayL > 0 ? vegForecast.estimatedDaysLeft : null;
  const palmRunway = palmForecast && palmForecast.burnRatePerDayL > 0 ? palmForecast.estimatedDaysLeft : null;
  // Visual scale for the buffer bars: a full bar is 14 days (2× the 7-day reorder
  // warning threshold). It is a display scale, not a claim about stock health.
  const runwayBarWidth = (days: number | null) =>
    days === null ? '0%' : `${Math.min(100, Math.round((days / 14) * 100))}%`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {/* 1. Header: Calm, Executive, Clean */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Executive AI Operations Advisor
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Depot forensic monitoring & strategic recommendations for the Managing Director.
          </p>
        </div>

        {/* Engine Switcher & Trigger */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Dedicated Claude Engine Badge — reflects the engine that actually produced the current report (falls back to a generic label before the first audit runs) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <span className="font-bold text-slate-800 dark:text-slate-200">{report ? report.modelName : 'Claude 3.5 Sonnet'}</span>
          </div>

          {/* Action Trigger */}
          <button
            onClick={handleRunAudit}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{report ? 'Update Audit' : 'Run Audit'}</span>
          </button>

          {report && (
            <button
              onClick={handleCopyWhatsAppBriefing}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all"
              title="Copy WhatsApp Summary"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Loading state bar */}
      {isLoading && (
        <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900/40 flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin text-brand-600 dark:text-brand-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {loadingStage || 'Auditing depot data...'}
          </span>
        </div>
      )}

      {/* Pre-audit placeholder notice — everything below is illustrative sample data until "Run Audit" produces a real report */}
      {!report && !isLoading && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs font-bold text-amber-700 dark:text-amber-400">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Example figures below — click &ldquo;Run Audit&rdquo; to replace them with real numbers from this depot.</span>
        </div>
      )}

      {/* 2. Executive Pulse: 3 High-Impact Glance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Health Index */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Depot Health Index
          </span>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {report ? report.depotHealthScore : '—'}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">/ 100</span>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 capitalize">
            {report ? report.healthVerdict.replace('_', ' ') : 'Awaiting audit'}
          </span>
        </div>

        {/* Card 2: Capital at Risk */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Capital At Risk (Debt + Loss)
          </span>
          <div className="my-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
              {formatNaira(totalMoneyAtRisk)}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {store.activeAlerts.overdueCredit.length} overdue debtor(s) · {store.activeAlerts.pumpVariance.length} pump variance(s)
            {counterRatePerLitre <= 0 && (shortfallLitresAtRisk + varianceLitresAtRisk) > 0 && (
              <> · {(shortfallLitresAtRisk + varianceLitresAtRisk).toLocaleString()}L of losses excluded until a retail pack price is set</>
            )}
          </span>
        </div>

        {/* Card 3: Vegetable Oil Runway */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Veg Oil Buffer Runway
          </span>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
              {vegRunway ?? '—'}
            </span>
            <span className="text-xs font-medium text-slate-400">days left</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {bulkYardLitres.toLocaleString()}L in yard storage
          </span>
        </div>
      </div>

      {/* 3. Executive Action Plan: Simple, Numbered Priority List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Top Actions for the Managing Director
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Prioritized recommendations to protect working capital and maintain stock
            </p>
          </div>
          {report && (
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {report.actionableDecisions.length} items identified
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {(report ? report.actionableDecisions.slice(0, 3) : [
            {
              id: 'sample-1',
              priority: 'P1 - Immediate',
              action: 'Freeze credit line & demand payment before releasing next oil order',
              rationale: 'Raised when a customer passes the depot payment grace period on their debit.',
              impactDescription: 'Recovers past-due working capital as soon as the real audit runs.',
              ownerActionRole: 'Managing Director'
            },
            {
              id: 'sample-2',
              priority: 'P1 - Immediate',
              action: 'Physically verify the tank level & inspect nozzle calibration on the flagged pump',
              rationale: 'Raised when a pump meter delta exceeds the variance tolerance you set in Settings.',
              impactDescription: 'Plugs recurring dispensing leakage, valued at your own counter rate.',
              ownerActionRole: 'Driver / Yardman'
            },
            {
              id: 'sample-3',
              priority: 'P2 - This Week',
              action: 'Book the next bulk tanker allocation with your refinery supplier',
              rationale: 'Raised when yard stock reaches the low-stock litre threshold you configured in Settings.',
              impactDescription: 'Prevents stockout-driven revenue stoppage at the counter.',
              ownerActionRole: 'Managing Director'
            }
          ]).map((decision, index) => (
            <div key={decision.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5">
              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    decision.priority.includes('P1')
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                  }`}>
                    {decision.priority}
                  </span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {decision.action}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
                  {decision.rationale} · <strong className="text-emerald-600 dark:text-emerald-400">{decision.impactDescription}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Tank Inventory Runway: Simple 2-Bar Comparison */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Inventory Depletion Runway
          </h2>
          <span className="text-xs text-slate-400">Calculated from 7-day counter sales</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bulk (tank-fed) oil — the depot's own configured product */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {bulkProductName}
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                {bulkYardLitres.toLocaleString()} L
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {vegRunway ?? '—'}
              </span>
              <span className="text-xs text-slate-500">days of sales remaining</span>
            </div>
            <div className="mt-2.5 w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: runwayBarWidth(vegRunway) }} />
            </div>
            <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              {vegForecast?.reorderRecommendation || 'No audit has been run yet — generate a fresh audit for reorder guidance.'}
            </p>
          </div>

          {/* Pre-kegged / container oil — the depot's own configured product */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                {kegProductName}
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                {kegYardLitres.toLocaleString()} L
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                {palmRunway ?? '—'}
              </span>
              <span className="text-xs text-slate-500">days of sales remaining</span>
            </div>
            <div className="mt-2.5 w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: runwayBarWidth(palmRunway) }} />
            </div>
            <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              {palmForecast?.reorderRecommendation || 'No audit has been run yet — generate a fresh audit for reorder guidance.'}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Executive Copilot: Clean, Conversational, Focused */}
      <div className="p-6 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Ask AI Operations Copilot
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase">
            {provider} intelligence
          </span>
        </div>

        {/* Quick Question Chips: Operations & External Market Intelligence */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { text: 'Search live Mile 12 & Daleko oil prices', isWeb: true },
            { text: 'Search diesel price & freight rates', isWeb: true },
            { text: 'Benchmark CPO prices & import tariffs', isWeb: true },
            { text: 'Who owes us the most money on debt?', isWeb: false },
            { text: 'When should we book our next tanker?', isWeb: false },
            { text: 'Is Pump 2 leaking or unmetered?', isWeb: false }
          ].map(prompt => (
            <button
              key={prompt.text}
              onClick={() => handleSendChat(prompt.text)}
              disabled={isChatLoading}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50 text-xs flex items-center gap-1.5 ${
                prompt.isWeb
                  ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-600/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80'
              }`}
            >
              {prompt.isWeb && <Globe className="w-3 h-3 text-amber-400" />}
              <span>{prompt.text}</span>
            </button>
          ))}
        </div>

        {/* Conversation Box */}
        <div className="max-h-64 overflow-y-auto space-y-2.5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs font-sans">
          {chatMessages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] p-3 rounded-xl leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white font-medium'
                    : 'bg-slate-800 text-slate-200 border border-slate-700/50'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 px-1 font-mono">
                {msg.timestamp}
              </span>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex items-center gap-2 text-brand-400 text-xs py-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Claude is researching market records & drafting executive answer...</span>
            </div>
          )}
        </div>

        {/* Clean Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendChat();
          }}
          className="flex items-center gap-2 pt-1"
        >
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Ask about debt balances, tanks, or search live market prices (Mile 12, Daleko, CPO, Diesel)..."
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isChatLoading}
            className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
};
