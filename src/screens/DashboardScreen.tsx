import React from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import { formatNaira, formatDepotDate } from '../services/businessLogic';
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
  TrendingDown,
  Droplet
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
    tanks
  } = useStore();

  const vegStock = tankStockByProduct['veg']?.totalLitres || 0;
  const redStock = tankStockByProduct['red']?.totalLitres || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome / Action Banner (Desktop & Mobile) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-brand-950/40 border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Depot Operational Command</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Live Real-Time
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Volumetric tank inventory, credit aging ledger, and container tracking for Lagos operations.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={() => onNavigate('intake')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all active:scale-95"
          >
            <Truck className="w-4 h-4 text-amber-400" />
            <span>Log Truck Intake</span>
          </button>
          <button
            onClick={() => onNavigate('order')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black shadow-lg shadow-brand-500/20 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>Quick Dispense</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Grid (6 Metric Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Cash / Transfer Sales Today */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cash & Transfer</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg lg:text-xl font-mono font-black text-emerald-400">
            {formatNaira(todayStats.cashTransferSales)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Collected today</div>
        </div>

        {/* 2. Credit Outstanding */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Credit Ledger</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg lg:text-xl font-mono font-black text-amber-400">
            {formatNaira(todayStats.creditOutstanding)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Total open customer balance</div>
        </div>

        {/* 3. Company Kegs Out */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Company Kegs Out</span>
            <Package className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg lg:text-xl font-mono font-black text-sky-400">
            {todayStats.companyKegsOut}{' '}
            <span className="text-xs font-normal text-slate-400">kegs</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">In customer custody</div>
        </div>

        {/* 4. Kegs at Depot (Red if < 20) */}
        <div
          className={`p-4 rounded-2xl border transition-all shadow-sm ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-950/30 border-rose-600/60 shadow-rose-900/20 animate-pulse'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                kegInventory.isDepotStockCritical ? 'text-rose-300' : 'text-slate-400'
              }`}
            >
              Kegs at Depot
            </span>
            <Boxes
              className={`w-4 h-4 ${
                kegInventory.isDepotStockCritical ? 'text-rose-400' : 'text-brand-400'
              }`}
            />
          </div>
          <div
            className={`text-lg lg:text-xl font-mono font-black ${
              kegInventory.isDepotStockCritical ? 'text-rose-400' : 'text-white'
            }`}
          >
            {todayStats.kegsAtDepot}{' '}
            <span className="text-xs font-normal text-slate-400">kegs</span>
          </div>
          <div
            className={`text-[10px] mt-1 ${
              kegInventory.isDepotStockCritical ? 'text-rose-300 font-bold' : 'text-slate-400'
            }`}
          >
            {kegInventory.isDepotStockCritical ? 'CRITICAL: Stock < 20' : 'Physical yard inventory'}
          </div>
        </div>

        {/* 5. Customer-Owned Kegs Filled Today */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Customer Kegs</span>
            <Droplet className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg lg:text-xl font-mono font-black text-purple-300">
            {todayStats.customerKegsFilledToday}{' '}
            <span className="text-xs font-normal text-slate-400">filled</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Own jerrycans today</div>
        </div>

        {/* 6. Expenses Today */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Expenses Today</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-lg lg:text-xl font-mono font-black text-rose-400">
            {formatNaira(todayStats.expensesToday)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Float left: {formatNaira(todayStats.dailyFloatRemaining)}
          </div>
        </div>
      </div>

      {/* Main Section: Product Tank Gauges (2-column on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vegetable Oil Active Tanks Overview */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Golden Vegetable Oil Tanks
                </h3>
                <p className="text-[11px] text-slate-400">
                  Standard Density: ~1,090 L/Ton · FIFO Draw Sequence
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-extrabold text-amber-400">
                {vegStock.toLocaleString()} L
              </span>
              <span className="text-[10px] text-slate-400 block">
                ≈ {(vegStock / 30).toFixed(0)} Kegs
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center justify-items-center py-2">
            {/* Primary combined gauge */}
            <TankGauge
              productId="veg"
              productName="Veg Oil Combined Depletion"
              remainingLitres={vegStock}
              totalCapacityLitres={30000}
              size="lg"
            />

            {/* Individual active veg tanks list */}
            <div className="w-full space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active In-Feed Tanks
              </div>
              {tanks
                .filter(t => t.product_id === 'veg')
                .map((t, idx) => {
                  const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-400 font-mono">
                            Tank #{idx + 1}
                          </span>
                          <span>{t.truck_label}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Intake: {formatDepotDate(t.date)} · Received: {t.received_litres.toLocaleString()}L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-amber-400">
                          {t.remaining_litres.toLocaleString()} L
                        </div>
                        <div className="text-[10px] text-slate-400">
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
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Red / Palm Oil Tanks
                </h3>
                <p className="text-[11px] text-slate-400">
                  Standard Density: ~1,085 L/Ton · FIFO Draw Sequence
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-extrabold text-rose-400">
                {redStock.toLocaleString()} L
              </span>
              <span className="text-[10px] text-slate-400 block">
                ≈ {(redStock / 30).toFixed(0)} Kegs
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center justify-items-center py-2">
            {/* Primary combined gauge */}
            <TankGauge
              productId="red"
              productName="Palm Oil Combined Depletion"
              remainingLitres={redStock}
              totalCapacityLitres={15000}
              size="lg"
            />

            {/* Individual active red tanks list */}
            <div className="w-full space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active In-Feed Tanks
              </div>
              {tanks
                .filter(t => t.product_id === 'red')
                .map((t, idx) => {
                  const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-rose-400 font-mono">
                            Tank #{idx + 1}
                          </span>
                          <span>{t.truck_label}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Intake: {formatDepotDate(t.date)} · Received: {t.received_litres.toLocaleString()}L
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-rose-400">
                          {t.remaining_litres.toLocaleString()} L
                        </div>
                        <div className="text-[10px] text-slate-400">
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

      {/* Split Alert Stream: THREE DISTINCT ALERT TYPES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Active Risk Signals & Operational Alerts</span>
          </h3>
          <span className="text-xs text-slate-400">
            {activeAlerts.totalAlertCount === 0
              ? 'All systems within normal thresholds'
              : `${activeAlerts.totalAlertCount} alerts requiring counter attention`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Alert Stream 1: Overdue Credit Invoices */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-rose-400" />
                  <span>1. Overdue Credit Invoices</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {activeAlerts.overdueCredit.length}
                </span>
              </div>

              {activeAlerts.overdueCredit.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No overdue credit accounts.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.overdueCredit.map(alert => (
                    <div
                      key={alert.customer.id}
                      onClick={() => onNavigate('customers')}
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-950/30 border border-rose-900/50 hover:bg-rose-950/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200">{alert.customer.name}</div>
                        <div className="text-[10px] text-rose-400 font-mono font-semibold">
                          Overdue by {alert.overdueDays} days
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-rose-300">
                          {formatNaira(alert.amount)}
                        </div>
                        <span className="text-[10px] text-slate-400 flex items-center justify-end gap-0.5">
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
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>2. Credit Limit Breaches</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {activeAlerts.overLimit.length}
                </span>
              </div>

              {activeAlerts.overLimit.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  All accounts within approved credit caps.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.overLimit.map(alert => (
                    <div
                      key={alert.customer.id}
                      onClick={() => onNavigate('customers')}
                      className="cursor-pointer p-2.5 rounded-xl bg-amber-950/30 border border-amber-900/50 hover:bg-amber-950/50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200">{alert.customer.name}</div>
                        <div className="text-[10px] text-amber-400">
                          Limit: {formatNaira(alert.limit)}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-amber-300">
                          {formatNaira(alert.balance)}
                        </div>
                        <div className="text-[10px] text-rose-400 font-semibold">
                          +{formatNaira(alert.excess)} over
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alert Stream 3: Delivery Shortfall Flags (> 50L) */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                  <Truck className="w-4 h-4 text-rose-400" />
                  <span>3. Delivery Shortfall (&gt; 50L)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {activeAlerts.deliveryShortfall.length}
                </span>
              </div>

              {activeAlerts.deliveryShortfall.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No high-variance intakes logged.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeAlerts.deliveryShortfall.map(alert => (
                    <div
                      key={alert.tank.id}
                      onClick={() => onNavigate('intake')}
                      className="cursor-pointer p-2.5 rounded-xl bg-rose-950/30 border border-rose-900/50 hover:bg-rose-950/50 transition-colors flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-slate-200">{alert.tank.truck_label}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatDepotDate(alert.tank.date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-rose-400">
                          -{alert.shortfallLitres.toFixed(1)} L
                        </div>
                        <div className="text-[10px] text-rose-300 font-semibold">
                          Loss / Shrinkage
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
