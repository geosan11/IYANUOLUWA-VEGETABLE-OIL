import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Customer } from '../types';
import { BottomSheet } from '../components/common/BottomSheet';
import { KegFleetLifecycleDiagram } from '../components/common/KegFleetLifecycleDiagram';
import { formatDepotDate, formatDepotTime } from '../services/businessLogic';
import { packLabel } from '../constants/config';
import {
  Package,
  Stack as Boxes,
  ArrowDownLeft,
  ArrowCounterClockwise as RotateCcw,
  CheckCircle as CheckCircle2,
  ClockCounterClockwise as History,
  Plus,
  ArrowsLeftRight as ArrowRightLeft,
  CaretRight as ChevronRight,
  ArrowsDownUp as ArrowUpDown,
  ArrowUp,
  ArrowDown
} from '@phosphor-icons/react';

type SortField = 'customer' | 'supplied' | 'returned' | 'balance';

export const KegsScreen: React.FC = () => {
  const {
    customers,
    orders,
    kegReturns,
    transfers,
    settings,
    kegInventory,
    customerStatsMap,
    logKegReturn
  } = useStore();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Sort & Master-Detail Selection State
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');

  // Persistent Detail Panel Return Form State
  const [detailReturnQty, setDetailReturnQty] = useState<string>('5');
  const [detailReturnNotes, setDetailReturnNotes] = useState<string>('');
  const [detailReturnFeedback, setDetailReturnFeedback] = useState<string | null>(null);
  const [detailReturnPack, setDetailReturnPack] = useState<string>('');

  // Company containers on loan for the active customer, per (product, pack size).
  const packBuckets = (custId: string): { key: string; productId: string; packSizeId: string; qty: number }[] =>
    Object.entries(customerStatsMap[custId]?.kegsOutByPack || {})
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const [productId, packSizeId] = key.split('|');
        return { key, productId, packSizeId, qty };
      });

  // Mobile Sheet States
  const [selectedCustomerForReturn, setSelectedCustomerForReturn] = useState<Customer | null>(null);
  const [isAllGateHistoryOpen, setIsAllGateHistoryOpen] = useState(false);
  const [returnCustomerInputs, setReturnCustomerInputs] = useState<Record<string, string>>({});
  const [logSuccessMsg, setLogSuccessMsg] = useState<string | null>(null);
  const [logErrorMsg, setLogErrorMsg] = useState<string | null>(null);

  // Helper to compute stats for any customer
  const getCustStats = (custId: string) => {
    const custOrders = orders.filter(
      o => o.customer_id === custId && !o.voided && o.container_mode === 'taken'
    );
    const supplied = custOrders.reduce((sum, o) => sum + Number(o.qty || 0), 0);
    const custReturns = kegReturns.filter(r => r.customer_id === custId);
    const returned = custReturns.reduce((sum, r) => sum + Number(r.qty || 0), 0);
    const balance = customerStatsMap[custId]?.totalCompanyKegsOut ?? Math.max(0, supplied - returned);
    return { supplied, returned, balance };
  };

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
        notes: t.note
      }));

    return [...returnEvents, ...transferEvents].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [kegReturns, transfers, customers]);

  // Active customer for desktop detail panel
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0] || null;
  }, [customers, selectedCustomerId]);

  const activeStats = useMemo(() => {
    if (!activeCustomer) return { supplied: 0, returned: 0, balance: 0 };
    return getCustStats(activeCustomer.id);
  }, [activeCustomer, orders, kegReturns]);

  // History specific to the active customer
  const activeCustomerHistory = useMemo(() => {
    if (!activeCustomer) return [];
    return gateHistoryEvents.filter(ev => {
      if (ev.type === 'return') {
        const ret = kegReturns.find(r => r.id === ev.id);
        return ret?.customer_id === activeCustomer.id;
      } else {
        const tr = transfers.find(t => t.id === ev.id);
        return tr?.from_customer_id === activeCustomer.id || tr?.to_customer_id === activeCustomer.id;
      }
    });
  }, [activeCustomer, gateHistoryEvents, kegReturns, transfers]);

  const overdueLoanCount = useMemo(() => {
    return Object.values(customerStatsMap).reduce((acc, stat) => {
      return stat.agingBadge?.status === 'overdue' && stat.totalCompanyKegsOut > 0
        ? acc + stat.totalCompanyKegsOut
        : acc;
    }, 0);
  }, [customerStatsMap]);

  // Sorting logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-40" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-amber-500" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-amber-500" />
    );
  };

  const sortedCustomers = useMemo(() => {
    const list = customers.map(c => {
      const stats = getCustStats(c.id);
      return {
        ...c,
        supplied: stats.supplied,
        returned: stats.returned,
        balance: stats.balance
      };
    });

    // Apply search filter
    const filtered = searchQuery.trim()
      ? list.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : list;

    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'customer') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'supplied') {
        comparison = a.supplied - b.supplied;
      } else if (sortField === 'returned') {
        comparison = a.returned - b.returned;
      } else if (sortField === 'balance') {
        comparison = a.balance - b.balance;
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [customers, orders, kegReturns, sortField, sortAsc, searchQuery]);

  const handleQuickReturn = (customerId: string) => {
    setLogErrorMsg(null);
    const qty = parseInt(returnCustomerInputs[customerId] || '0', 10);
    if (qty <= 0) return;

    const buckets = packBuckets(customerId);
    const target = buckets[0];
    if (!target) {
      setLogErrorMsg('This customer has no returnable containers out.');
      return;
    }
    const result = logKegReturn(customerId, qty, target.productId, target.packSizeId);
    if (result.success) {
      setReturnCustomerInputs(prev => ({ ...prev, [customerId]: '' }));
      const cust = customers.find(c => c.id === customerId);
      setLogSuccessMsg(`Successfully logged ${qty} keg returns from ${cust?.name}!`);
      setTimeout(() => setLogSuccessMsg(null), 4000);
    } else {
      setLogErrorMsg(result.error || 'Could not log the keg return.');
    }
  };

  const handleDetailPanelReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    const qty = parseInt(detailReturnQty, 10) || 0;
    if (qty <= 0) return;

    setLogErrorMsg(null);
    const buckets = packBuckets(activeCustomer.id);
    const chosen = buckets.find(b => b.key === detailReturnPack) || buckets[0];
    if (!chosen) {
      setLogErrorMsg('This customer has no returnable containers out.');
      return;
    }
    const result = logKegReturn(activeCustomer.id, qty, chosen.productId, chosen.packSizeId, detailReturnNotes);
    if (result.success) {
      setDetailReturnFeedback(`Logged ${qty} keg returns from ${activeCustomer.name}`);
      setTimeout(() => setDetailReturnFeedback(null), 4000);
      setDetailReturnQty('1');
      setDetailReturnNotes('');
    } else {
      setLogErrorMsg(result.error || 'Could not log the keg return.');
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
            <div className="font-heading font-semibold text-sm text-slate-900 dark:text-slate-200">
              {item.customerName}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              {formatDepotDate(item.date)} · {formatDepotTime(item.date)}
            </div>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs">
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
          <div className="font-heading font-semibold text-xs text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
            <span>{item.fromName}</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">➔</span>
            <span>{item.toName}</span>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {formatDepotDate(item.date)} · {formatDepotTime(item.date)}
            {item.notes && <span className="text-slate-400 font-sans italic ml-1">({item.notes})</span>}
          </div>
          <div className="text-[10px] text-purple-700 dark:text-purple-300/80 font-sans">
            Inter-customer transfer · Depot stock unchanged
          </div>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center gap-1 font-mono tabular-nums font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-300 dark:border-purple-800 text-xs">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark">
        <div>
          <h2 className="text-xl font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Keg Containers & Fleet Asset Tracker</span>
          </h2>
          <p className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-1">
            Track depot-owned jerrycans on loan with customers, yard stock, and returns at the gate.
          </p>
        </div>
      </div>

      {logSuccessMsg && (
        <div role="status" aria-live="polite" className="p-4 rounded-xl badge-emerald border border-emerald-300 dark:border-emerald-700 text-xs font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{logSuccessMsg}</span>
        </div>
      )}

      {logErrorMsg && (
        <div role="alert" aria-live="assertive" className="p-4 rounded-xl badge-rose border border-rose-300 dark:border-rose-700 text-xs font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <span>{logErrorMsg}</span>
          <button type="button" onClick={() => setLogErrorMsg(null)} className="ml-auto text-rose-500 hover:text-rose-700 dark:hover:text-rose-200">✕</button>
        </div>
      )}

      {/* Visual Lifecycle Illustration */}
      <KegFleetLifecycleDiagram
        inYardCount={kegInventory.kegsAtDepot}
        loanedCount={kegInventory.totalKegsOut}
        overdueCount={overdueLoanCount}
        depositRate={2000}
      />

      {/* Top Summary Cards (3 Pillars) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Total Company Kegs Asset */}
        <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Company Fleet
            </span>
            <span className="text-xs font-sans text-slate-400">Settings Fixed</span>
          </div>

          <div className="text-3xl font-mono tabular-nums font-bold leading-tight text-slate-900 dark:text-slate-100">
            {settings.total_company_kegs} <span className="text-sm font-sans font-normal text-slate-500 dark:text-slate-400">kegs</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 text-xs">
            <span className="text-slate-500 font-sans">Fleet asset capital</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold font-sans">
              Protected Asset
            </span>
          </div>
        </div>

        {/* 2. Total Kegs Out in Field */}
        <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Kegs Out in Field
            </span>
            <Boxes className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-3xl font-mono tabular-nums font-bold leading-tight text-sky-600 dark:text-sky-400">
            {kegInventory.totalKegsOut} <span className="text-sm font-sans font-normal text-slate-500 dark:text-slate-400">with customers</span>
          </div>
          <div className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-2">
            Active container loans with cash deposits held.
          </div>
        </div>

        {/* 3. Physical Kegs at Depot Yard */}
        <div
          className={`p-5 rounded-2xl depot-card border shadow-card-light dark:shadow-card-dark flex flex-col justify-between transition-all ${
            kegInventory.isDepotStockCritical
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-600/60'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-sans font-medium uppercase tracking-wider ${
                kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Kegs at Depot Yard
            </span>
            <RotateCcw
              className={`w-4 h-4 ${
                kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-500 dark:text-slate-400'
              }`}
            />
          </div>
          <div
            className={`text-3xl font-mono tabular-nums font-bold leading-tight ${
              kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {kegInventory.kegsAtDepot} <span className="text-sm font-sans font-normal text-slate-500 dark:text-slate-400">ready to fill</span>
          </div>
          <div
            className={`text-xs font-sans mt-2 ${
              kegInventory.isDepotStockCritical ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {kegInventory.isDepotStockCritical
              ? `CRITICAL ALERT: Stock < ${settings.kegs_at_depot_low_threshold}`
              : `Physical inventory ready in yard (Safe > ${settings.kegs_at_depot_low_threshold})`}
          </div>
        </div>
      </div>

      {/* MASTER-DETAIL GRID (≥900px: Side-by-Side 7:5 Split) */}
      <div className="grid grid-cols-1 split:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Customer Keg Matrix (split:col-span-7) */}
        <div className="split:col-span-7 p-5 sm:p-6 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 space-y-4 shadow-card-light dark:shadow-card-dark">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-500" />
                <span>Customer Container Balance Matrix</span>
              </h3>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                Kegs loaned out vs returned. Click a row to log a gate return.
              </p>
            </div>

            {/* Customer Search Filter */}
            <div className="w-full sm:w-48">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="depot-input w-full px-3 py-1.5 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Desktop/Tablet Sortable Table */}
          <div className="hidden split:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold text-xs tracking-wider border-b border-slate-200 dark:border-slate-800 font-sans">
                <tr>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSort('customer')}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('customer'); } }}
                    className="px-4 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Customer {renderSortIcon('customer')}
                  </th>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSort('supplied')}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('supplied'); } }}
                    className="px-3 py-3 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Supplied {renderSortIcon('supplied')}
                  </th>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSort('returned')}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('returned'); } }}
                    className="px-3 py-3 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Returned {renderSortIcon('returned')}
                  </th>
                  <th
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSort('balance')}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('balance'); } }}
                    className="px-3 py-3 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    Unreturned {renderSortIcon('balance')}
                  </th>
                  <th className="px-3 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                {sortedCustomers.map(cust => {
                  const isSelected = selectedCustomerId === cust.id;

                  return (
                    <tr
                      key={cust.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${cust.name}, ${cust.balance} unreturned kegs`}
                      onClick={() => setSelectedCustomerId(cust.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCustomerId(cust.id); } }}
                      className={`cursor-pointer transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-amber-500 font-medium'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/50 border-l-4 border-transparent'
                      }`}
                    >
                      <td className="px-4 py-3 font-sans">
                        <div className="font-heading font-semibold text-sm text-slate-900 dark:text-slate-200">
                          {cust.name}
                        </div>
                        <div className="text-xs text-slate-500 capitalize font-sans">
                          {cust.type} account
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 text-xs">
                        {cust.supplied}
                      </td>
                      <td className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        {cust.returned}
                      </td>
                      <td className="px-3 py-3 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-mono tabular-nums ${
                            cust.balance > 0
                              ? 'badge-amber'
                              : 'badge-muted'
                          }`}
                        >
                          {cust.balance}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-sans">
                        {cust.balance > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <span>Pending</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span>Settled</span>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Condensed Touch Rows */}
          <div className="split:hidden space-y-2.5">
            {sortedCustomers.map(cust => (
              <div
                key={cust.id}
                role="button"
                tabIndex={0}
                aria-label={`${cust.name}, ${cust.balance} kegs out`}
                onClick={() => setSelectedCustomerForReturn(cust)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCustomerForReturn(cust); } }}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-98 transition-all cursor-pointer shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <div>
                  <div className="font-heading font-semibold text-sm text-slate-900 dark:text-white">
                    {cust.name}
                  </div>
                  <div className="text-xs font-sans text-slate-500 capitalize">
                    {cust.type} account · {cust.supplied} supplied · {cust.returned} returned
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-bold ${
                      cust.balance > 0
                        ? 'badge-amber'
                        : 'badge-muted'
                    }`}
                  >
                    {cust.balance} Out
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Persistent Customer Detail & Return Panel (split:col-span-5) */}
        <div className="hidden split:block split:col-span-5 space-y-6 sticky top-6">
          {activeCustomer ? (
            <div className="p-5 sm:p-6 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 shadow-card-light dark:shadow-card-dark space-y-5">
              {/* Header */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
                    {activeCustomer.name}
                  </h3>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold font-sans uppercase tracking-wider ${
                      activeStats.balance > 0
                        ? 'badge-amber'
                        : 'badge-emerald'
                    }`}
                  >
                    {activeStats.balance > 0 ? `${activeStats.balance} Kegs Due` : 'Account Settled'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-1 font-sans">
                  {activeCustomer.type} account · Customer Container Profile
                </p>
              </div>

              {/* 3 Summary Mini-Cards */}
              <div className="grid grid-cols-3 gap-2.5 text-center font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-sans text-slate-500 block">Supplied</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {activeStats.supplied}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-sans text-slate-500 block">Returned</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {activeStats.returned}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                  <span className="text-xs font-sans text-amber-800 dark:text-amber-300 block">In Custody</span>
                  <span className="text-base font-bold text-amber-700 dark:text-amber-300">
                    {activeStats.balance}
                  </span>
                </div>
              </div>

              {/* Feedback Alert */}
              {detailReturnFeedback && (
                <div className="p-3 rounded-xl badge-emerald border border-emerald-300 dark:border-emerald-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{detailReturnFeedback}</span>
                </div>
              )}

              {/* In-Place Quick Return Form */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  <span>Log Depot Gate Return</span>
                </h4>

                <form onSubmit={handleDetailPanelReturn} className="space-y-3">
                  {packBuckets(activeCustomer.id).length > 0 && (
                    <div>
                      <label htmlFor="detail-return-pack" className="block text-xs font-sans text-slate-600 dark:text-slate-400 mb-1">
                        Container Size
                      </label>
                      <select
                        id="detail-return-pack"
                        value={detailReturnPack || packBuckets(activeCustomer.id)[0]?.key || ''}
                        onChange={e => setDetailReturnPack(e.target.value)}
                        className="depot-input w-full px-3 py-2 rounded-lg text-xs font-sans"
                      >
                        {packBuckets(activeCustomer.id).map(b => (
                          <option key={b.key} value={b.key}>
                            {packLabel(b.packSizeId)} — {b.qty} out
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="detail-return-qty" className="block text-xs font-sans text-slate-600 dark:text-slate-400 mb-1">
                      Kegs Returned to Yard
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="detail-return-qty"
                        type="number"
                        min="1"
                        max={activeStats.balance || undefined}
                        required
                        value={detailReturnQty}
                        onChange={e => setDetailReturnQty(e.target.value)}
                        className="depot-input w-24 px-3 py-2 rounded-lg text-base font-mono tabular-nums font-bold text-right"
                      />
                      {/* Quick fill chips */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[1, 5, 10, activeStats.balance]
                          .filter((v, i, self) => v > 0 && v <= (activeStats.balance || 999) && self.indexOf(v) === i)
                          .map((val, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setDetailReturnQty(val.toString())}
                              className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono font-medium border border-slate-200 dark:border-slate-700 transition-colors"
                            >
                              +{val} {val === activeStats.balance && activeStats.balance > 0 ? '(All)' : ''}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Optional return notes or inspection remarks..."
                      value={detailReturnNotes}
                      onChange={e => setDetailReturnNotes(e.target.value)}
                      className="depot-input w-full px-3 py-1.5 rounded-lg text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Plus className="w-4 h-4" weight="bold" />
                    <span>Confirm Gate Return & Restock Yard</span>
                  </button>
                </form>
              </div>

              {/* Customer Specific History */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-heading font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-500" />
                    <span>Customer Movement History</span>
                  </h4>
                  <span className="text-xs font-mono text-slate-400">
                    {activeCustomerHistory.length} logs
                  </span>
                </div>

                {activeCustomerHistory.length === 0 ? (
                  <p className="text-xs font-sans text-slate-400 py-4 text-center">
                    No return or transfer records found for {activeCustomer.name}.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {activeCustomerHistory.map(renderGateEventItem)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 text-center text-slate-400 text-sm">
              Select a customer to view container balance and log gate returns.
            </div>
          )}
        </div>
      </div>

      {/* DEPOT GATE RETURNS & FLEET MOVEMENT AUDIT LOG (Full Section) */}
      <div className="p-5 sm:p-6 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 space-y-4 shadow-card-light dark:shadow-card-dark">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Gate Movement History (In & Out)</span>
            </h3>
            <p className="text-xs font-sans text-slate-500 dark:text-slate-400 mt-0.5">
              Physical depot gate returns & inter-customer yard transfers across the entire fleet.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {gateHistoryEvents.length} total movements
          </span>
        </div>

        {gateHistoryEvents.length === 0 ? (
          <p className="text-xs font-sans text-slate-400 py-8 text-center">
            No keg movements logged yet.
          </p>
        ) : (
          <>
            {/* Mobile Truncated Gate History */}
            <div className="split:hidden space-y-2.5">
              {gateHistoryEvents.slice(0, 3).map(renderGateEventItem)}
              {gateHistoryEvents.length > 3 && (
                <button
                  type="button"
                  onClick={() => setIsAllGateHistoryOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 active:scale-98"
                >
                  <span>View full gate history ({gateHistoryEvents.length} movements)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Desktop Full Grid List */}
            <div className="hidden split:grid split:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {gateHistoryEvents.map(renderGateEventItem)}
            </div>
          </>
        )}
      </div>

      {/* MOBILE LOG KEG RETURN BOTTOM SHEET */}
      {selectedCustomerForReturn && (() => {
        const stats = getCustStats(selectedCustomerForReturn.id);
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
                  <span className="text-xs font-sans text-slate-500 block">Supplied</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">{stats.supplied}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-sans text-slate-500 block">Returned</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{stats.returned}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                  <span className="text-xs font-sans text-amber-800 dark:text-amber-300 block">In Custody</span>
                  <span className="text-base font-bold text-amber-700 dark:text-amber-300">{stats.balance}</span>
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
                  <label htmlFor="mobile-return-qty" className="block text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Number of Company Kegs Returning *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="mobile-return-qty"
                      type="number"
                      min="1"
                      max={stats.balance || undefined}
                      required
                      placeholder="e.g. 5"
                      value={currentInput}
                      onChange={e =>
                        setReturnCustomerInputs({
                          ...returnCustomerInputs,
                          [selectedCustomerForReturn.id]: e.target.value
                        })
                      }
                      className="depot-input w-full px-4 py-3 rounded-xl font-mono tabular-nums text-base font-bold"
                    />
                  </div>
                </div>

                {/* Quick Fill Chips */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-sans text-slate-500">Quick fill:</span>
                  {[1, 5, 10, stats.balance].filter(v => v > 0 && v <= stats.balance).map((val, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() =>
                        setReturnCustomerInputs({
                          ...returnCustomerInputs,
                          [selectedCustomerForReturn.id]: val.toString()
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      +{val} {val === stats.balance ? '(All)' : ''}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 mt-2 active:scale-98"
                >
                  <Plus className="w-4 h-4" weight="bold" />
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
