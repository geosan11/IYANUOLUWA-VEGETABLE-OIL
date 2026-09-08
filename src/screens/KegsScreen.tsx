import React, { useState } from 'react';
import { useStore } from '../services/store';
import { formatDepotDate, formatDepotTime } from '../services/businessLogic';
import {
  Package,
  Boxes,
  ArrowDownLeft,
  RotateCcw,
  Edit2,
  Check,
  CheckCircle2,
  History
} from 'lucide-react';

export const KegsScreen: React.FC = () => {
  const {
    customers,
    orders,
    kegReturns,
    settings,
    kegInventory,
    updateSettings,
    logKegReturn
  } = useStore();

  const [isEditingTotalKegs, setIsEditingTotalKegs] = useState(false);
  const [editableTotalKegs, setEditableTotalKegs] = useState<string>(
    settings.total_company_kegs.toString()
  );

  // Quick log return per customer state
  const [returnCustomerInputs, setReturnCustomerInputs] = useState<Record<string, string>>({});
  const [logSuccessMsg, setLogSuccessMsg] = useState<string | null>(null);

  const handleSaveTotalKegs = () => {
    const val = parseInt(editableTotalKegs) || 500;
    updateSettings({ total_company_kegs: val });
    setIsEditingTotalKegs(false);
  };

  const handleQuickReturn = (customerId: string) => {
    const qtyStr = returnCustomerInputs[customerId];
    const qty = parseInt(qtyStr) || 0;
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
    <div className="space-y-6 pb-12">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-400" />
            <span>Keg Container Inventory & Depot Gate Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track company-owned 30L return obligations vs customer-owned containers with physical yard inventory limits.
          </p>
        </div>
      </div>

      {logSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{logSuccessMsg}</span>
        </div>
      )}

      {/* Top Summary Cards (3 Pillars) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Total Company Kegs Asset (Editable) */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Company Fleet
            </span>
            <button
              onClick={() => {
                if (isEditingTotalKegs) {
                  handleSaveTotalKegs();
                } else {
                  setEditableTotalKegs(settings.total_company_kegs.toString());
                  setIsEditingTotalKegs(true);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Edit fleet cap"
            >
              {isEditingTotalKegs ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Edit2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {isEditingTotalKegs ? (
            <div className="flex items-center gap-2 my-1">
              <input
                type="number"
                value={editableTotalKegs}
                onChange={e => setEditableTotalKegs(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg bg-slate-950 border border-brand-500 text-base font-mono font-bold text-white focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveTotalKegs}
                className="px-3 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-xs font-bold"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="text-2xl font-black font-mono text-slate-100">
              {settings.total_company_kegs} <span className="text-xs font-normal text-slate-400">total owned</span>
            </div>
          )}

          <div className="text-[10px] text-slate-400 mt-2">
            Physical company-owned asset inventory registered.
          </div>
        </div>

        {/* 2. Total Kegs Out in Field */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Kegs Out in Field
            </span>
            <Boxes className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black font-mono text-sky-400">
            {kegInventory.totalKegsOut} <span className="text-xs font-normal text-slate-400">with customers</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            Active return obligations awaiting gate collection.
          </div>
        </div>

        {/* 3. Empty Kegs at Depot Yard (Red if < 20) */}
        <div
          className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-900/20 animate-pulse'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                kegInventory.isDepotStockCritical ? 'text-rose-300' : 'text-slate-400'
              }`}
            >
              Kegs at Depot Yard
            </span>
            <RotateCcw
              className={`w-4 h-4 ${
                kegInventory.isDepotStockCritical ? 'text-rose-400' : 'text-brand-400'
              }`}
            />
          </div>
          <div
            className={`text-2xl font-black font-mono ${
              kegInventory.isDepotStockCritical ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {kegInventory.kegsAtDepot} <span className="text-xs font-normal text-slate-400">available</span>
          </div>
          <div
            className={`text-[10px] mt-2 font-semibold ${
              kegInventory.isDepotStockCritical ? 'text-rose-300' : 'text-slate-400'
            }`}
          >
            {kegInventory.isDepotStockCritical
              ? 'CRITICAL SHORTAGE: Fleet below 20 kegs!'
              : 'Physical container capacity ready for filling.'}
          </div>
        </div>
      </div>

      {/* Customer Keg Ledger Matrix (Desktop Table View) */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-brand-400" />
              <span>Customer Keg Ledger & Return Management</span>
            </h3>
            <p className="text-xs text-slate-400">
              Audit balance = Total Company Supplied − Total Logged Returns.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Account Tier</th>
                <th className="py-2.5 px-3 text-right">Company Supplied</th>
                <th className="py-2.5 px-3 text-right">Collected Returns</th>
                <th className="py-2.5 px-3 text-right">Outstanding (Out)</th>
                <th className="py-2.5 px-3 text-center">Quick Log Empty Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {customers.map(cust => {
                const custOrders = orders.filter(
                  o => o.customer_id === cust.id && o.keg_source === 'company' && o.unit === 'keg'
                );
                const supplied = custOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);
                const returned = kegReturns
                  .filter(r => r.customer_id === cust.id)
                  .reduce((sum, r) => sum + Number(r.qty || 0), 0);
                const balanceOut = Math.max(0, supplied - returned);

                const currentInputVal = returnCustomerInputs[cust.id] || '';

                return (
                  <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-200 text-sm font-sans">{cust.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{cust.phone}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                        {cust.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-300">
                      {supplied} kegs
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 font-medium">
                      {returned} kegs
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      <span
                        className={`text-sm ${
                          balanceOut > 0 ? 'text-sky-400' : 'text-slate-400'
                        }`}
                      >
                        {balanceOut} kegs
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                        <input
                          type="number"
                          min="1"
                          max={balanceOut > 0 ? balanceOut : 100}
                          value={currentInputVal}
                          onChange={e =>
                            setReturnCustomerInputs(prev => ({
                              ...prev,
                              [cust.id]: e.target.value
                            }))
                          }
                          placeholder="Qty..."
                          className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono text-center focus:outline-none focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickReturn(cust.id)}
                          disabled={!currentInputVal || parseInt(currentInputVal) <= 0}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>Log</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Depot Gate History (Audit Log of All Logged Returns) */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Depot Gate History — Return Audit Log</span>
            </h3>
            <p className="text-xs text-slate-400">
              Verified chronological record of empty company containers returned at the gate.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {kegReturns.length} Logged Events
          </span>
        </div>

        {kegReturns.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No returns logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2 px-3">Date & Time</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3 text-right">Returned Qty</th>
                  <th className="py-2 px-3 text-center">Gate Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {kegReturns.map(ret => {
                  const cust = customers.find(c => c.id === ret.customer_id);
                  return (
                    <tr key={ret.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-300">
                        {formatDepotDate(ret.date)} {formatDepotTime(ret.date)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-200">
                        {cust?.name || 'Unknown Customer'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                        +{ret.qty} Empty Kegs
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          <span>Inspected & Received</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
