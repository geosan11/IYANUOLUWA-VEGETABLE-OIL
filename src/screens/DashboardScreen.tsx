import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { useToast } from '../services/toast';
import { usePermissions } from '../services/permissions';
import { TankGauge } from '../components/common/TankGauge';
import { KegVisual25L } from '../components/common/KegVisual25L';
import { PumpOdometerIllustration } from '../components/common/PumpOdometerIllustration';
import { MiniBarChart } from '../components/common/MiniBarChart';
import { DonutChart } from '../components/common/DonutChart';
import { BottomSheet } from '../components/common/BottomSheet';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { Modal } from '../components/common/Modal';
import { useIsDesktopSplit } from '../hooks/useBreakpoint';
import { formatNaira, formatDepotDate, formatDepotTime, computeShiftCash, getDepotToday, depotDateKey, formatWithCommas, parseFromCommas, DEPOT_TZ } from '../services/businessLogic';
import { getPaymentModeTheme } from '../constants/config';
import {
  CurrencyDollar as DollarSign,
  CreditCard,
  Package,
  Truck,
  Warning as AlertTriangle,
  Clock,
  ShieldWarning as ShieldAlert,
  ArrowRight,
  Drop as Droplet,
  GasPump as Fuel,
  Gauge,
  CheckCircle as CheckCircle2,
  Money as Banknote,
  ShieldCheck,
  CaretRight as ChevronRight,
  Sparkle as Sparkles,
  PlusCircle,
  ChartLineUp,
  ChartBar,
  ChartPieSlice,
  Receipt
} from '@phosphor-icons/react';

interface DashboardScreenProps {
  onNavigate: (tab: string) => void;
}

// Cycled by product index so an arbitrary number of products each get a
// distinct, stable accent color instead of a hardcoded veg/red pair.
const PRODUCT_ACCENT_COLORS = ['#F59E0B', '#EF4444', '#0EA5E9', '#8B5CF6', '#10B981', '#EC4899'];

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const {
    todayStats,
    tankStockByProduct,
    activeAlerts,
    kegInventory,
    tanks,
    pumps,
    physicalTanks,
    pumpVarianceAudits,
    orders,
    expenses,
    sales,
    settings,
    activeShift,
    startShift,
    closeShift,
    customers,
    customerStatsMap,
    products,
    currentUser
  } = useStore();
  const { can } = usePermissions();
  const { showToast } = useToast();

  const todayStr = getDepotToday();
  const isDesktop = useIsDesktopSplit();
  const DisclosureContainer = isDesktop ? SlideOverDrawer : BottomSheet;

  const pumpLitresToday = (productId?: string | null) =>
    orders
      .filter(o => !o.voided && depotDateKey(o.date) === todayStr && o.product_id === productId)
      .reduce((sum, o) => sum + Number(o.litres || 0), 0);

  const accentColorFor = (productId?: string | null) => {
    const idx = products.findIndex(p => p.id === productId);
    return PRODUCT_ACCENT_COLORS[idx >= 0 ? idx % PRODUCT_ACCENT_COLORS.length : 0];
  };

  // One stock summary per configured product — drives the "Volumetric Tanks
  // Level Overview" cards below, so adding/removing a product (or deleting
  // the seed 'veg'/'red' ones) is reflected automatically instead of the
  // dashboard silently keeping two hardcoded slots.
  const productStockSummaries = products.map(p => {
    const isKegModel = p.supply_model === 'pre_kegged';
    const stock = tankStockByProduct[p.id]?.totalLitres || 0;
    const litresPerKeg = p.litres_per_keg || 25;
    const kegsSoldToday = orders
      .filter(o => !o.voided && depotDateKey(o.date) === todayStr && o.product_id === p.id)
      .reduce((sum, o) => sum + Number(o.qty || 0), 0);
    const configuredCapacity = physicalTanks
      .filter(pt => pt.product_id === p.id)
      .reduce((sum, pt) => sum + (pt.capacity_litres || 0), 0);
    return {
      product: p,
      isKegModel,
      stock,
      litresPerKeg,
      kegsSoldToday,
      capacity: configuredCapacity > 0 ? configuredCapacity : (isKegModel ? 15000 : 30000),
      accentColor: accentColorFor(p.id)
    };
  });

  // Time-of-day greeting, Lagos-local
  const greeting = useMemo(() => {
    const hour = Number(
      new Date().toLocaleString('en-US', { timeZone: DEPOT_TZ, hour: 'numeric', hour12: false })
    );
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Last 7 days' revenue, oldest first, bucketed by Lagos depot-day
  const salesTrend = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(depotDateKey(d));
    }
    return days.map(dayKey => {
      const total = orders
        .filter(o => !o.voided && depotDateKey(o.date) === dayKey)
        .reduce((sum, o) => sum + Number(o.line_amount || 0), 0);
      const label = new Date(`${dayKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
      return { label, value: total };
    });
  }, [orders]);

  // Top 5 varieties by litres sold, last 30 days
  const topVarieties = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const totals = new Map<string, number>();
    orders
      .filter(o => !o.voided && new Date(o.date) >= cutoff)
      .forEach(o => {
        const name = o.variety_name || products.find(p => p.id === o.product_id)?.name || o.product_id;
        totals.set(name, (totals.get(name) || 0) + Number(o.litres || 0));
      });
    return Array.from(totals.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [orders, products]);

  // Tank fill-level health, bucketed the same way the tank/lot list rows below compute % (remaining/received)
  const tankHealthBuckets = useMemo(() => {
    let healthy = 0;
    let low = 0;
    let critical = 0;
    tanks.forEach(t => {
      const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
      if (pct < 15) critical++;
      else if (pct < 40) low++;
      else healthy++;
    });
    return [
      { label: 'Healthy', value: healthy, colorCls: 'text-emerald-500' },
      { label: 'Low', value: low, colorCls: 'text-amber-500' },
      { label: 'Critical', value: critical, colorCls: 'text-rose-500' }
    ];
  }, [tanks]);

  // Last 6 sales, newest first — same sale -> lines -> customer join TransactionLedgerScreen uses
  const recentSalesFeed = useMemo(() => {
    return [...sales]
      .filter(s => !s.voided)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
      .map(s => {
        const lines = orders.filter(o => o.sale_id === s.id);
        const total = lines.reduce((sum, l) => sum + l.line_amount, 0);
        const customer = customers.find(c => c.id === s.customer_id);
        return {
          id: s.id,
          date: s.date,
          customerName: customer?.name || 'Walk-in',
          itemCount: lines.length,
          amount: total,
          paymentMethod: s.payment_method
        };
      });
  }, [sales, orders, customers]);

  // Progressive Disclosure States (Side Drawer on Desktop ≥900px, Bottom Sheet on Mobile)
  const [activeStatSheet, setActiveStatSheet] = useState<
    'cash' | 'credit' | 'kegs_out' | 'depot_kegs' | 'customer_kegs' | 'expenses' | 'profit' | null
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

  // Progressive disclosure: which stock-overview row (tank or keg lot) is expanded to show its detail line
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Shift Management State
  const activeCashier = currentUser?.full_name || currentUser?.email || 'Counter Staff';
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState(() => formatWithCommas(settings.default_daily_float || 50000));
  const [startNotesInput, setStartNotesInput] = useState('');
  const [pumpOpeningInputs, setPumpOpeningInputs] = useState<Record<string, string>>({});

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [cashCountedInput, setCashCountedInput] = useState('');
  const [closeNotesInput, setCloseNotesInput] = useState('');
  const [pumpClosingInputs, setPumpClosingInputs] = useState<Record<string, string>>({});
  const [shiftFeedback, setShiftFeedback] = useState<string | null>(null);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Live Shift Metrics for active shift (same function used by shift close & today's stats)
  const shiftMetrics = useMemo(() => {
    if (!activeShift) return null;
    return computeShiftCash(activeShift, orders, expenses, new Date(), sales);
  }, [activeShift, orders, expenses, sales]);

  const liveCloseVariance = useMemo(() => {
    if (!shiftMetrics || !cashCountedInput.trim()) return null;
    const counted = parseFromCommas(cashCountedInput);
    if (isNaN(counted)) return null;
    return counted - shiftMetrics.expectedCash;
  }, [shiftMetrics, cashCountedInput]);



  const failShift = (msg: string) => {
    setShiftError(msg);
    showToast('error', msg);
  };

  const handleStartShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError(null);
    const floatNum = parseFromCommas(openingFloatInput);

    const readings: Record<string, number> = {};
    for (const p of pumps) {
      const valStr = pumpOpeningInputs[p.id];
      const v = parseFromCommas(valStr);
      if (!valStr || !Number.isFinite(v) || v <= 0) {
        failShift(`Enter a valid opening reading for ${p.label}.`);
        return;
      }
      if (v < p.last_meter_reading) {
        failShift(`Meter reading for ${p.label} cannot be less than previous (${p.last_meter_reading.toLocaleString()} L).`);
        return;
      }
      readings[p.id] = v;
    }

    const res = startShift({
      cashierName: activeCashier,
      openingFloat: floatNum,
      notes: startNotesInput.trim() || undefined,
      openingReadings: readings
    });
    if (res.success) {
      setIsStartShiftModalOpen(false);
      setStartNotesInput('');
      setPumpOpeningInputs({});
      setShiftFeedback('New shift opened successfully with verified pump readings.');
      showToast('success', 'New shift opened successfully with verified pump readings.');
      setTimeout(() => setShiftFeedback(null), 4000);
    } else {
      failShift(res.error || 'Could not start the shift.');
    }
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError(null);
    if (!activeShift) return;
    const counted = parseFromCommas(cashCountedInput);
    if (isNaN(counted) || counted < 0 || !cashCountedInput.trim()) return;

    const closingReadings: Record<string, number> = {};
    for (const p of pumps) {
      const valStr = pumpClosingInputs[p.id];
      if (valStr) {
        const val = parseFromCommas(valStr);
        const opening = activeShift.opening_readings?.[p.id] ?? p.last_meter_reading ?? 0;
        if (val < opening) {
          failShift(`Closing meter for ${p.label} cannot be less than opening reading (${opening.toLocaleString()} L).`);
          return;
        }
        closingReadings[p.id] = val;
      }
    }

    const res = closeShift({
      shiftId: activeShift.id,
      cashCounted: counted,
      closingReadings: Object.keys(closingReadings).length > 0 ? closingReadings : undefined,
      notes: closeNotesInput.trim() || undefined
    });

    if (res.success) {
      setIsCloseShiftModalOpen(false);
      setCashCountedInput('');
      setCloseNotesInput('');
      setPumpClosingInputs({});
      setShiftFeedback('Shift reconciled and closed successfully.');
      showToast('success', 'Shift reconciled and closed successfully.');
      setTimeout(() => setShiftFeedback(null), 4000);
    } else {
      failShift(res.error || 'Could not close the shift.');
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

    // 1. Overdue debt invoices (Critical Red)
    activeAlerts.overdueCredit.forEach(a => {
      list.push({
        id: `overdue-${a.customer.id}`,
        type: 'Overdue Debt Invoice',
        title: `${a.customer.name} (Overdue ${a.overdueDays}d)`,
        subtitle: `Balance: ${formatNaira(a.amount)} · Terms: ${a.customer.credit_term_days}d`,
        details: `Customer has exceeded their agreed ${a.customer.credit_term_days}-day terms by ${a.overdueDays} days. Debt sales should be paused until this invoice is settled.`,
        severity: 'red',
        actionLabel: 'Open Customer Ledger',
        action: () => onNavigate('customers')
      });
    });

    // 2. Debt limit breaches (Critical Red)
    activeAlerts.overLimit.forEach(a => {
      list.push({
        id: `limit-${a.customer.id}`,
        type: 'Debt Limit Breach',
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
      {/* WELCOME BANNER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
          {greeting}, {currentUser.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-xs sm:text-sm font-sans text-slate-500 dark:text-slate-400 mt-0.5">
          Here's what's happening at the depot today, {new Date().toLocaleDateString('en-US', { timeZone: DEPOT_TZ, weekday: 'long', month: 'long', day: 'numeric' })}.
        </p>
      </div>

      {/* EXECUTIVE AI INTELLIGENCE BANNER (OWNER ONLY) */}
      {can('viewAIAdvisor') && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950 text-white border border-slate-800 shadow-card-dark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-wide font-heading">
                  Executive AI Operations Advisor
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                  Claude 3.5 Sonnet
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-sans">
                Run on-demand audits across tank depletion runway, pump variances, and customer debt exposure.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('ai-advisor')}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 flex-shrink-0"
          >
            <span>Open Executive AI Hub</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SHIFT HANDOVER & CASH RECONCILIATION BANNER */}
      <div className="p-4 sm:p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark transition-all">
        {shiftFeedback && (
          <div className="mb-3 p-3 rounded-xl badge-emerald border border-emerald-300 dark:border-emerald-800 text-xs font-sans flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shiftFeedback}</span>
          </div>
        )}

        {shiftError && (
          <div className="mb-3 p-3 rounded-xl badge-rose border border-rose-300 dark:border-rose-800 text-xs font-sans flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{shiftError}</span>
            <button type="button" onClick={() => setShiftError(null)} className="ml-auto px-1.5 py-0.5 rounded bg-rose-100/70 dark:bg-rose-900/40 border border-rose-300/70 dark:border-rose-700/60 text-rose-600 hover:text-rose-800 dark:hover:text-rose-200">✕</button>
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
                <span className="font-heading font-bold text-base text-slate-900 dark:text-white">
                  {activeShift ? 'Shift open' : 'No shift open'}
                </span>
                {activeShift ? (
                  <span className="badge-emerald inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-sans font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Open Shift
                  </span>
                ) : (
                  <span className="badge-muted px-2.5 py-0.5 rounded-full text-xs font-sans font-medium">
                    Shift Closed
                  </span>
                )}
              </div>

              <p className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                {activeShift
                  ? `Cashier: ${activeShift.cashier_name || 'Counter Staff'} · Started ${formatDepotTime(activeShift.start_time)} · Cash is being tracked live`
                  : 'Start a shift to record the opening cash and check the drawer against sales at the end.'}
              </p>
            </div>
          </div>

          {/* Middle: Live Ledger Reconciliation (if active shift) */}
          {activeShift && shiftMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
              <div>
                <span className="text-xs font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Cash for Change
                </span>
                <span className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
                  {formatNaira(activeShift.opening_float)}
                </span>
              </div>
              <div>
                <span className="text-xs font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Cash Sales
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatNaira(shiftMetrics.cashSales)}
                </span>
              </div>
              <div>
                <span className="text-xs font-sans uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                  Cash Expenses
                </span>
                <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                  -{formatNaira(shiftMetrics.cashExpenses)}
                </span>
              </div>
              <div>
                <span className="text-xs font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Expected Cash
                </span>
                <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
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
                  const prefill: Record<string, string> = {};
                  for (const p of pumps) {
                    prefill[p.id] = p.last_meter_reading.toString();
                  }
                  setPumpClosingInputs(prefill);
                  setIsCloseShiftModalOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-sans font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 hover:border-rose-300 dark:border-rose-800 transition-all shadow-sm flex items-center gap-1.5"
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
                className="px-4 py-2 text-xs font-sans font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" weight="bold" />
                <span>Start New Shift</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stat Grid (7 Metric Cards - Responsive Grid with Clean Typography & Alignment) */}
      {/* KPI Stat Grid (3 Clean Financial Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Cash / Transfer Sales Today */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('cash')}
          className="w-full text-left p-4 sm:p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800/80 transition-all shadow-card-light dark:shadow-card-dark cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-3">
            <span className="text-xs font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Cash, Card &amp; Transfer
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div
            title={formatNaira(todayStats.cashTransferSales)}
            className="text-2xl sm:text-3xl font-heading font-black tabular-nums tracking-tight leading-none text-emerald-600 dark:text-emerald-400 truncate my-1.5"
          >
            {formatNaira(todayStats.cashTransferSales)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 font-sans">
            <span className="truncate font-medium">Collected today</span>
            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* 2. Debt Outstanding (Debt Ledger) */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('credit')}
          className="w-full text-left p-4 sm:p-5 rounded-2xl depot-card border border-rose-200/80 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700 transition-all shadow-card-light dark:shadow-card-dark cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-3">
            <span className="text-xs font-sans font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 truncate">
              Debt Ledger
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100/70 dark:bg-rose-900/40 border border-rose-200/80 dark:border-rose-800/50 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div
            title={formatNaira(todayStats.creditOutstanding)}
            className="text-2xl sm:text-3xl font-heading font-black tabular-nums tracking-tight leading-none text-rose-600 dark:text-rose-400 truncate my-1.5"
          >
            {formatNaira(todayStats.creditOutstanding)}
          </div>
          <div className="flex items-center justify-between text-xs text-rose-600/80 dark:text-rose-400/80 mt-2 pt-2 border-t border-rose-100 dark:border-rose-950/60 font-sans">
            <span className="truncate font-medium">Total open balance</span>
            <span className="inline-flex items-center gap-0.5 text-rose-700 dark:text-rose-300 font-bold shrink-0">
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* 3. Expenses Today */}
        <button
          type="button"
          onClick={() => setActiveStatSheet('expenses')}
          className="w-full text-left p-4 sm:p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 transition-all shadow-card-light dark:shadow-card-dark cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1.5 mb-3">
            <span className="text-xs font-sans font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 truncate">
              Expenses Today
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100/70 dark:bg-rose-900/40 border border-rose-200/80 dark:border-rose-800/50 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div
            title={formatNaira(todayStats.expensesToday)}
            className="text-2xl sm:text-3xl font-heading font-black tabular-nums tracking-tight leading-none text-rose-600 dark:text-rose-400 truncate my-1.5"
          >
            {formatNaira(todayStats.expensesToday)}
          </div>
          <div className="flex items-center justify-between text-xs text-rose-600/80 dark:text-rose-400/80 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 font-sans">
            <span className="truncate font-medium">Float: {formatNaira(todayStats.dailyFloatRemaining)}</span>
            <span className="inline-flex items-center gap-0.5 text-rose-700 dark:text-rose-300 font-bold shrink-0">
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        {/* 4. Net Profit Today (Gross Sales - Expenses) */}
        {(() => {
          const netProfitToday = todayStats.grossSalesToday - todayStats.expensesToday;
          const isPositive = netProfitToday >= 0;
          return (
            <button
              type="button"
              onClick={() => setActiveStatSheet('profit')}
              className={`w-full text-left p-4 sm:p-5 rounded-2xl depot-card border transition-all shadow-card-light dark:shadow-card-dark cursor-pointer active:scale-98 group min-w-0 flex flex-col justify-between ${
                isPositive
                  ? 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800/80'
                  : 'border-rose-200/80 dark:border-rose-900/60 hover:border-rose-300 dark:hover:border-rose-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-3">
                <span className={`text-xs font-sans font-bold uppercase tracking-wider truncate ${isPositive ? 'text-slate-500 dark:text-slate-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  Net Profit Today
                </span>
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                  isPositive
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/60 dark:border-emerald-800/50'
                    : 'bg-rose-100/70 dark:bg-rose-900/40 border-rose-200/80 dark:border-rose-800/50'
                }`}>
                  <ChartLineUp className={`w-4 h-4 group-hover:scale-110 transition-transform ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
                </div>
              </div>
              <div
                title={formatNaira(netProfitToday)}
                className={`text-2xl sm:text-3xl font-heading font-black tabular-nums tracking-tight leading-none truncate my-1.5 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
              >
                {formatNaira(netProfitToday)}
              </div>
              <div className={`flex items-center justify-between text-xs mt-2 pt-2 border-t font-sans ${isPositive ? 'text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800/60' : 'text-rose-600/80 dark:text-rose-400/80 border-rose-100 dark:border-rose-950/60'}`}>
                <span className="truncate font-medium">Gross − Expenses</span>
                <span className={`inline-flex items-center gap-0.5 font-bold shrink-0 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-300'}`}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })()}
      </div>

      {/* INSIGHTS ROW: recent sales, sales trend, tank availability, top varieties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Receipt className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="bold" />
            <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-white">Recent Sales</h3>
          </div>
          {recentSalesFeed.length === 0 ? (
            <p className="text-xs font-sans text-slate-400 py-6 text-center">No sales recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {recentSalesFeed.map(row => {
                const theme = getPaymentModeTheme(row.paymentMethod);
                return (
                  <div key={row.id} className="flex items-center gap-3 text-xs py-2.5 first:pt-0 last:pb-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-heading font-bold text-xs shrink-0 ${theme.badgeCls}`}>
                      {row.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-sans font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {row.customerName}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {formatDepotDate(row.date)} · {formatDepotTime(row.date)} · {row.itemCount} item{row.itemCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {formatNaira(row.amount)}
                      </div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${theme.badgeCls}`}>
                        {theme.badgeLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sales Trend (last 7 days) */}
        <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <ChartLineUp className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="bold" />
            <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-white">Sales Trend (7 Days)</h3>
          </div>
          <div className="flex-1 min-h-0 pt-3">
            <MiniBarChart data={salesTrend} colorCls="bg-brand-500" formatValue={v => formatNaira(v)} highlightLast />
          </div>
        </div>

        {/* Tank Availability */}
        <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <ChartPieSlice className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="bold" />
            <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-white">Tank Availability</h3>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center py-2">
            <DonutChart
              segments={tankHealthBuckets}
              centerValue={String(tanks.length)}
              centerLabel="Tanks"
            />
          </div>
        </div>

        {/* Top Varieties (last 30 days) */}
        <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <ChartBar className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="bold" />
            <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-white">Top Varieties (30 Days)</h3>
          </div>
          <div className="flex-1 min-h-0 pt-3">
            <MiniBarChart data={topVarieties} colorCls="bg-amber-500" formatValue={v => `${v.toLocaleString()}L`} />
          </div>
        </div>
      </div>

      {/* DEPOT PUMPS LIVE METER STATUS SECTION */}
      <div className="p-5 sm:p-6 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-500/20">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white">
                Dispense Pumps &amp; Meter Readings
              </h3>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
                Pump meter readings to verify oil dispensed against sales.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('pumps')}
            className="text-xs font-sans font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Record Pump Reading</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Mechanical Counter drums preview for the first pump */}
        {pumps[0] && (
          <PumpOdometerIllustration
            pumpName={pumps[0].label}
            openingReading={pumps[0].last_meter_reading - pumpLitresToday(pumps[0].product_id)}
            currentReading={pumps[0].last_meter_reading}
            recordedSalesLitres={pumpLitresToday(pumps[0].product_id)}
            tankName={physicalTanks.find(t => t.id === pumps[0].physical_tank_id)?.label || 'Main Storage Tank'}
            isCompact={true}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {pumps.map(pump => {
            const pumpAccentColor = accentColorFor(pump.product_id);
            const todayPumpLitres = pumpLitresToday(pump.product_id);

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
                  <span className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: pumpAccentColor }}
                    />
                    <span>{pump.label}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono tabular-nums font-bold ${
                    hasAlert
                      ? 'badge-rose'
                      : 'badge-emerald'
                  }`}>
                    {hasAlert ? `Variance Alert (${latestAudit.variance > 0 ? '+' : ''}${latestAudit.variance}L)` : 'Meter Normal'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">Current Meter:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {pump.last_meter_reading.toLocaleString()} L
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-sans">Dispensed Today:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {todayPumpLitres.toLocaleString()} L
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Split Alert Stream: SEVEN DISTINCT ALERT TYPES (Desktop 3-col, Tablet 2-col, Mobile 1-col) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Things That Need Attention</span>
          </h3>
          <span className="text-xs font-sans text-slate-500 dark:text-slate-400">
            {activeAlerts.totalAlertCount === 0
              ? 'All systems operating normally'
              : `${activeAlerts.totalAlertCount} item${activeAlerts.totalAlertCount === 1 ? '' : 's'} to check`}
          </span>
        </div>

        {/* MOBILE CONDENSED ALERTS VIEW (<= 3 items + View All N button) */}
        <div className="sm:hidden space-y-2.5">
          {allAlertsList.length === 0 ? (
            <div className="p-4 rounded-xl depot-card border border-slate-200 dark:border-slate-800 text-center text-xs font-sans text-slate-500 dark:text-slate-400">
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
                      <div className="text-xs font-sans font-bold text-slate-900 dark:text-white truncate">
                        {alert.title}
                      </div>
                      <div className="text-xs font-sans text-slate-500 dark:text-slate-400 truncate">
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
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 active:scale-98"
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
          <div className="p-4 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs font-sans uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>1. Overdue Invoices</span>
                </div>
                <span className="badge-rose px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold">
                  {activeAlerts.overdueCredit.length}
                </span>
              </div>

              {activeAlerts.overdueCredit.length === 0 ? (
                <p className="text-xs font-sans text-slate-400 py-3 text-center">
                  No overdue debt accounts.
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
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.customer.name}</div>
                        <div className="text-xs text-rose-600 dark:text-rose-400 font-mono tabular-nums font-semibold">
                          Overdue by {alert.overdueDays} days
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                          {formatNaira(alert.amount)}
                        </div>
                        <span className="text-xs font-sans text-slate-500 dark:text-slate-400 flex items-center justify-end gap-0.5">
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
          <div className="p-4 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs font-sans uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>2. Debt Cap Breaches</span>
                </div>
                <span className="badge-rose px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold">
                  {activeAlerts.overLimit.length}
                </span>
              </div>

              {activeAlerts.overLimit.length === 0 ? (
                <p className="text-xs font-sans text-slate-400 py-3 text-center">
                  All accounts within approved debt caps.
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
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.customer.name}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                          Limit: {formatNaira(alert.limit)}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="font-bold text-rose-800 dark:text-rose-300">
                          {formatNaira(alert.balance)}
                        </div>
                        <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                          +{formatNaira(alert.excess)} over
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 3: Delivery Shortfall Flags */}
          <div className="p-4 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs font-sans uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>3. Truck Shortfall (&gt; {settings.truck_shortfall_threshold}L)</span>
                </div>
                <span className="badge-rose px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold">
                  {activeAlerts.deliveryShortfall.length}
                </span>
              </div>

              {activeAlerts.deliveryShortfall.length === 0 ? (
                <p className="text-xs font-sans text-slate-400 py-3 text-center">
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
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.tank.truck_label}</div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
                          {formatDepotDate(alert.tank.date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                          -{alert.shortfallLitres} L
                        </div>
                        <span className="text-xs font-sans text-slate-500 flex items-center justify-end gap-0.5">
                          Audit <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 4: Pump Meter Variance Audits */}
          <div className="p-4 rounded-2xl depot-card border border-rose-200 dark:border-rose-900/80 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900/60 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs font-sans uppercase tracking-wider">
                  <Gauge className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>4. Pump Meter Variance</span>
                </div>
                <span className="badge-rose px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold">
                  {activeAlerts.pumpVariance.length}
                </span>
              </div>

              {activeAlerts.pumpVariance.length === 0 ? (
                <p className="text-xs font-sans text-slate-400 py-3 text-center">
                  All pump meter deltas align with logged orders.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.pumpVariance.map((audit, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate('pumps')}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('pumps'); } }}
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{audit.pumpLabel}</div>
                        <div className="text-xs text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                          Meter: +{audit.meterDelta}L | Logged: {audit.expectedLitres}L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                          {audit.variance > 0 ? `+${audit.variance}` : audit.variance} L
                        </div>
                        <span className="text-xs font-sans text-slate-500 flex items-center justify-end gap-0.5">
                          Audit <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 5: Shift Drawer Cash Discrepancies */}
          <div className="p-4 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs font-sans uppercase tracking-wider">
                  <Banknote className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>5. Shift Drawer Discrepancy</span>
                </div>
                <span className="badge-rose px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold">
                  {activeAlerts.shiftDiscrepancy.length}
                </span>
              </div>

              {activeAlerts.shiftDiscrepancy.length === 0 ? (
                <p className="text-xs font-sans text-slate-400 py-3 text-center">
                  All past shifts balanced cleanly to zero variance.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.shiftDiscrepancy.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">
                          {s.cashier_name || 'Counter Cashier'}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                          Counted: {formatNaira(s.cash_counted || 0)} | Expected: {formatNaira(s.expected_cash || 0)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                          {s.cash_variance! > 0 ? `+${formatNaira(s.cash_variance!)}` : formatNaira(s.cash_variance!)}
                        </div>
                        <span className="text-xs font-sans text-slate-500 block">
                          {formatDepotDate(s.start_time)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 6: Tank Running Low on Stock */}
          <div className="p-4 rounded-2xl depot-card border border-amber-200 dark:border-amber-900/80 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/60 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs font-sans uppercase tracking-wider">
                  <Droplet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>6. Tank Running Low (&lt; {settings.low_stock_litres_threshold}L)</span>
                </div>
                <span className="badge-amber px-2 py-0.5 rounded-full text-xs font-mono tabular-nums font-bold">
                  {activeAlerts.lowTankStock.length}
                </span>
              </div>

              {activeAlerts.lowTankStock.length === 0 ? (
                <p className="text-xs font-sans text-slate-400 py-3 text-center">
                  All products above the low-stock threshold.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.lowTankStock.map(alert => (
                    <div
                      key={alert.product.id}
                      onClick={() => onNavigate('intake')}
                      className="cursor-pointer p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-200 font-sans">{alert.product.name}</div>
                        <div className="text-xs text-amber-800 dark:text-amber-300 font-mono tabular-nums">
                          Reorder threshold: {alert.threshold.toLocaleString()} L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300">
                          {alert.litres.toLocaleString()} L left
                        </div>
                        <span className="text-xs font-sans text-slate-500 flex items-center justify-end gap-0.5">
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

      {/* Volumetric Tanks Level Overview Grid — Positioned at Bottom of Page */}
      <div className="grid grid-cols-1 split:grid-cols-2 gap-6">
        {productStockSummaries.map(summary => {
          const p = summary.product;
          const kegDisplay = Math.round(summary.stock / summary.litresPerKeg);
          const productTanks = tanks.filter(t => t.product_id === p.id);
          return (
            <div
              key={p.id}
              className="p-5 sm:p-6 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col justify-between"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow-sm"
                    style={{ backgroundColor: summary.accentColor, boxShadow: `0 0 0 4px ${summary.accentColor}22` }}
                  />
                  <div>
                    <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{p.name} {summary.isKegModel ? 'Stock' : 'Tanks'}</span>
                      {summary.isKegModel && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border"
                          style={{ backgroundColor: `${summary.accentColor}1A`, color: summary.accentColor, borderColor: `${summary.accentColor}40` }}
                        >
                          {summary.litresPerKeg}L Kegs Only
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
                      {summary.isKegModel
                        ? `Pre-Kegged ${summary.litresPerKeg}L Containers · Available in Warehouse`
                        : 'First-In, First-Out: Oldest oil delivered is dispensed first.'}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums space-y-0.5">
                  {summary.isKegModel ? (
                    <>
                      <div className="text-xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
                        {kegDisplay.toLocaleString()} Kegs
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {summary.stock.toLocaleString()} L ({summary.litresPerKeg}L per keg)
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        Sold Today: {summary.kegsSoldToday} kegs
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
                        {summary.stock.toLocaleString()} L
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ≈ {kegDisplay.toLocaleString()} Kegs ({summary.litresPerKeg}L)
                      </div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        Quantity Sold Today: {summary.kegsSoldToday}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start justify-items-center py-2">
                {summary.isKegModel ? (
                  <KegVisual25L
                    remainingLitres={summary.stock}
                    totalCapacityLitres={summary.capacity}
                    kegSizeLitres={summary.litresPerKeg}
                    size="md"
                  />
                ) : (
                  <TankGauge
                    productId={p.id}
                    productName={`${p.name} Depletion`}
                    remainingLitres={summary.stock}
                    totalCapacityLitres={summary.capacity}
                    size="lg"
                  />
                )}

                {/* Individual active tanks/lots list for this product */}
                <div className="w-full space-y-3">
                  <div className="text-xs font-sans font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    {summary.isKegModel && (
                      <Package className="w-3.5 h-3.5" style={{ color: summary.accentColor }} weight="bold" />
                    )}
                    <span>{summary.isKegModel ? `Active ${summary.litresPerKeg}L Keg Lots & Deliveries` : 'Active In-Feed Tanks'}</span>
                  </div>
                  {productTanks.map((t, idx) => {
                    const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
                    const kegCount = Math.round(t.remaining_litres / summary.litresPerKeg);
                    const totalKegs = Math.round(t.received_litres / summary.litresPerKeg);
                    const isExpanded = expandedRowId === t.id;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setExpandedRowId(isExpanded ? null : t.id)}
                        className="w-full text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 min-w-0 font-sans font-bold text-slate-800 dark:text-slate-200">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
                              style={
                                summary.isKegModel
                                  ? { backgroundColor: `${summary.accentColor}33`, color: summary.accentColor }
                                  : undefined
                              }
                            >
                              {summary.isKegModel ? `Lot #${idx + 1}` : `Tank #${idx + 1}`}
                            </span>
                            <span className="truncate" title={t.truck_label}>{t.truck_label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {summary.isKegModel ? `${kegCount.toLocaleString()} Kegs` : `${t.remaining_litres.toLocaleString()} L`}
                            </span>
                            <span className="text-xs text-slate-400">
                              {pct.toFixed(0)}%
                            </span>
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums animate-in fade-in duration-150">
                            {summary.isKegModel
                              ? `Delivery: ${formatDepotDate(t.date)} · Initial: ${totalKegs.toLocaleString()} Kegs (${t.received_litres.toLocaleString()}L) · Remaining: ${t.remaining_litres.toLocaleString()}L`
                              : `Intake: ${formatDepotDate(t.date)} · Received: ${t.received_litres.toLocaleString()}L`}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Start New Shift */}
      {isStartShiftModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsStartShiftModalOpen(false)}
          title={
            <span className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span>Start Counter Cash Shift</span>
            </span>
          }
          subtitle="Open daily ledger cash reconciliation"
        >
            <form onSubmit={handleStartShiftSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="shift-cashier-name" className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300">
                    Cashier Name / On-Duty Staff *
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    Account Login
                  </span>
                </div>
                <input
                  id="shift-cashier-name"
                  type="text"
                  readOnly
                  disabled
                  value={activeCashier}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans text-sm cursor-not-allowed select-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Verified account login (non-editable for accountability).</p>
              </div>

              <div>
                <label htmlFor="shift-opening-float" className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cash for Customer Change (NGN) *
                </label>
                <div className="relative">
                  <input
                    id="shift-opening-float"
                    type="text"
                    inputMode="numeric"
                    required
                    value={openingFloatInput}
                    onChange={e => setOpeningFloatInput(formatWithCommas(e.target.value))}
                    placeholder="e.g. 50,000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400">
                    NGN
                  </span>
                </div>
                <p className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-1">
                  Physical cash placed in drawer to make customer change.
                </p>
              </div>

              <div>
                <label htmlFor="shift-start-notes" className="block text-xs font-sans font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Shift Notes / Handover Details (Optional)
                </label>
                <input
                  id="shift-start-notes"
                  type="text"
                  value={startNotesInput}
                  onChange={e => setStartNotesInput(e.target.value)}
                  placeholder="e.g. Morning shift, clean till, 50k denominations verified"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Mandatory Opening Pump Meter Readings */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Opening Pump Meter Readings ({pumps.length}) *
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Check physical counter
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {pumps.map(p => {
                    return (
                      <div key={p.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{p.label}</span>
                          <span className="text-slate-400 font-mono text-[11px]">Inspect physical meter</span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={pumpOpeningInputs[p.id] ?? ''}
                          onChange={e => setPumpOpeningInputs(prev => ({ ...prev, [p.id]: formatWithCommas(e.target.value) }))}
                          placeholder="Enter meter reading..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {shiftError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                  {shiftError}
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsStartShiftModalOpen(false)}
                  className="px-4 py-2 text-xs font-sans font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-sans font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Open Shift
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* Modal: Reconcile and Close Shift */}
      {isCloseShiftModalOpen && activeShift && shiftMetrics && (
        <Modal
          isOpen
          onClose={() => setIsCloseShiftModalOpen(false)}
          size="lg"
          title={
            <span className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                <Banknote className="w-5 h-5" />
              </span>
              <span>Count cash & end shift</span>
            </span>
          }
          subtitle={`Cashier: ${activeShift.cashier_name || 'Counter Staff'} · Started at ${formatDepotTime(activeShift.start_time)}`}
        >
            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              {/* Dispensing Pumps Closing Readings */}
              {pumps.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Closing Meter Readings (3 Pumps)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {pumps.map(p => {
                      return (
                        <div key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-white">
                            <span className="truncate">{p.label}</span>
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={pumpClosingInputs[p.id] ?? ''}
                            onChange={e => setPumpClosingInputs(prev => ({ ...prev, [p.id]: formatWithCommas(e.target.value) }))}
                            placeholder="Enter closing meter..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shift Cash Reconciliation Breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Cash for Customer Change:</span>
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
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-sm">
                  <span className="font-sans text-slate-900 dark:text-white">(=) Expected Cash in Drawer:</span>
                  <span className="text-brand-600 dark:text-brand-400">
                    {formatNaira(shiftMetrics.expectedCash)}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="shift-cash-counted" className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Cash Counted in Drawer (NGN) *
                </label>
                <div className="relative">
                  <input
                    id="shift-cash-counted"
                    type="text"
                    inputMode="numeric"
                    required
                    value={cashCountedInput}
                    onChange={e => setCashCountedInput(formatWithCommas(e.target.value))}
                    placeholder="e.g. 524,000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-base font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-400">
                    NGN
                  </span>
                </div>
                <p className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-1">
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
                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Drawer Variance (Counted - Expected):
                    </span>
                    <span
                      className={`font-mono tabular-nums font-bold text-sm ${
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
                  <div className="mt-1 text-xs font-sans flex items-center gap-1.5">
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
                <label htmlFor="shift-close-notes" className="block text-xs font-sans font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Handover Notes / Supervisor Sign-off (Optional)
                </label>
                <input
                  id="shift-close-notes"
                  type="text"
                  value={closeNotesInput}
                  onChange={e => setCloseNotesInput(e.target.value)}
                  placeholder="e.g. Handed over to evening cashier Sunday, small change verified"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="px-4 py-2 text-xs font-sans font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-sans font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Close Shift
                </button>
              </div>
            </form>
        </Modal>
      )}
      {/* STAT BREAKDOWN PROGRESSIVE DISCLOSURE (Side Drawer on Desktop ≥900px, Bottom Sheet on Mobile) */}
      <DisclosureContainer
        isOpen={!!activeStatSheet}
        onClose={() => setActiveStatSheet(null)}
        title={
          activeStatSheet === 'cash'
            ? 'Cash, Card & Transfer Sales Today'
            : activeStatSheet === 'credit'
            ? 'Debt Ledger Outstanding'
            : activeStatSheet === 'kegs_out'
            ? 'Company Keg Custody'
            : activeStatSheet === 'depot_kegs'
            ? 'Kegs Available In Store'
            : activeStatSheet === 'customer_kegs'
            ? 'Customer Kegs Filled'
            : activeStatSheet === 'expenses'
            ? "Today's Expenses"
            : activeStatSheet === 'profit'
            ? 'Net Profit Today'
            : ''
        }
        subtitle={
          activeStatSheet === 'cash'
            ? `${formatNaira(todayStats.cashTransferSales)} collected today`
            : activeStatSheet === 'credit'
            ? `${formatNaira(todayStats.creditOutstanding)} total open balance`
            : activeStatSheet === 'kegs_out'
            ? `${todayStats.companyKegsOut} kegs with customers`
            : activeStatSheet === 'depot_kegs'
            ? `${todayStats.kegsAtDepot} kegs ready in store`
            : activeStatSheet === 'customer_kegs'
            ? `${todayStats.customerKegsFilledToday} containers filled today`
            : activeStatSheet === 'expenses'
            ? `${formatNaira(todayStats.expensesToday)} total spent today`
            : activeStatSheet === 'profit'
            ? `${formatNaira(todayStats.grossSalesToday - todayStats.expensesToday)} gross minus expenses`
            : ''
        }
      >
        <div className="space-y-4">
          {/* 1. Cash, Card & Transfer Breakdown */}
          {activeStatSheet === 'cash' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                <span className="text-xs font-sans font-semibold text-emerald-800 dark:text-emerald-300">
                  Total Collected Today
                </span>
                <span className="text-lg font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                  {formatNaira(todayStats.cashTransferSales)}
                </span>
              </div>

              <div className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Today's Paid Transactions
              </div>

              {orders
                .filter(o => {
                  return (
                    !o.voided &&
                    depotDateKey(o.date) === todayStr &&
                    (o.payment_method === 'cash' || o.payment_method === 'transfer' || o.payment_method === 'pos' || o.payment_method === 'split')
                  );
                })
                .map(order => {
                  const cust = customers.find(c => c.id === order.customer_id);
                  const theme = getPaymentModeTheme(order.payment_method);
                  return (
                    <div
                      key={order.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-sans font-bold text-slate-900 dark:text-white">
                          {cust?.name || 'Counter Sale'}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-sans text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <span className={`w-2 h-2 rounded-full ${theme.dotCls}`} />
                            {theme.label}
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

          {/* 2. Debt Breakdown */}
          {activeStatSheet === 'credit' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                <span className="text-xs font-sans font-semibold text-rose-800 dark:text-rose-300">
                  Total Outstanding Debt
                </span>
                <span className="text-lg font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                  {formatNaira(todayStats.creditOutstanding)}
                </span>
              </div>

              <div className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-sans font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{cust.name}</span>
                          {isOver && (
                            <span className="text-xs px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-sans font-bold">
                              Over Limit
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-sans text-slate-500 dark:text-slate-400">
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
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
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
                <span className="text-xs font-sans font-semibold text-slate-700 dark:text-slate-300">
                  Total in Customer Hands
                </span>
                <span className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                  {todayStats.companyKegsOut} kegs
                </span>
              </div>

              <div className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
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
                className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
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
                  <span className="text-xs font-sans font-medium text-slate-600 dark:text-slate-300">
                    Physical Kegs in Yard:
                  </span>
                  <span className="text-xl font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {todayStats.kegsAtDepot} kegs
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-sans text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span>Minimum Threshold:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {settings.kegs_at_depot_low_threshold} kegs
                  </span>
                </div>
                {kegInventory.isDepotStockCritical && (
                  <div className="text-xs font-sans font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Store keg inventory is low! Collect empty kegs from customers.</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-sans">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Total Company Kegs:</span>
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
                  <span>Available In Store:</span>
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
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
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
                <span className="text-xs font-sans font-semibold text-slate-700 dark:text-slate-300">
                  Total Customer Containers Filled
                </span>
                <span className="text-lg font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                  {todayStats.customerKegsFilledToday} kegs
                </span>
              </div>

              <div className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Today's Customer-Keg Dispenses
              </div>

              {orders
                .filter(o => {
                  return !o.voided && depotDateKey(o.date) === todayStr && o.container_mode === 'none';
                })
                .map(order => {
                  const cust = customers.find(c => c.id === order.customer_id);
                  const orderProductName = products.find(p => p.id === order.product_id)?.name || 'Product';
                  return (
                    <div
                      key={order.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-sans font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: accentColorFor(order.product_id) }}
                          />
                          <span>{cust?.name || 'Walk-in'}</span>
                        </div>
                        <div className="text-xs font-sans text-slate-500 dark:text-slate-400">
                          {orderProductName} · {order.litres}L · {formatDepotTime(order.date)}
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
                <span className="text-xs font-sans font-semibold text-rose-800 dark:text-rose-300">
                  Total Spent Today
                </span>
                <span className="text-lg font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                  {formatNaira(todayStats.expensesToday)}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-sans">
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

              <div className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Today's Expense Items
              </div>

              {expenses
                .filter(e => {
                  return !e.voided && depotDateKey(e.date) === todayStr;
                })
                .map(exp => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-sans font-bold text-slate-900 dark:text-white">
                        {exp.note || exp.category}
                      </div>
                      <div className="text-xs font-sans text-slate-500 dark:text-slate-400">
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
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-sans font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Manage Expenses & Float</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 7. Net Profit Breakdown */}
          {activeStatSheet === 'profit' && (() => {
            const netProfitToday = todayStats.grossSalesToday - todayStats.expensesToday;
            const isPositive = netProfitToday >= 0;
            return (
              <div className="space-y-4">
                <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isPositive
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                }`}>
                  <span className={`text-xs font-sans font-semibold ${isPositive ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                    Net Profit Today
                  </span>
                  <span className={`text-lg font-mono tabular-nums font-bold ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {formatNaira(netProfitToday)}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-xs font-sans">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Gross Sales Today (all payment methods, incl. credit):</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNaira(todayStats.grossSalesToday)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Expenses Today:</span>
                    <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                      -{formatNaira(todayStats.expensesToday)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-700 pt-1.5">
                    <span>Net Profit Today:</span>
                    <span className={`font-mono tabular-nums ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {formatNaira(netProfitToday)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] font-sans text-slate-400">
                  Gross Sales Today counts every sale billed today at its full value, including credit sales not yet
                  collected — that's why it can differ from the Cash &amp; Transfer figure, which only counts money
                  actually collected today.
                </p>
              </div>
            );
          })()}
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
                <div className="text-sm font-sans font-bold">{selectedAlert.title}</div>
                <div className="text-xs font-mono tabular-nums font-medium opacity-90">
                  {selectedAlert.subtitle}
                </div>
              </div>
            </div>

            {selectedAlert.details && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs font-sans text-slate-700 dark:text-slate-300 leading-relaxed">
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
              className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-sm font-sans font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
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
                  <div className="text-xs font-sans font-bold text-slate-900 dark:text-white truncate">
                    {alert.title}
                  </div>
                  <div className="text-xs font-sans text-slate-500 dark:text-slate-400 truncate">
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
