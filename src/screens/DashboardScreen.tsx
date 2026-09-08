import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import { formatNaira, formatDepotDate, formatDepotTime } from '../services/businessLogic';
import {
  DollarSign,
  CreditCard,
  Package,
  Boxes,
  Truck,
  PlusCircle,
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
  UserCheck
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
    shifts,
    activeShift,
    startShift,
    closeShift
  } = useStore();

  const vegStock = tankStockByProduct['veg']?.totalLitres || 0;
  const redStock = tankStockByProduct['red']?.totalLitres || 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  // Shift Management State
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [cashierInput, setCashierInput] = useState('Counter Staff');
  const [openingFloatInput, setOpeningFloatInput] = useState(settings.default_daily_float?.toString() || '50000');
  const [startNotesInput, setStartNotesInput] = useState('');

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [cashCountedInput, setCashCountedInput] = useState('');
  const [closeNotesInput, setCloseNotesInput] = useState('');
  const [shiftFeedback, setShiftFeedback] = useState<string | null>(null);

  // Live Shift Metrics for active shift
  const shiftMetrics = useMemo(() => {
    if (!activeShift) return null;
    const shiftStart = new Date(activeShift.start_time).getTime();
    const now = Date.now();

    const cashSales = orders
      .filter(o => {
        const t = new Date(o.date).getTime();
        return t >= shiftStart && t <= now && o.payment_method === 'cash';
      })
      .reduce((sum, o) => sum + (o.paid_amount || 0), 0);

    const cashExpenses = expenses
      .filter(e => {
        const t = new Date(e.date).getTime();
        return t >= shiftStart && t <= now;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const expectedCash = activeShift.opening_float + cashSales - cashExpenses;

    return {
      cashSales,
      cashExpenses,
      expectedCash
    };
  }, [activeShift, orders, expenses]);

  const liveCloseVariance = useMemo(() => {
    if (!shiftMetrics || !cashCountedInput) return null;
    const counted = parseFloat(cashCountedInput);
    if (isNaN(counted)) return null;
    return counted - shiftMetrics.expectedCash;
  }, [shiftMetrics, cashCountedInput]);

  const handleStartShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handleCloseShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Welcome / Action Banner (Desktop & Mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-white via-slate-50 to-brand-50/50 dark:from-slate-900 dark:via-slate-900/90 dark:to-brand-950/40 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Depot Operational Command</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/30">
              Live Real-Time
            </span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Volumetric tank inventory, credit aging ledger, pump meter audit, and container tracking for Lagos operations.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={() => onNavigate('intake')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[14px] font-sans font-semibold transition-all active:scale-95 shadow-sm"
          >
            <Truck className="w-[18px] h-[18px] text-slate-600 dark:text-slate-300" />
            <span>Log Truck Intake</span>
          </button>
          <button
            onClick={() => onNavigate('order')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[14px] font-sans font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-95"
          >
            <PlusCircle className="w-[18px] h-[18px] text-slate-950" />
            <span>Quick Dispense</span>
          </button>
        </div>
      </div>

      {/* SHIFT HANDOVER & CASH RECONCILIATION BANNER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        {shiftFeedback && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[12px] font-sans text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{shiftFeedback}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                  {activeShift ? 'Counter Cashier Shift Active' : 'No Active Counter Shift'}
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
                  ? `Cashier: ${activeShift.cashier_name || 'Counter Staff'} · Started at ${formatDepotTime(activeShift.start_time)} · Live cash drawer tracking`
                  : 'Start a daily shift to log opening float and reconcile physical cash drawer balance against counter sales.'}
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
                <span className="text-[10px] font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Cash Expenses
                </span>
                <span className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
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
          <div className="flex items-center gap-2 self-start lg:self-auto">
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
                <span>Reconcile & Close Shift</span>
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

      {/* KPI Stat Grid (6 Metric Cards - Mobile 2-col, Tablet 3-col, Desktop 6-col) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Cash / Transfer Sales Today */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider">Cash & Transfer</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-[32px] font-mono font-bold leading-tight text-emerald-600 dark:text-emerald-400">
            {formatNaira(todayStats.cashTransferSales)}
          </div>
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-1">Collected today</div>
        </div>

        {/* 2. Credit Outstanding */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider">Credit Ledger</span>
            <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="text-[32px] font-mono font-bold leading-tight text-slate-900 dark:text-slate-100">
            {formatNaira(todayStats.creditOutstanding)}
          </div>
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-1">Total open balance</div>
        </div>

        {/* 3. Company Kegs Out */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider">Company Kegs Out</span>
            <Package className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="text-[32px] font-mono font-bold leading-tight text-slate-900 dark:text-slate-100">
            {todayStats.companyKegsOut}{' '}
            <span className="text-[14px] font-sans font-normal text-slate-500 dark:text-slate-400">kegs</span>
          </div>
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-1">In customer custody</div>
        </div>

        {/* 4. Kegs at Depot (Red ONLY if < settings.kegs_at_depot_low_threshold) */}
        <div
          className={`p-4 rounded-2xl border transition-all shadow-sm ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-600/60 shadow-rose-500/10 animate-pulse'
              : 'bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[12px] font-sans font-medium uppercase tracking-wider ${
                kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Kegs at Depot
            </span>
            <Boxes
              className={`w-4 h-4 ${
                kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            />
          </div>
          <div
            className={`text-[32px] font-mono font-bold leading-tight ${
              kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {todayStats.kegsAtDepot}{' '}
            <span className="text-[14px] font-sans font-normal text-slate-500 dark:text-slate-400">kegs</span>
          </div>
          <div
            className={`text-[12px] font-sans mt-1 ${
              kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {kegInventory.isDepotStockCritical ? `CRITICAL: Stock < ${settings.kegs_at_depot_low_threshold}` : 'Physical yard inventory'}
          </div>
        </div>

        {/* 5. Customer-Owned Kegs Filled Today */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider">Customer Kegs</span>
            <Droplet className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="text-[32px] font-mono font-bold leading-tight text-slate-900 dark:text-slate-100">
            {todayStats.customerKegsFilledToday}{' '}
            <span className="text-[14px] font-sans font-normal text-slate-500 dark:text-slate-400">filled</span>
          </div>
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-1">Own containers today</div>
        </div>

        {/* 6. Spent Today / Float Status (Neutral unless overdraft) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider">Expenses Today</span>
            <Package className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className={`text-[32px] font-mono font-bold leading-tight ${todayStats.dailyFloatRemaining < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {formatNaira(todayStats.expensesToday)}
          </div>
          <div className="text-[12px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            Float: {formatNaira(todayStats.dailyFloatRemaining)}
          </div>
        </div>
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
                const orderDateStr = o.date ? o.date.slice(0, 10) : '';
                return orderDateStr === todayStr && o.pump_id === pump.id;
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
                    <span className="font-sans">Cumulative Meter:</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  Standard Density: ~1,090 L/Ton · FIFO Draw Sequence
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[14px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {vegStock.toLocaleString()} L
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 block">
                ≈ {(vegStock / settings.litres_per_keg).toFixed(0)} Kegs
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
                  Standard Density: ~1,085 L/Ton · FIFO Draw Sequence
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[14px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {redStock.toLocaleString()} L
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 block">
                ≈ {(redStock / settings.litres_per_keg).toFixed(0)} Kegs
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

      {/* Split Alert Stream: FOUR DISTINCT ALERT TYPES (Desktop 4-col, Tablet 2-col, Mobile 1-col) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Active Risk Signals & Operational Alerts</span>
          </h3>
          <span className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
            {activeAlerts.totalAlertCount === 0
              ? 'All systems within normal thresholds'
              : `${activeAlerts.totalAlertCount} alerts requiring counter attention`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                      onClick={() => onNavigate('customers')}
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
                      onClick={() => onNavigate('customers')}
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
                      onClick={() => onNavigate('intake')}
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
                      onClick={() => onNavigate('order')}
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
                      onClick={() => onNavigate('intake')}
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
                    Shift Reconciliation & Closeout
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
    </div>
  );
};
