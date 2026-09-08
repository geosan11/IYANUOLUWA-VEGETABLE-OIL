import React, { useState } from 'react';
import { useStore } from '../services/store';
import { formatDepotDate, formatDepotTime } from '../services/businessLogic';
import {
  Package,
  Boxes,
  ArrowDownLeft,
  RotateCcw,
  CheckCircle2,
  History,
  ExternalLink,
  Plus
} from 'lucide-react';

export const KegsScreen: React.FC = () => {
  const {
    customers,
    orders,
    kegReturns,
    settings,
    kegInventory,
    logKegReturn
  } = useStore();

  // Quick log return per customer state
  const [returnCustomerInputs, setReturnCustomerInputs] = useState<Record<string, string>>({});
  const [logSuccessMsg, setLogSuccessMsg] = useState<string | null>(null);

  const handleQuickReturn = (customerId: string) => {
    const qtyStr = returnCustomerInputs[customerId];
    const qty = parseInt(qtyStr, 10) || 0;
    if (qty <= 0) return;

    const result = logKegReturn(customerId, qty);
    if (result.success) {
      setReturnCustomerInputs(prev => ({ ...prev, [customerId]: '' }));
      const cust = customers.find(c => c.id === customerId);
      setLogSuccessMsg(`Successfully logged ${qty} keg returns from ${cust?.name}!`);
      setTimeout(() => setLogSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>Keg Container Inventory & Depot Gate Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track company-owned 30L return obligations vs customer-owned containers with physical yard inventory limits.
          </p>
        </div>
      </div>

      {logSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">{logSuccessMsg}</span>
        </div>
      )}

      {/* Top Summary Cards (3 Pillars) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Total Company Kegs Asset (Read-only with Settings Link) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Company Fleet
            </span>
            <span className="text-[10px] text-slate-400">Settings Controlled</span>
          </div>

          <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
            {settings.total_company_kegs} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">total fleet</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 text-[11px]">
            <span className="text-slate-500">Fleet asset cap</span>
            <span className="text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1">
              Read-only
            </span>
          </div>
        </div>

        {/* 2. Total Kegs Out in Field */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Kegs Out in Field
            </span>
            <Boxes className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
            {kegInventory.totalKegsOut} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">with customers</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            Active return obligations awaiting gate collection.
          </div>
        </div>

        {/* 3. Physical Kegs at Depot Yard */}
        <div
          className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-600/60 shadow-rose-500/10'
              : 'bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Kegs at Depot
            </span>
            <RotateCcw
              className={`w-4 h-4 ${
                kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-brand-600 dark:text-brand-400'
              }`}
            />
          </div>
          <div
            className={`text-2xl font-black font-mono ${
              kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {kegInventory.kegsAtDepot} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">ready to fill</span>
          </div>
          <div
            className={`text-[10px] mt-2 ${
              kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500'
            }`}
          >
            {kegInventory.isDepotStockCritical
              ? `CRITICAL ALERT: Stock < ${settings.kegs_at_depot_low_threshold}`
              : `Physical inventory in depot storage (Safe > ${settings.kegs_at_depot_low_threshold})`}
          </div>
        </div>
      </div>

      {/* Main 2-Section Grid: Customer Balance Matrix & Gate Return Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Customer Return Obligation Matrix (lg:col-span-7) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Customer Keg Balance Matrix</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Supplied vs Returned company jerrycans with quick-return entry.
              </p>
            </div>
          </div>

          {/* Desktop Table & Mobile Cards */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-3 py-3 text-center">Supplied</th>
                  <th className="px-3 py-3 text-center">Returned</th>
                  <th className="px-3 py-3 text-center">Unreturned</th>
                  <th className="px-4 py-3 text-right">Gate Quick Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono">
                {customers.map(cust => {
                  const custOrders = orders.filter(o => o.customer_id === cust.id && o.keg_source === 'company' && o.unit === 'keg');
                  const supplied = custOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);
                  const custReturns = kegReturns.filter(r => r.customer_id === cust.id);
                  const returned = custReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
                  const balance = Math.max(0, supplied - returned);

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3 font-sans">
                        <div className="font-bold text-slate-900 dark:text-slate-200">{cust.name}</div>
                        <div className="text-[10px] text-slate-500 capitalize">{cust.type} account</div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400">
                        {supplied}
                      </td>
                      <td className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400">
                        {returned}
                      </td>
                      <td className="px-3 py-3 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          balance > 0
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {balance}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min="1"
                            max={balance || undefined}
                            placeholder="Qty"
                            value={returnCustomerInputs[cust.id] || ''}
                            onChange={e =>
                              setReturnCustomerInputs({
                                ...returnCustomerInputs,
                                [cust.id]: e.target.value
                              })
                            }
                            className="w-16 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-right focus:outline-none focus:border-brand-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickReturn(cust.id)}
                            className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-[11px] shadow-sm transition-all active:scale-95 whitespace-nowrap"
                          >
                            + Return
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Touch Cards */}
          <div className="sm:hidden space-y-3">
            {customers.map(cust => {
              const custOrders = orders.filter(o => o.customer_id === cust.id && o.keg_source === 'company' && o.unit === 'keg');
              const supplied = custOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);
              const custReturns = kegReturns.filter(r => r.customer_id === cust.id);
              const returned = custReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
              const balance = Math.max(0, supplied - returned);

              return (
                <div
                  key={cust.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs">{cust.name}</div>
                      <div className="text-[10px] text-slate-500 capitalize">{cust.type} account</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      balance > 0
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {balance} Out
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Total Supplied</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{supplied}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Total Returned</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{returned}</span>
                    </div>
                  </div>

                  {/* Return Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      inputMode="numeric"
                      value={returnCustomerInputs[cust.id] || ''}
                      onChange={e =>
                        setReturnCustomerInputs({
                          ...returnCustomerInputs,
                          [cust.id]: e.target.value
                        })
                      }
                      className="w-24 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-right focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickReturn(cust.id)}
                      className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Gate Return</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Gate Returns Audit Log (lg:col-span-5) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Depot Gate Return Audit History</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified timestamped physical drop-offs at the depot gate.
            </p>
          </div>

          {kegReturns.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No keg returns logged yet.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
              {kegReturns.map(item => {
                const cust = customers.find(c => c.id === item.customer_id);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-slate-200">{cust?.name || 'Customer'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {formatDepotDate(item.date)} · {formatDepotTime(item.date)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>+{item.qty} Kegs</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
