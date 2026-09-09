import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import { BottomSheet } from '../components/common/BottomSheet';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { useIsDesktopSplit } from '../hooks/useBreakpoint';
import { formatNaira, formatDepotDate, formatDepotTime, computeShiftCash, getDepotToday, depotDateKey } from '../services/businessLogic';
import {
  DollarSign,
  CreditCard,
  Package,
  Boxes,
  Truck,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Droplet,
  Fuel,
  Gauge,
  CheckCircle2,
  Banknote,
  Ruler,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  PlusCircle
} from 'lucide-react';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const {
    todayStats,
    tankStockByProduct,
    activeAlerts,
    kegInventory,
    tanks,
    pumps,
    pumpVarianceAudits,
    orders,
    expenses,
    settings,
    activeShift,
    startShift,
    closeShift,
    customers,
    customerStatsMap,
    products,
    userRole
  } = useStore();

  const vegStock = tankStockByProduct['veg']?.totalLitres || 0;
  const redStock = tankStockByProduct['red']?.totalLitres || 0;

  const todayStr = getDepotToday();
  const isDesktop = useIsDesktopSplit();
  const DisclosureContainer = isDesktop ? SlideOverDrawer : BottomSheet;

  const vegProduct = products.find(p => p.id === 'veg') || products[0];
  const redProduct = products.find(p => p.id === 'red') || products[1] || products[0];
  const vegLitresPerKeg = vegProduct?.litres_per_keg || 30;
  const redLitresPerKeg = redProduct?.litres_per_keg || 25;

  const vegKegsSoldToday = orders
    .filter(o => depotDateKey(o.date) === todayStr && o.product_id === 'veg' && o.unit === 'keg')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  const redKegsSoldToday = orders
    .filter(o => depotDateKey(o.date) === todayStr && o.product_id === 'red' && o.unit === 'keg')
    .reduce((sum, o) => sum + Number(o.qty || 0), 0);

  // Progressive Disclosure States (Side Drawer on Desktop ≥900px, Bottom Sheet on Mobile)
  const [activeStatSheet, setActiveStatSheet] = useState<
    'cash' | 'credit' | 'kegs_out' | 'depot_kegs' | 'customer_kegs' | 'expenses' | null
  >(null);
  const [selectedAlert, setSelectedAlert] = useState<{
    id: string;
    type: string;
    title: string;
    subtitle: string;
    details?: string;
    severity: 'red' | 'amber';
    actionLabel: string;
    action: () => void;
  } | null>(null);
  const [isAllAlertsOpen, setIsAllAlertsOpen] = useState(false);

  // Shift Management State
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [cashierInput, setCashierInput] = useState('Counter Staff');
  const [openingFloatInput, setOpeningFloatInput] = useState(settings.default_daily_float?.toString() || '50000');
  const [startNotesInput, setStartNotesInput] = useState('');

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [cashCountedInput, setCashCountedInput] = useState('');
  const [closeNotesInput, setCloseNotesInput] = useState('');
  const [shiftFeedback, setShiftFeedback] = useState<string | null>(null);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Live Shift Metrics for active shift (same function used by shift close & today's stats)
  const shiftMetrics = useMemo(() => {
    if (!activeShift) return null;
    return computeShiftCash(activeShift, orders, expenses, new Date());
  }, [activeShift, orders, expenses]);

  const liveCloseVariance = useMemo(() => {
    if (!shiftMetrics || !cashCountedInput) return null;
    const counted = parseFloat(cashCountedInput);
    if (isNaN(counted)) return null;
    return counted - shiftMetrics.expectedCash;
  }, [shiftMetrics, cashCountedInput]);

  const handleStartShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError(null);
    const floatNum = parseFloat(openingFloatInput) || 0;
    const res = startShift({
      cashierName: cashierInput.trim() || 'Counter Staff',
      openingFloat: floatNum,
      notes: startNotesInput.trim() || undefined
    });
    if (res.success) {
      setIsStartShiftModalOpen(false);
      setStartNotesInput('');
      setShiftFeedback('New shift opened successfully.');
      setTimeout(() => setShiftFeedback(null), 4000);
    } else {
      setShiftError(res.error || 'Could not start the shift.');
    }
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError(null);
    if (!activeShift) return;
    const counted = parseFloat(cashCountedInput);
    if (isNaN(counted) || counted < 0) return;

    const res = closeShift({
      shiftId: activeShift.id,
      cashCounted: counted,
      notes: closeNotesInput.trim() || undefined
    });

    if (res.success) {
      setIsCloseShiftModalOpen(false);
      setCashCountedInput('');
      setCloseNotesInput('');
      setShiftFeedback('Shift reconciled and closed successfully.');
      setTimeout(() => setShiftFeedback(null), 4000);
    } else {
      setShiftError(res.error || 'Could not close the shift.');
    }
  };

  // Flatten and prioritize all active operational alerts for mobile condensed view
  const allAlertsList = useMemo(() => {
    const list: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      details?: string;
      severity: 'red' | 'amber';
      actionLabel: string;
      action: () => void;
    }> = [];

    // 1. Overdue credit invoices (Critical Red)
    activeAlerts.overdueCredit.forEach(a => {
      list.push({
        id: `overdue-${a.customer.id}`,
        type: 'Overdue Credit Invoice',
        title: `${a.customer.name} (Overdue ${a.overdueDays}d)`,
        subtitle: `Balance: ${formatNaira(a.amount)} · Terms: ${a.customer.credit_term_days}d`,
        details: `Customer has exceeded their agreed ${a.customer.credit_term_days}-day credit terms by ${a.overdueDays} days. Credit sales should be paused until this invoice is settled.`,
        severity: 'red',
        actionLabel: 'Open Customer Ledger',
        action: () => onNavigate('customers')
      });
    });

    // 2. Credit limit breaches (Critical Red)
    activeAlerts.overLimit.forEach(a => {
      list.push({
        id: `limit-${a.customer.id}`,
        type: 'Credit Limit Breach',
        title: `${a.customer.name} (Limit Exceeded)`,
        subtitle: `Balance: ${formatNaira(a.balance)} | Limit: ${formatNaira(a.limit)} (+${formatNaira(a.excess)} over)`,
        details: `Customer open balance of ${formatNaira(a.balance)} exceeds authorized ceiling of ${formatNaira(a.limit)} by ${formatNaira(a.excess)}.`,
        severity: 'red',
        actionLabel: 'Review Customer Account',
        action: () => onNavigate('customers')
      });
    });

    // 3. Shift cash discrepancies (Critical Red)
    activeAlerts.shiftDiscrepancy.forEach(s => {
      list.push({
        id: `shift-${s.id}`,
        type: 'Shift Cash Discrepancy',
        title: `Shift Cashier: ${s.cashier_name || 'Counter Staff'}`,
        subtitle: `Discrepancy: ${s.cash_variance! > 0 ? '+' : ''}${formatNaira(s.cash_variance!)} · Counted: ${formatNaira(s.cash_counted || 0)}`,
        details: `Physical till count (${formatNaira(s.cash_counted || 0)}) did not match ledger expected balance (${formatNaira(s.expected_cash || 0)}). Cash variance recorded: ${formatNaira(s.cash_variance!)}.`,
        severity: 'red',
        actionLabel: 'Review Shift Ledger',
        action: () => {}
      });
    });

    // 4. Pump meter variance (Amber)
    activeAlerts.pumpVariance.forEach((p, idx) => {
      list.push({
        id: `pump-${idx}`,
        type: 'Pump Meter Variance',
        title: `${p.pumpLabel} (${p.variance > 0 ? '+' : ''}${p.variance}L Variance)`,
        subtitle: `Meter delta: +${p.meterDelta}L vs logged orders: ${p.expectedLitres}L`,
        details: `Mechanical pump odometer advanced by ${p.meterDelta}L, while logged dispense orders total ${p.expectedLitres}L. Difference of ${p.variance}L exceeds threshold.`,
        severity: 'amber',
        actionLabel: 'Audit Dispense Orders',
        action: () => onNavigate('order')
      });
    });

    // 5. Truck delivery shortfalls (Amber)
    activeAlerts.deliveryShortfall.forEach((d, idx) => {
      list.push({
        id: `shortfall-${idx}`,
        type: 'Truck Intake Shortfall',
        title: `${d.tank.truck_label} (-${d.shortfallLitres}L Shortfall)`,
        subtitle: `Received: ${d.tank.received_litres.toLocaleString()}L on ${formatDepotDate(d.tank.date)}`,
        details: `Offload shortfall of ${d.shortfallLitres}L exceeds ${settings.truck_shortfall_threshold}L threshold. Driver/supplier delivery variance flagged.`,
        severity: 'amber',
        actionLabel: 'Inspect Truck Intake',
        action: () => onNavigate('intake')
      });
    });

    // 6. Tank dipstick variances (Amber)
    activeAlerts.dipstickVariance.forEach((d, idx) => {
      list.push({
        id: `dip-${idx}`,
        type: 'Tank Dipstick Variance',
        title: `${d.tank.truck_label} (${d.variance > 0 ? '+' : ''}${d.variance}L Stick Variance)`,
        subtitle: `Physical reading: ${d.reading.reading_litres.toLocaleString()}L on ${formatDepotDate(d.reading.recorded_at)}`,
        details: `Physical stick gauge (${d.reading.reading_litres.toLocaleString()}L) deviates from cumulative storage ledger (${d.tank.remaining_litres.toLocaleString()}L) by ${d.variance}L.`,
        severity: 'amber',
        actionLabel: 'Verify Tank Dipstick',
        action: () => onNavigate('intake')
      });
    });

    // 7. Tank running low on stock (Amber)
    activeAlerts.lowTankStock.forEach(a => {
      list.push({
        id: `lowtank-${a.product.id}`,
        type: 'Tank Running Low',
        title: `${a.product.name} (${a.litres.toLocaleString()}L left)`,
        subtitle: `Below ${a.threshold.toLocaleString()}L reorder threshold`,
        details: `Combined active tank stock for ${a.product.name} has fallen to ${a.litres.toLocaleString()}L, under the ${a.threshold.toLocaleString()}L low-stock threshold. Schedule a resupply intake before stock runs out.`,
        severity: 'amber',
        actionLabel: 'Open Truck Intake',
        action: () => onNavigate('intake')
      });
    });

    return list;
  }, [activeAlerts, settings.truck_shortfall_threshold, onNavigate]);

  return (
    <div className="space-y-6 pb-20">
      {/* EXECUTIVE AI INTELLIGENCE BANNER (OWNER ONLY) */}
      {userRole === 'owner' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-brand-950 text-white border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-wide">
                  Executive AI Operations Advisor
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  Gemini & Claude
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Run on-demand audits across tank depletion runway, pump variances, and customer credit exposure.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('ai-advisor')}
            className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 flex-shrink-0"
          >
            <span>Open Executive AI Hub</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SHIFT HANDOVER & CASH RECONCILIATION BANNER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        {shiftFeedback && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[12px] font-sans text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shiftFeedback}</span>
          </div>
        )}

        {shiftError && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[12px] font-sans text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{shiftError}</span>
            <button type="button" onClick={() => setShiftError(null)} className="ml-auto text-rose-500 hover:text-rose-700 dark:hover:text-rose-200">✕</button>
          </div>
        )}

        <div className="flex flex-col split:flex-row split:items-center justify-between gap-4">
          {/* Left: Shift Info */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                activeShift
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                  {activeShift ? 'Shift open' : 'No shift open'}
                </span>
                {activeShift ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Open Shift
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    Shift Closed
                  </span>
                )}
              </div>

              <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                {activeShift
                  ? `Cashier: ${activeShift.cashier_name || 'Counter Staff'} · Started ${formatDepotTime(activeShift.start_time)} · Cash is being tracked live`
                  : 'Start a shift to record the opening cash and check the drawer against sales at the end.'}
              </p>
            </div>
          </div>

          {/* Middle: Live Ledger Reconciliation (if active shift) */}
          {activeShift && shiftMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[12px]">
              <div>
                <span className="text-[10px] font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Opening Float
                </span>
                <span className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
                  {formatNaira(activeShift.opening_float)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Cash Sales
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatNaira(shiftMetrics.cashSales)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                  Cash Expenses
                </span>
                <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                  -{formatNaira(shiftMetrics.cashExpenses)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Expected Cash
                </span>
                <span className="font-mono tabular-nums font-bold text-brand-600 dark:text-brand-400">
                  {formatNaira(shiftMetrics.expectedCash)}
                </span>
              </div>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2 self-start split:self-auto">
            {activeShift ? (
              <button
                type="button"
                onClick={() => {
                  setCashCountedInput('');
                  setCloseNotesInput('');
                  setIsCloseShiftModalOpen(true);
                }}
                className="px-3.5 py-2 text-[12px] font-sans font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 hover:border-rose-300 dark:border-rose-800 transition-all shadow-sm flex items-center gap-1.5"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Count cash & end shift</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpeningFloatInput(settings.default_daily_float?.toString() || '50000');
                  setStartNotesInput('');
                  setIsStartShiftModalOpen(true);
                }}
                className="px-4 py-2 text-[12px] font-sans font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Start New Shift</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stat Grid (7 Metric Cards - Responsive Grid with Clean Typography & Alignment) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-3.5">
        {/* 1. Cash / Transfer Sales Today */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('cash')}
          className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800/80 transition-all shadow-sm cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span className="text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Cash & Transfer
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div
            title={formatNaira(todayStats.cashTransferSales)}
            className="text-[20px] sm:text-[22px] lg:text-[24px] 2xl:text-[22px] font-heading font-black tabular-nums tracking-tight leading-none text-emerald-600 dark:text-emerald-400 truncate my-1"
          >
            {formatNaira(todayStats.cashTransferSales)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="truncate">Collected today</span>
            <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold sm:hidden shrink-0">
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* 2. Kegs Sold Today */}
        <button
          type="button"
          onClick={() => onNavigate('order')}
          className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-800/80 transition-all shadow-sm cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span className="text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Kegs Sold Today
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-center shrink-0">
              <Boxes className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 truncate my-1">
            <span className="text-[22px] sm:text-[24px] lg:text-[26px] 2xl:text-[24px] font-heading font-black tabular-nums tracking-tight leading-none text-slate-900 dark:text-white">
              {todayStats.kegsSoldToday}
            </span>
            <span className="text-xs sm:text-[13px] font-sans font-semibold text-slate-500 dark:text-slate-400">
              kegs
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="truncate">
              {todayStats.purchasedKegsToday > 0 ? `${todayStats.purchasedKegsToday} outright` : 'Discharged today'}
            </span>
            <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold sm:hidden shrink-0">
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* 3. Credit Outstanding (Credit Ledger) */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('credit')}
          className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700 transition-all shadow-sm cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span className="text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 truncate">
              Credit Ledger
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-100/70 dark:bg-rose-900/40 border border-rose-200/80 dark:border-rose-800/50 flex items-center justify-center shrink-0">
              <CreditCard className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div
            title={formatNaira(todayStats.creditOutstanding)}
            className="text-[20px] sm:text-[22px] lg:text-[24px] 2xl:text-[22px] font-heading font-black tabular-nums tracking-tight leading-none text-rose-600 dark:text-rose-400 truncate my-1"
          >
            {formatNaira(todayStats.creditOutstanding)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1.5 pt-1.5 border-t border-rose-100 dark:border-rose-950/60">
            <span className="truncate">Total open balance</span>
            <span className="inline-flex items-center gap-0.5 text-rose-700 dark:text-rose-300 font-bold sm:hidden shrink-0">
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* 4. Company Kegs Out */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('kegs_out')}
          className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span className="text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Company Kegs Out
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 truncate my-1">
            <span className="text-[22px] sm:text-[24px] lg:text-[26px] 2xl:text-[24px] font-heading font-black tabular-nums tracking-tight leading-none text-slate-900 dark:text-white">
              {todayStats.companyKegsOut}
            </span>
            <span className="text-xs sm:text-[13px] font-sans font-semibold text-slate-500 dark:text-slate-400">
              kegs
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="truncate">In customer custody</span>
            <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold sm:hidden shrink-0">
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* 5. Kegs at Depot */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('depot_kegs')}
          className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all shadow-sm cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-600/60 shadow-rose-500/10 animate-pulse'
              : 'bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span
              className={`text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider truncate ${
                kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Kegs at Depot
            </span>
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 border ${
              kegInventory.isDepotStockCritical
                ? 'bg-rose-100 dark:bg-rose-900/50 border-rose-300 dark:border-rose-700'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60'
            }`}>
              <Boxes
                className={`w-3.5 h-3.5 ${
                  kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
                } group-hover:scale-110 transition-transform`}
              />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 truncate my-1">
            <span
              className={`text-[22px] sm:text-[24px] lg:text-[26px] 2xl:text-[24px] font-heading font-black tabular-nums tracking-tight leading-none ${
                kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
              }`}
            >
              {todayStats.kegsAtDepot}
            </span>
            <span className="text-xs sm:text-[13px] font-sans font-semibold text-slate-500 dark:text-slate-400">
              kegs
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="truncate text-slate-500 dark:text-slate-400">
              {kegInventory.isDepotStockCritical ? `CRITICAL < ${settings.kegs_at_depot_low_threshold}` : 'Physical yard stock'}
            </span>
            <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold sm:hidden shrink-0">
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* 6. Customer Kegs */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('customer_kegs')}
          className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span className="text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Customer Kegs
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200/60 dark:border-sky-800/50 flex items-center justify-center shrink-0">
              <Droplet className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 truncate my-1">
            <span className="text-[22px] sm:text-[24px] lg:text-[26px] 2xl:text-[24px] font-heading font-black tabular-nums tracking-tight leading-none text-slate-900 dark:text-white">
              {todayStats.customerKegsFilledToday}
            </span>
            <span className="text-xs sm:text-[13px] font-sans font-semibold text-slate-500 dark:text-slate-400">
              filled
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
            <span className="truncate">Own containers</span>
            <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400 font-bold sm:hidden shrink-0">
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* 7. Expenses Today */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('expenses')}
          className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700 transition-all shadow-sm cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <span className="text-[11px] sm:text-[12px] font-sans font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 truncate">
              Expenses Today
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-100/70 dark:bg-rose-900/40 border border-rose-200/80 dark:border-rose-800/50 flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div
            title={formatNaira(todayStats.expensesToday)}
            className="text-[20px] sm:text-[22px] lg:text-[24px] 2xl:text-[22px] font-heading font-black tabular-nums tracking-tight leading-none text-rose-600 dark:text-rose-400 truncate my-1"
          >
            {formatNaira(todayStats.expensesToday)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1.5 pt-1.5 border-t border-rose-100 dark:border-rose-950/60">
            <span className="truncate">Float: {formatNaira(todayStats.dailyFloatRemaining)}</span>
            <span className="inline-flex items-center gap-0.5 text-rose-700 dark:text-rose-300 font-bold sm:hidden shrink-0">
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>

      {/* DEPOT PUMPS LIVE METER STATUS SECTION */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white">
                Depot Dispense Pumps & Meter Audit Status
              </h3>
              <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
                Continuous odometer tracking to catch unlogged counter sales at the pump.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('order')}
            className="text-[12px] font-sans font-semibold text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Record Pump Reading</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pumps.map(pump => {
            const isVeg = pump.product_id === 'veg';
            
            // Calculate total litres dispensed today on this pump
            const todayPumpLitres = orders
              .filter(o => {
                return depotDateKey(o.date) === todayStr && o.pump_id === pump.id;
              })
              .reduce((sum, o) => sum + Number(o.litres || 0), 0);

            // Check if there is any active variance alert on this pump
            const pumpAudits = pumpVarianceAudits.filter(a => a.pumpId === pump.id);
            const latestAudit = pumpAudits[pumpAudits.length - 1];
            const hasAlert = latestAudit && latestAudit.isOverThreshold;

            return (
              <div
                key={pump.id}
                className={`p-4 rounded-xl border transition-all ${
                  hasAlert
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-400 dark:border-rose-800'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-sans font-bold text-[14px] text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                    />
                    <span>{pump.label}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums font-bold ${
                    hasAlert
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300'
                  }`}>
                    {hasAlert ? `Variance Alert (${latestAudit.variance > 0 ? '+' : ''}${latestAudit.variance}L)` : 'Meter Normal'}
                  </span>
                </div>

                <div className="space-y-1.5 text-[12px] font-mono tabular-nums">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">Pump total:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {pump.last_meter_reading.toLocaleString()} L
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">Dispensed Today:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {todayPumpLitres.toLocaleString()} L
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volumetric Tanks Level Overview Grid */}
      <div className="grid grid-cols-1 split:grid-cols-2 gap-6">
        {/* Golden Vegetable Oil Active Tanks Overview */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              <div>
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white">
                  Golden Vegetable Oil Tanks
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
                  About 1,090 L per ton · oldest tank used first
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[14px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {vegStock.toLocaleString()} L
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 block">
                ≈ {(vegStock / vegLitresPerKeg).toFixed(0)} Kegs ({vegLitresPerKeg}L)
              </span>
              <span className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                Sold Today: {vegKegsSoldToday} kegs
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center justify-items-center py-2">
            {/* Primary combined gauge */}
            <TankGauge
              productId="veg"
              productName="Veg Oil Depletion"
              remainingLitres={vegStock}
              totalCapacityLitres={30000}
              size="lg"
            />

            {/* Individual active veg tanks list */}
            <div className="w-full space-y-2.5">
              <div className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active In-Feed Tanks
              </div>
              {tanks
                .filter(t => t.product_id === 'veg')
                .map((t, idx) => {
                  const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[12px] font-mono tabular-nums"
                    >
                      <div className="space-y-0.5 font-sans">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                            Tank #{idx + 1}
                          </span>
                          <span>{t.truck_label}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Intake: {formatDepotDate(t.date)} · Received: {t.received_litres.toLocaleString()}L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {t.remaining_litres.toLocaleString()} L
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {pct.toFixed(0)}% full
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Red / Palm Oil Active Tanks Overview */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              <div>
                <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white">
                  Red / Palm Oil Tanks
                </h3>
                <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
                  About 1,085 L per ton · oldest tank used first
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[14px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {redStock.toLocaleString()} L
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 block">
                ≈ {(redStock / redLitresPerKeg).toFixed(0)} Kegs ({redLitresPerKeg}L)
              </span>
              <span className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                Sold Today: {redKegsSoldToday} kegs
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center justify-items-center py-2">
            {/* Primary combined gauge */}
            <TankGauge
              productId="red"
              productName="Palm Oil Depletion"
              remainingLitres={redStock}
              totalCapacityLitres={15000}
              size="lg"
            />

            {/* Individual active red tanks list */}
            <div className="w-full space-y-2.5">
              <div className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active In-Feed Tanks
              </div>
              {tanks
                .filter(t => t.product_id === 'red')
                .map((t, idx) => {
                  const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[12px] font-mono tabular-nums"
                    >
                      <div className="space-y-0.5 font-sans">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono">
                            Tank #{idx + 1}
                          </span>
                          <span>{t.truck_label}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Intake: {formatDepotDate(t.date)} · Received: {t.received_litres.toLocaleString()}L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {t.remaining_litres.toLocaleString()} L
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {pct.toFixed(0)}% full
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Split Alert Stream: SEVEN DISTINCT ALERT TYPES (Desktop 3-col, Tablet 2-col, Mobile 1-col) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Things that need attention</span>
          </h3>
          <span className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
            {activeAlerts.totalAlertCount === 0
              ? 'Nothing needs attention right now'
              : `${activeAlerts.totalAlertCount} to check`}
          </span>
        </div>

        {/* MOBILE CONDENSED ALERTS VIEW (<= 3 items + View All N button) */}
        <div className="sm:hidden space-y-2.5">
          {allAlertsList.length === 0 ? (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-center text-[12px] font-sans text-slate-500 dark:text-slate-400">
              Nothing needs attention right now.
            </div>
          ) : (
            <>
              {allAlertsList.slice(0, 3).map(alert => (
                <button
                  type="button"
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 active:scale-98 transition-all cursor-pointer ${
                    alert.severity === 'red'
                      ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                      : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        alert.severity === 'red' ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-sans font-bold text-slate-900 dark:text-white truncate">
                        {alert.title}
                      </div>
                      <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 truncate">
                        {alert.subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
              {allAlertsList.length > 3 && (
                <button
                  type="button"
                  onClick={() => setIsAllAlertsOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[12px] font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 active:scale-98"
                >
                  <span>View all {allAlertsList.length} operational alerts</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* DESKTOP ALERT GRID */}
        <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Alert Stream 1: Overdue Credit Invoices */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-[12px] font-sans uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>1. Overdue Invoices</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                  {activeAlerts.overdueCredit.length}
                </span>
              </div>

              {activeAlerts.overdueCredit.length === 0 ? (
                <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                  No overdue credit accounts.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.overdueCredit.map(alert => (
                    <div
                      key={alert.customer.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('customers')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('customers'); } }}
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.customer.name}</div>
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono tabular-nums font-semibold">
                          Overdue by {alert.overdueDays} days
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                          {formatNaira(alert.amount)}
                        </div>
                        <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400 flex items-center justify-end gap-0.5">
                          View <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 2: Over Credit Limit Breaches */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-[12px] font-sans uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>2. Credit Cap Breaches</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                  {activeAlerts.overLimit.length}
                </span>
              </div>

              {activeAlerts.overLimit.length === 0 ? (
                <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                  All accounts within approved credit caps.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.overLimit.map(alert => (
                    <div
                      key={alert.customer.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('customers')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('customers'); } }}
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.customer.name}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                          Limit: {formatNaira(alert.limit)}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="font-bold text-rose-800 dark:text-rose-300">
                          {formatNaira(alert.balance)}
                        </div>
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                          +{formatNaira(alert.excess)} over
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 3: Delivery Shortfall Flags (> settings.truck_shortfall_threshold) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-[12px] font-sans uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>3. Truck Shortfall (&gt; {settings.truck_shortfall_threshold}L)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                  {activeAlerts.deliveryShortfall.length}
                </span>
              </div>

              {activeAlerts.deliveryShortfall.length === 0 ? (
                <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                  No high-variance intakes logged.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.deliveryShortfall.map((alert, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('intake')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('intake'); } }}
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.tank.truck_label}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {formatDepotDate(alert.tank.date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                          -{alert.shortfallLitres} L
                        </div>
                        <span className="text-[11px] font-sans text-slate-500 flex items-center justify-end gap-0.5">
                          Audit <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 4: Pump Meter Variance Audits (> settings.pump_variance_threshold) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-900/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900/60 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-[12px] font-sans uppercase tracking-wider">
                  <Gauge className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>4. Pump Meter Variance</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30">
                  {activeAlerts.pumpVariance.length}
                </span>
              </div>

              {activeAlerts.pumpVariance.length === 0 ? (
                <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                  All pump meter deltas align with logged orders.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.pumpVariance.map((audit, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('order')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('order'); } }}
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{audit.pumpLabel}</div>
                        <div className="text-[11px] text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                          Meter: +{audit.meterDelta}L | Logged: {audit.expectedLitres}L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                          {audit.variance > 0 ? `+${audit.variance}` : audit.variance} L
                        </div>
                        <span className="text-[11px] font-sans text-slate-500 flex items-center justify-end gap-0.5">
                          Audit <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 5: Tank Dipstick Variance Flags (> settings.dipstick_variance_threshold) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-amber-200 dark:border-amber-900/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/60 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-[12px] font-sans uppercase tracking-wider">
                  <Ruler className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>5. Tank Dipstick Variance</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                  {activeAlerts.dipstickVariance.length}
                </span>
              </div>

              {activeAlerts.dipstickVariance.length === 0 ? (
                <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                  All storage tanks verify within ±{settings.dipstick_variance_threshold}L stick limit.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.dipstickVariance.map((alert, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('intake')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('intake'); } }}
                      className="cursor-pointer p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.tank.truck_label}</div>
                        <div className="text-[11px] text-amber-800 dark:text-amber-300 font-mono tabular-nums">
                          Physical: {alert.reading.reading_litres.toLocaleString()} L · {formatDepotDate(alert.reading.recorded_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                          {alert.variance > 0 ? `+${alert.variance}` : alert.variance} L
                        </div>
                        <span className="text-[11px] font-sans text-slate-500 flex items-center justify-end gap-0.5">
                          Inspect <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 6: Shift Drawer Cash Discrepancies */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-[12px] font-sans uppercase tracking-wider">
                  <Banknote className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>6. Shift Drawer Discrepancy</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30">
                  {activeAlerts.shiftDiscrepancy.length}
                </span>
              </div>

              {activeAlerts.shiftDiscrepancy.length === 0 ? (
                <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                  All past shifts balanced perfectly to zero variance.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.shiftDiscrepancy.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">
                          {s.cashier_name || 'Counter Cashier'}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                          Counted: {formatNaira(s.cash_counted || 0)} | Expected: {formatNaira(s.expected_cash || 0)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                          {s.cash_variance! > 0 ? `+${formatNaira(s.cash_variance!)}` : formatNaira(s.cash_variance!)}
                        </div>
                        <span className="text-[10px] font-sans text-slate-500 block">
                          {formatDepotDate(s.start_time)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 7: Tank Running Low on Stock (< settings.low_stock_litres_threshold) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-amber-200 dark:border-amber-900/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/60 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-[12px] font-sans uppercase tracking-wider">
                  <Droplet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>7. Tank Running Low (&lt; {settings.low_stock_litres_threshold}L)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                  {activeAlerts.lowTankStock.length}
                </span>
              </div>

              {activeAlerts.lowTankStock.length === 0 ? (
                <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                  All products above the low-stock threshold.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.lowTankStock.map(alert => (
                    <div
                      key={alert.product.id}
                      onClick={() => onNavigate('intake')}
                      className="cursor-pointer p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.product.name}</div>
                        <div className="text-[11px] text-amber-800 dark:text-amber-300 font-mono tabular-nums">
                          Reorder threshold: {alert.threshold.toLocaleString()} L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300">
                          {alert.litres.toLocaleString()} L left
                        </div>
                        <span className="text-[11px] font-sans text-slate-500 flex items-center justify-end gap-0.5">
                          Restock <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Start New Shift */}
      {isStartShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                    Start Counter Cash Shift
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
                    Open daily ledger cash reconciliation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStartShiftModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartShiftSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cashier Name / On-Duty Staff *
                </label>
                <input
                  type="text"
                  required
                  value={cashierInput}
                  onChange={e => setCashierInput(e.target.value)}
                  placeholder="e.g. Fatima Yusuf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-[12px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Opening Cash Float (NGN) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="100"
                    min="0"
                    required
                    value={openingFloatInput}
                    onChange={e => setOpeningFloatInput(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-2.5 text-[12px] font-mono text-slate-400">
                    NGN
                  </span>
                </div>
                <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-1">
                  Physical cash placed in the cash drawer at shift start to make customer change.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-sans font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Shift Notes / Handover Details (Optional)
                </label>
                <input
                  type="text"
                  value={startNotesInput}
                  onChange={e => setStartNotesInput(e.target.value)}
                  placeholder="e.g. Morning shift, clean till, 50k denominations verified"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsStartShiftModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-sans font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-sans font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Open Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reconcile and Close Shift */}
      {isCloseShiftModalOpen && activeShift && shiftMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                    Count cash & end shift
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
                    Cashier: {activeShift.cashier_name || 'Counter Staff'} · Started at {formatDepotTime(activeShift.start_time)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Shift Cash Reconciliation Breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-[13px] font-mono tabular-nums">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Opening Float:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatNaira(activeShift.opening_float)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-sans">(+) Cash Sales (Counter):</span>
                  <span className="font-semibold">
                    +{formatNaira(shiftMetrics.cashSales)}
                  </span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span className="font-sans">(-) Cash Expenses Paid:</span>
                  <span className="font-semibold">
                    -{formatNaira(shiftMetrics.cashExpenses)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-[15px]">
                  <span className="font-sans text-slate-900 dark:text-white">(=) Expected Cash in Drawer:</span>
                  <span className="text-brand-600 dark:text-brand-400">
                    {formatNaira(shiftMetrics.expectedCash)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Cash Counted in Drawer (NGN) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="100"
                    min="0"
                    required
                    value={cashCountedInput}
                    onChange={e => setCashCountedInput(e.target.value)}
                    placeholder="e.g. 524000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-[16px] font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-2.5 text-[12px] font-mono text-slate-400">
                    NGN
                  </span>
                </div>
                <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-1">
                  Count all banknotes in the till before handing over the drawer keys.
                </p>
              </div>

              {/* Live Reconciliation Feedback */}
              {liveCloseVariance !== null && (
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    Math.abs(liveCloseVariance) < 0.01
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/60'
                      : liveCloseVariance < 0
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[12px] font-sans">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Drawer Variance (Counted - Expected):
                    </span>
                    <span
                      className={`font-mono tabular-nums font-bold text-[15px] ${
                        Math.abs(liveCloseVariance) < 0.01
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : liveCloseVariance < 0
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {liveCloseVariance > 0
                        ? `+${formatNaira(liveCloseVariance)}`
                        : formatNaira(liveCloseVariance)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-sans flex items-center gap-1.5">
                    {Math.abs(liveCloseVariance) < 0.01 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-300">
                          Cash drawer balances perfectly with zero discrepancy.
                        </span>
                      </>
                    ) : liveCloseVariance < 0 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="text-rose-700 dark:text-rose-300 font-semibold">
                          Cash shortage of {formatNaira(Math.abs(liveCloseVariance))}. This discrepancy will be recorded in the shift audit log.
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="text-amber-700 dark:text-amber-300">
                          Cash surplus of {formatNaira(liveCloseVariance)}. Verify all customer receipts.
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-sans font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Handover Notes / Supervisor Sign-off (Optional)
                </label>
                <input
                  type="text"
                  value={closeNotesInput}
                  onChange={e => setCloseNotesInput(e.target.value)}
                  placeholder="e.g. Handed over to evening cashier Sunday, small change verified"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-sans font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-sans font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Close Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* STAT BREAKDOWN PROGRESSIVE DISCLOSURE (Side Drawer on Desktop ≥900px, Bottom Sheet on Mobile) */}
      <DisclosureContainer
        isOpen={!!activeStatSheet}
        onClose={() => setActiveStatSheet(null)}
        title={
          activeStatSheet === 'cash'
            ? 'Cash & Transfer Sales Today'
            : activeStatSheet === 'credit'
            ? 'Credit Ledger Outstanding'
            : activeStatSheet === 'kegs_out'
            ? 'Company Keg Custody'
            : activeStatSheet === 'depot_kegs'
            ? 'Depot Yard Keg Inventory'
            : activeStatSheet === 'customer_kegs'
            ? 'Customer-Owned Kegs Dispensed'
            : activeStatSheet === 'expenses'
            ? "Today's Operating Expenses"
            : ''
        }
        subtitle={
          activeStatSheet === 'cash'
            ? `${formatNaira(todayStats.cashTransferSales)} collected today`
            : activeStatSheet === 'credit'
            ? `${formatNaira(todayStats.creditOutstanding)} total open balance`
            : activeStatSheet === 'kegs_out'
            ? `${todayStats.companyKegsOut} kegs in customer custody`
            : activeStatSheet === 'depot_kegs'
            ? `${todayStats.kegsAtDepot} kegs available on yard`
            : activeStatSheet === 'customer_kegs'
            ? `${todayStats.customerKegsFilledToday} containers filled today`
            : activeStatSheet === 'expenses'
            ? `${formatNaira(todayStats.expensesToday)} total spent today`
            : ''
        }
      >
        <div className="space-y-4">
          {/* 1. Cash & Transfer Breakdown */}
          {activeStatSheet === 'cash' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                <span className="text-[13px] font-sans font-semibold text-emerald-800 dark:text-emerald-300">
                  Total Collected Today
                </span>
                <span className="text-[18px] font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                  {formatNaira(todayStats.cashTransferSales)}
                </span>
              </div>

              <div className="text-[12px] font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Today's Paid Transactions
              </div>

              {orders
                .filter(o => {
                  return depotDateKey(o.date) === todayStr && (o.payment_method === 'cash' || o.payment_method === 'transfer');
                })
                .map(order => {
                  const cust = customers.find(c => c.id === order.customer_id);
                  const isCash = order.payment_method === 'cash';
                  return (
                    <div
                      key={order.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[13px]"
                    >
                      <div className="space-y-0.5">
                        <div className="font-sans font-bold text-slate-900 dark:text-white">
                          {cust?.name || 'Counter Sale'}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-sans text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <span
                              className={`w-2 h-2 rounded-full ${isCash ? 'bg-emerald-500' : 'bg-sky-500'}`}
                            />
                            {isCash ? 'Cash' : 'Bank Transfer'}
                          </span>
                          <span>·</span>
                          <span className="font-mono">{order.litres}L</span>
                          <span>·</span>
                          <span>{formatDepotTime(order.date)}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {formatNaira(order.paid_amount || order.amount)}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* 2. Credit Breakdown */}
          {activeStatSheet === 'credit' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                <span className="text-[13px] font-sans font-semibold text-rose-800 dark:text-rose-300">
                  Total Outstanding Credit
                </span>
                <span className="text-[18px] font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                  {formatNaira(todayStats.creditOutstanding)}
                </span>
              </div>

              <div className="text-[12px] font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Accounts with Open Balances
              </div>

              {customers
                .filter(c => (customerStatsMap[c.id]?.currentBalance || 0) > 0)
                .sort(
                  (a, b) =>
                    (customerStatsMap[b.id]?.currentBalance || 0) -
                    (customerStatsMap[a.id]?.currentBalance || 0)
                )
                .map(cust => {
                  const balance = customerStatsMap[cust.id]?.currentBalance || 0;
                  const isOver = balance > (cust.credit_limit || 0);
                  return (
                    <div
                      key={cust.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[13px]"
                    >
                      <div className="space-y-0.5">
                        <div className="font-sans font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{cust.name}</span>
                          {isOver && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-sans font-bold">
                              Over Limit
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                          Limit: {formatNaira(cust.credit_limit)} · Terms: {cust.credit_term_days}d
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                          {formatNaira(balance)}
                        </div>
                      </div>
                    </div>
                  );
                })}

              <button
                type="button"
                onClick={() => {
                  setActiveStatSheet(null);
                  onNavigate('customers');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[13px] font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Open Customers & Ledger</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 3. Company Kegs Out Breakdown */}
          {activeStatSheet === 'kegs_out' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[13px] font-sans font-semibold text-slate-700 dark:text-slate-300">
                  Total in Customer Hands
                </span>
                <span className="text-[18px] font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                  {todayStats.companyKegsOut} kegs
                </span>
              </div>

              <div className="text-[12px] font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Custody by Customer
              </div>

              {customers
                .filter(c => (customerStatsMap[c.id]?.totalCompanyKegsOut || 0) > 0)
                .sort(
                  (a, b) =>
                    (customerStatsMap[b.id]?.totalCompanyKegsOut || 0) -
                    (customerStatsMap[a.id]?.totalCompanyKegsOut || 0)
                )
                .map(cust => {
                  const count = customerStatsMap[cust.id]?.totalCompanyKegsOut || 0;
                  return (
                    <div
                      key={cust.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[13px]"
                    >
                      <div className="font-sans font-bold text-slate-900 dark:text-white">
                        {cust.name}
                      </div>
                      <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {count} kegs
                      </div>
                    </div>
                  );
                })}

              <button
                type="button"
                onClick={() => {
                  setActiveStatSheet(null);
                  onNavigate('kegs');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[13px] font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Open Kegs Tracking</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4. Depot Yard Kegs Breakdown */}
          {activeStatSheet === 'depot_kegs' && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  kegInventory.isDepotStockCritical
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                    : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-sans font-medium text-slate-600 dark:text-slate-300">
                    Physical Kegs in Yard:
                  </span>
                  <span className="text-[20px] font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {todayStats.kegsAtDepot} kegs
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12px] font-sans text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span>Minimum Threshold:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {settings.kegs_at_depot_low_threshold} kegs
                  </span>
                </div>
                {kegInventory.isDepotStockCritical && (
                  <div className="text-[11px] font-sans font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Depot inventory is below safety threshold! Recall customer kegs.</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-[12px] font-sans">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total Registered Fleet:</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {settings.total_company_kegs} kegs
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Out with Customers:</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    -{todayStats.companyKegsOut} kegs
                  </span>
                </div>
                <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-700 pt-1.5">
                  <span>Available at Depot:</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {todayStats.kegsAtDepot} kegs
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveStatSheet(null);
                  onNavigate('kegs');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[13px] font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Record Keg Returns</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 5. Customer Kegs Dispensed Breakdown */}
          {activeStatSheet === 'customer_kegs' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[13px] font-sans font-semibold text-slate-700 dark:text-slate-300">
                  Total Customer Containers Filled
                </span>
                <span className="text-[18px] font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                  {todayStats.customerKegsFilledToday} kegs
                </span>
              </div>

              <div className="text-[12px] font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Today's Customer-Keg Dispenses
              </div>

              {orders
                .filter(o => {
                  return depotDateKey(o.date) === todayStr && o.keg_source === 'own';
                })
                .map(order => {
                  const cust = customers.find(c => c.id === order.customer_id);
                  const isVeg = order.product_id === 'veg';
                  return (
                    <div
                      key={order.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[13px]"
                    >
                      <div className="space-y-0.5">
                        <div className="font-sans font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                          />
                          <span>{cust?.name || 'Walk-in'}</span>
                        </div>
                        <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                          {isVeg ? 'Veg Oil' : 'Palm Oil'} · {order.litres}L · {formatDepotTime(order.date)}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {order.qty} filled
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* 6. Expenses Breakdown */}
          {activeStatSheet === 'expenses' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                <span className="text-[13px] font-sans font-semibold text-rose-800 dark:text-rose-300">
                  Total Spent Today
                </span>
                <span className="text-[18px] font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                  {formatNaira(todayStats.expensesToday)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-[12px] font-sans">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Daily Opening Float:</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {formatNaira(activeShift?.opening_float || settings.default_daily_float || 50000)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Spent Out of Float:</span>
                  <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                    -{formatNaira(todayStats.expensesToday)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-700 pt-1.5">
                  <span>Float Remaining:</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatNaira(todayStats.dailyFloatRemaining)}
                  </span>
                </div>
              </div>

              <div className="text-[12px] font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Today's Expense Items
              </div>

              {expenses
                .filter(e => {
                  return depotDateKey(e.date) === todayStr;
                })
                .map(exp => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[13px]"
                  >
                    <div className="space-y-0.5">
                      <div className="font-sans font-bold text-slate-900 dark:text-white">
                        {exp.note || exp.category}
                      </div>
                      <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                        {exp.category} · {formatDepotTime(exp.date)}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                      {formatNaira(exp.amount)}
                    </div>
                  </div>
                ))}

              <button
                type="button"
                onClick={() => {
                  setActiveStatSheet(null);
                  onNavigate('expenses');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[13px] font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Manage Expenses & Float</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </DisclosureContainer>

      {/* SELECTED ALERT DETAIL PROGRESSIVE DISCLOSURE */}
      <DisclosureContainer
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title={selectedAlert?.type || 'Operational Alert'}
        subtitle={selectedAlert?.title || ''}
      >
        {selectedAlert && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                selectedAlert.severity === 'red'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  selectedAlert.severity === 'red' ? 'text-rose-600' : 'text-amber-600'
                }`}
              />
              <div className="space-y-1">
                <div className="text-[14px] font-sans font-bold">{selectedAlert.title}</div>
                <div className="text-[12px] font-mono tabular-nums font-medium opacity-90">
                  {selectedAlert.subtitle}
                </div>
              </div>
            </div>

            {selectedAlert.details && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-[13px] font-sans text-slate-700 dark:text-slate-300 leading-relaxed">
                {selectedAlert.details}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const act = selectedAlert.action;
                setSelectedAlert(null);
                act();
              }}
              className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[14px] font-sans font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span>{selectedAlert.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </DisclosureContainer>

      {/* ALL OPERATIONAL ALERTS PROGRESSIVE DISCLOSURE */}
      <DisclosureContainer
        isOpen={isAllAlertsOpen}
        onClose={() => setIsAllAlertsOpen(false)}
        title="All Operational Alerts"
        subtitle={`${allAlertsList.length} active risk signals`}
      >
        <div className="space-y-2.5">
          {allAlertsList.map(alert => (
            <button
              type="button"
              key={alert.id}
              onClick={() => {
                setIsAllAlertsOpen(false);
                setSelectedAlert(alert);
              }}
              className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 active:scale-98 transition-all cursor-pointer ${
                alert.severity === 'red'
                  ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                  : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    alert.severity === 'red' ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-sans font-bold text-slate-900 dark:text-white truncate">
                    {alert.title}
                  </div>
                  <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 truncate">
                    {alert.subtitle}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      </DisclosureContainer>
    </div>
  );
};
