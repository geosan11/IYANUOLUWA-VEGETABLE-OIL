import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Customer } from '../types';
import { BottomSheet } from '../components/common/BottomSheet';
import { formatDepotDate, formatDepotTime } from '../services/businessLogic';
import {
  Package,
  Boxes,
  ArrowDownLeft,
  RotateCcw,
  CheckCircle2,
  History,
  Plus,
  ArrowRightLeft,
  ChevronRight
} from 'lucide-react';

export const KegsScreen: React.FC = () => {
  const {
    customers,
    orders,
    kegReturns,
    transfers,
    settings,
    kegInventory,
    logKegReturn
  } = useStore();

  // Mobile Sheet States
  const [selectedCustomerForReturn, setSelectedCustomerForReturn] = useState<Customer | null>(null);
  const [isAllGateHistoryOpen, setIsAllGateHistoryOpen] = useState(false);

  // Quick log return per customer state
  const [returnCustomerInputs, setReturnCustomerInputs] = useState<Record<string, string>>({});
  const [logSuccessMsg, setLogSuccessMsg] = useState<string | null>(null);

  // Combined gate history: physical depot returns + inter-customer transfers
  const gateHistoryEvents = useMemo(() => {
    const returnEvents = kegReturns.map(r => ({
      id: r.id,
      type: 'return' as const,
      date: r.date,
      qty: r.qty,
      customerName: customers.find(c => c.id === r.customer_id)?.name || 'Customer'
    }));

    const transferEvents = transfers
      .filter(t => t.item_type === 'keg')
      .map(t => ({
        id: t.id,
        type: 'transfer' as const,
        date: t.date,
        qty: t.qty,
        fromName: customers.find(c => c.id === t.from_customer_id)?.name || 'Sender',
        toName: customers.find(c => c.id === t.to_customer_id)?.name || 'Receiver',
        notes: t.note || t.notes
      }));

    return [...returnEvents, ...transferEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [kegReturns, transfers, customers]);

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

  const renderGateEventItem = (item: (typeof gateHistoryEvents)[0]) => {
    if (item.type === 'return') {
      return (
        <div
          key={item.id}
          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
        >
          <div className="space-y-0.5">
            <div className="font-heading font-semibold text-[14px] text-slate-900 dark:text-slate-200">
              {item.customerName}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
              {formatDepotDate(item.date)} · {formatDepotTime(item.date)}
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 text-[12px]">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>+{item.qty} Return</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between text-xs"
      >
        <div className="space-y-0.5">
          <div className="font-heading font-semibold text-[13px] text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
            <span>{item.fromName}</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">➔</span>
            <span>{item.toName}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            {formatDepotDate(item.date)} · {formatDepotTime(item.date)}
            {item.notes && <span className="text-slate-400 font-sans italic ml-1">({item.notes})</span>}
          </div>
          <div className="text-[10px] text-purple-700 dark:text-purple-300/80 font-sans">
            Inter-customer transfer · Depot stock unchanged
          </div>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-300 dark:border-purple-800 text-[12px]">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{item.qty} Transfer</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <span>Keg Container Inventory & Depot Gate Ledger</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Track company-owned 30L return obligations vs customer-owned containers with physical yard inventory limits.
          </p>
        </div>
      </div>

      {logSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[12px] font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{logSuccessMsg}</span>
        </div>
      )}

      {/* Top Summary Cards (3 Pillars) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Total Company Kegs Asset (Read-only with Settings Link) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Company Fleet
            </span>
            <span className="text-[11px] font-sans text-slate-400">Settings Controlled</span>
          </div>

          <div className="text-[32px] font-mono tabular-nums font-bold leading-tight text-slate-900 dark:text-slate-100">
            {settings.total_company_kegs} <span className="text-[14px] font-sans font-normal text-slate-500 dark:text-slate-400">total fleet</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 text-[11px]">
            <span className="text-slate-500 font-sans">Fleet asset cap</span>
            <span className="text-brand-600 dark:text-brand-400 font-semibold font-sans flex items-center gap-1">
              Read-only
            </span>
          </div>
        </div>

        {/* 2. Total Kegs Out in Field */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Kegs Out in Field
            </span>
            <Boxes className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="text-[32px] font-mono tabular-nums font-bold leading-tight text-slate-900 dark:text-slate-100">
            {kegInventory.totalKegsOut} <span className="text-[14px] font-sans font-normal text-slate-500 dark:text-slate-400">with customers</span>
          </div>
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-2">
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
              className={`text-[12px] font-sans font-medium uppercase tracking-wider ${
                kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Kegs at Depot
            </span>
            <RotateCcw
              className={`w-4 h-4 ${
                kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-500 dark:text-slate-400'
              }`}
            />
          </div>
          <div
            className={`text-[32px] font-mono tabular-nums font-bold leading-tight ${
              kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {kegInventory.kegsAtDepot} <span className="text-[14px] font-sans font-normal text-slate-500 dark:text-slate-400">ready to fill</span>
          </div>
          <div
            className={`text-[12px] font-sans mt-2 ${
              kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500 dark:text-slate-400'
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
              <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <span>Customer Keg Balance Matrix</span>
              </h3>
              <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                Supplied vs Returned company jerrycans with quick-return entry.
              </p>
            </div>
          </div>

          {/* Desktop Table & Mobile Cards */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-sans">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-3 py-3 text-center">Supplied</th>
                  <th className="px-3 py-3 text-center">Returned</th>
                  <th className="px-3 py-3 text-center">Unreturned</th>
                  <th className="px-4 py-3 text-right">Gate Quick Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono tabular-nums">
                {customers.map(cust => {
                  const custOrders = orders.filter(o => o.customer_id === cust.id && o.keg_source === 'company' && o.unit === 'keg');
                  const supplied = custOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);
                  const custReturns = kegReturns.filter(r => r.customer_id === cust.id);
                  const returned = custReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
                  const balance = Math.max(0, supplied - returned);

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3 font-sans">
                        <div className="font-heading font-semibold text-[14px] text-slate-900 dark:text-slate-200">{cust.name}</div>
                        <div className="text-[11px] text-slate-500 capitalize font-sans">{cust.type} account</div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 text-[13px]">
                        {supplied}
                      </td>
                      <td className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold text-[13px]">
                        {returned}
                      </td>
                      <td className="px-3 py-3 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums ${
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
                            className="w-16 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[14px] font-mono tabular-nums font-bold text-right focus:outline-none focus:border-brand-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickReturn(cust.id)}
                            className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[12px] shadow-sm transition-all active:scale-95 whitespace-nowrap"
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

          {/* Mobile View: Condensed Touch Rows */}
          <div className="sm:hidden space-y-2.5">
            {customers.map(cust => {
              const custOrders = orders.filter(o => o.customer_id === cust.id && o.keg_source === 'company' && o.unit === 'keg');
              const supplied = custOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);
              const custReturns = kegReturns.filter(r => r.customer_id === cust.id);
              const returned = custReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
              const balance = Math.max(0, supplied - returned);

              return (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomerForReturn(cust)}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-98 transition-all cursor-pointer shadow-sm"
                >
                  <div>
                    <div className="font-heading font-semibold text-[14px] text-slate-900 dark:text-white">
                      {cust.name}
                    </div>
                    <div className="text-[11px] font-sans text-slate-500 capitalize">
                      {cust.type} account · {supplied} supplied
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums font-bold ${
                      balance > 0
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {balance} Out
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Gate Returns & Transfer Movements Audit Log (lg:col-span-5) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Gate Returns & Fleet Movement Audit</span>
            </h3>
            <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
              Physical depot returns & inter-customer yard transfers.
            </p>
          </div>

          {gateHistoryEvents.length === 0 ? (
            <p className="text-[12px] font-sans text-slate-400 py-8 text-center">
              No keg movements logged yet.
            </p>
          ) : (
            <>
              {/* Mobile Truncated Gate History (Top 3 items + View All Sheet Trigger) */}
              <div className="sm:hidden space-y-2.5">
                {gateHistoryEvents.slice(0, 3).map(renderGateEventItem)}
                {gateHistoryEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsAllGateHistoryOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[12px] font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 active:scale-98"
                  >
                    <span>View full gate history ({gateHistoryEvents.length} movements)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Desktop Full Scrollable List */}
              <div className="hidden sm:block space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {gateHistoryEvents.map(renderGateEventItem)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MOBILE LOG KEG RETURN BOTTOM SHEET */}
      {selectedCustomerForReturn && (() => {
        const custOrders = orders.filter(
          o => o.customer_id === selectedCustomerForReturn.id && o.keg_source === 'company' && o.unit === 'keg'
        );
        const supplied = custOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);
        const custReturns = kegReturns.filter(r => r.customer_id === selectedCustomerForReturn.id);
        const returned = custReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
        const balance = Math.max(0, supplied - returned);
        const currentInput = returnCustomerInputs[selectedCustomerForReturn.id] || '';

        return (
          <BottomSheet
            isOpen={!!selectedCustomerForReturn}
            onClose={() => setSelectedCustomerForReturn(null)}
            title={selectedCustomerForReturn.name}
            subtitle={`${selectedCustomerForReturn.type.toUpperCase()} · Log Physical Return`}
          >
            <div className="space-y-4">
              {/* Custody Breakdown Stats */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-sans text-slate-500 block">Supplied</span>
                  <span className="text-[16px] font-bold text-slate-800 dark:text-slate-200">{supplied}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-sans text-slate-500 block">Returned</span>
                  <span className="text-[16px] font-bold text-emerald-600 dark:text-emerald-400">{returned}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                  <span className="text-[11px] font-sans text-amber-800 dark:text-amber-300 block">In Custody</span>
                  <span className="text-[16px] font-bold text-amber-700 dark:text-amber-300">{balance}</span>
                </div>
              </div>

              {/* Return Entry Form */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleQuickReturn(selectedCustomerForReturn.id);
                  setSelectedCustomerForReturn(null);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-[12px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Number of Company Kegs Returning *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={balance || undefined}
                      required
                      placeholder="e.g. 5"
                      value={currentInput}
                      onChange={e =>
                        setReturnCustomerInputs({
                          ...returnCustomerInputs,
                          [selectedCustomerForReturn.id]: e.target.value
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-[16px] font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                {/* Quick Fill Chips */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-sans text-slate-500">Quick fill:</span>
                  {[1, 5, 10, balance].filter(v => v > 0 && v <= balance).map((val, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() =>
                        setReturnCustomerInputs({
                          ...returnCustomerInputs,
                          [selectedCustomerForReturn.id]: val.toString()
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      +{val} {val === balance ? '(All)' : ''}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] shadow-sm transition-all flex items-center justify-center gap-2 mt-2 active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>Confirm Gate Return & Restock Depot</span>
                </button>
              </form>
            </div>
          </BottomSheet>
        );
      })()}

      {/* MOBILE ALL GATE MOVEMENTS BOTTOM SHEET */}
      <BottomSheet
        isOpen={isAllGateHistoryOpen}
        onClose={() => setIsAllGateHistoryOpen(false)}
        title="Complete Gate Movement History"
        subtitle={`${gateHistoryEvents.length} total return and transfer movements`}
      >
        <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
          {gateHistoryEvents.map(renderGateEventItem)}
        </div>
      </BottomSheet>
    </div>
  );
};
