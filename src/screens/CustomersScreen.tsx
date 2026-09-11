import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Customer, CustomerType, PaymentMethod } from '../types';
import { BottomSheet } from '../components/common/BottomSheet';
import { Modal } from '../components/common/Modal';
import { useIsDesktopSplit } from '../hooks/useBreakpoint';
import {
  formatNaira,
  formatDepotDate,
  formatDepotTime,
  buildCustomerStatement,
  toDatetimeLocalValue,
  fromDatetimeLocalValue
} from '../services/businessLogic';
import { CustomerStatementModal } from '../components/common/CustomerStatementModal';
import { packShort } from '../constants/config';
import {
  Users,
  MagnifyingGlass as Search,
  Phone,
  ChatCircle as MessageSquare,
  CreditCard,
  Plus,
  CaretRight as ChevronRight,
  WarningCircle as AlertCircle,
  Receipt,
  ArrowsLeftRight as ArrowRightLeft,
  CheckCircle as CheckCircle2,
  FileText,
  PaperPlaneTilt as Send
} from '@phosphor-icons/react';

type FilterChip = 'all' | 'overdue' | 'high_balance' | 'corporate' | 'agent';

export const CustomersScreen: React.FC = () => {
  const {
    customers,
    customerStatsMap,
    transfers,
    orders,
    payments,
    customerCredits,
    kegReturns,
    settings,
    recordCustomerPayment,
    redeemCustomerCredit,
    logTransfer,
    addCustomer
  } = useStore();

  const [panelTab, setPanelTab] = useState<'overview' | 'ledger'>('overview');
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  const isDesktop = useIsDesktopSplit();

  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');

  // Quick In-Panel Payment State (Desktop Master-Detail)
  const [inlineAmount, setInlineAmount] = useState<string>('');
  const [inlineMethod, setInlineMethod] = useState<PaymentMethod>('transfer');
  const [inlineFeedback, setInlineFeedback] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Mobile Sheet State (<900px)
  const [selectedCustomerForSheet, setSelectedCustomerForSheet] = useState<Customer | null>(null);

  // Payment Recording State
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showPaymentBackdate, setShowPaymentBackdate] = useState(false);
  const [paymentDateInput, setPaymentDateInput] = useState<string>('');

  // New Customer Modal State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustType, setNewCustType] = useState<CustomerType>('agent');
  const [newCustLimit, setNewCustLimit] = useState('150000');
  const [newCustTerms, setNewCustTerms] = useState('14');
  const [newCustPhone, setNewCustPhone] = useState('+234');

  // Inter-Customer Transfer State
  const [transferFromCustomerId, setTransferFromCustomerId] = useState<string | null>(null);
  const [transferToCustomerId, setTransferToCustomerId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<string>('5');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferError, setTransferError] = useState<string | null>(null);

  const handleOpenTransfer = (fromCustomer: Customer) => {
    setTransferFromCustomerId(fromCustomer.id);
    const other = customers.find(c => c.id !== fromCustomer.id);
    setTransferToCustomerId(other ? other.id : '');
    setTransferQty('5');
    setTransferNotes('');
    setTransferError(null);
  };

  const handleRecordTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferFromCustomerId || !transferToCustomerId) return;
    const numQty = parseFloat(transferQty) || 0;
    if (numQty <= 0) {
      setTransferError('Transfer quantity must be greater than zero.');
      return;
    }

    const res = logTransfer({
      fromCustomerId: transferFromCustomerId,
      toCustomerId: transferToCustomerId,
      itemType: 'keg',
      qty: numQty,
      notes: transferNotes.trim() || undefined
    });

    if (res.success) {
      setTransferFromCustomerId(null);
      setTransferQty('5');
      setTransferNotes('');
    } else {
      setTransferError(res.error || 'Failed to record transfer.');
    }
  };


  // Filter & Search customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(cust => {
      const stats = customerStatsMap[cust.id];
      const bal = stats ? stats.currentBalance : 0;
      const isOverdue = stats?.agingBadge.status === 'overdue';

      // 1. Filter Chip
      if (activeFilter === 'overdue' && !isOverdue) return false;
      if (activeFilter === 'high_balance' && bal < 100000) return false;
      if (activeFilter === 'corporate' && cust.type !== 'corporate') return false;
      if (activeFilter === 'agent' && cust.type !== 'agent') return false;

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = cust.name.toLowerCase().includes(q);
        const matchesPhone = cust.phone.toLowerCase().includes(q);
        return matchesName || matchesPhone;
      }

      return true;
    });
  }, [customers, customerStatsMap, activeFilter, searchQuery]);

  // Master-Detail Active Customer Selection
  const activeCustomer = useMemo(() => {
    const found = filteredCustomers.find(c => c.id === selectedCustomerId);
    if (found) return found;
    return filteredCustomers[0] || customers[0] || null;
  }, [filteredCustomers, selectedCustomerId, customers]);

  const activeStats = activeCustomer ? customerStatsMap[activeCustomer.id] : null;
  const activeAging = activeStats?.agingBadge;
  const isActiveOverdue = activeAging?.status === 'overdue';
  const activeTransfers = useMemo(() => {
    if (!activeCustomer) return [];
    return transfers.filter(
      t => t.from_customer_id === activeCustomer.id || t.to_customer_id === activeCustomer.id
    );
  }, [transfers, activeCustomer]);

  const handleInlinePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    const num = parseFloat(inlineAmount);
    if (isNaN(num) || num <= 0) {
      setInlineError('Please enter a valid payment amount.');
      return;
    }
    const res = recordCustomerPayment(activeCustomer.id, num, inlineMethod);
    if (res.success) {
      setInlineAmount('');
      setInlineFeedback(`Payment of ${formatNaira(num)} recorded for ${activeCustomer.name}.`);
      setInlineError(null);
      setTimeout(() => setInlineFeedback(null), 4000);
    } else {
      setInlineError(res.error || 'Failed to record payment.');
    }
  };

  const handleOpenPayment = (customer: Customer, fullBalance: number) => {
    setPaymentCustomerId(customer.id);
    setPaymentAmount(fullBalance > 0 ? fullBalance.toString() : '');
    setPaymentError(null);
    setShowPaymentBackdate(false);
    setPaymentDateInput(toDatetimeLocalValue());
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomerId) return;

    const numericAmount = parseFloat(paymentAmount) || 0;
    if (numericAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    const result = recordCustomerPayment(
      paymentCustomerId,
      numericAmount,
      paymentMethod,
      showPaymentBackdate ? fromDatetimeLocalValue(paymentDateInput) : undefined
    );
    if (result.success) {
      setPaymentCustomerId(null);
      setPaymentAmount('');
    } else {
      setPaymentError(result.error || 'Failed to record payment.');
    }
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    addCustomer({
      name: newCustName.trim(),
      type: newCustType,
      credit_limit: parseFloat(newCustLimit) || 0,
      credit_term_days: parseInt(newCustTerms) || 14,
      phone: newCustPhone.trim()
    });

    setIsAddCustomerOpen(false);
    setNewCustName('');
    setNewCustPhone('+234');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Customers & credit</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            See who owes money, record payments (oldest invoice first), and keg balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              if (customers.length > 0) handleOpenTransfer(customers[0]);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[13px] font-sans font-bold shadow-sm transition-all active:scale-95"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Inter-Customer Transfer</span>
          </button>
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 text-[14px] font-sans font-bold shadow-lg shadow-brand-500/20 transition-all"
          >
            <Plus className="w-[18px] h-[18px] text-slate-950" weight="bold" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All Customers' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'high_balance', label: 'High Balance' },
              { id: 'corporate', label: 'Corporate' },
              { id: 'agent', label: 'Agent' }
            ] as const
          ).map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-sans font-semibold whitespace-nowrap transition-all ${
                activeFilter === chip.id
                  ? 'bg-brand-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search name or phone..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-sans focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Master-Detail Grid (≥900px: List on Left, Persistent Panel on Right; <900px: List + Sheet) */}
      <div className="grid grid-cols-1 split:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: CUSTOMER LIST (split:col-span-7) */}
        <div className="split:col-span-7 space-y-2.5">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[14px] font-sans shadow-sm">
              No customers match the active filters or search term.
            </div>
          ) : (
            filteredCustomers.map(customer => {
              const stats = customerStatsMap[customer.id];
              const isSelected = activeCustomer?.id === customer.id;
              const currentBal = stats ? stats.currentBalance : 0;
              const kegsOut = stats ? stats.totalCompanyKegsOut : 0;
              const aging = stats?.agingBadge;
              const isOverdue = aging?.status === 'overdue';

              const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
              const whatsappText = encodeURIComponent(
                `Hello ${customer.name},\n\nThis is a polite reminder from Iyanuoluwa Depot regarding your outstanding balance of ${formatNaira(
                  currentBal
                )} which is currently overdue.\n\nPlease arrange for payment settlement at your earliest convenience.\n\nThank you!`
              );
              const whatsappUrl = `https://wa.me/${cleanPhone}?text=${whatsappText}`;

              return (
                <div
                  key={customer.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${customer.name}, ${customer.type}, balance ${formatNaira(currentBal)}`}
                  className={`rounded-2xl transition-all overflow-hidden shadow-sm cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
                    isSelected
                      ? 'border-2 border-brand-500 bg-brand-50/30 dark:bg-brand-950/20 ring-1 ring-brand-500/30'
                      : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                  onClick={() => {
                    if (isDesktop) {
                      setSelectedCustomerId(customer.id);
                    } else {
                      setSelectedCustomerForSheet(customer);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (isDesktop) {
                        setSelectedCustomerId(customer.id);
                      } else {
                        setSelectedCustomerForSheet(customer);
                      }
                    }
                  }}
                >
                  {/* Mobile Row (<900px) */}
                  <div className="split:hidden p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 font-extrabold text-[14px] flex-shrink-0">
                          {customer.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-heading font-semibold text-[15px] text-slate-900 dark:text-white truncate">
                            {customer.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {customer.type}
                            </span>
                            {aging && (
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums font-bold border ${aging.colorClass}`}>
                                {aging.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Direct Phone / WhatsApp Call */}
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <a
                          href={`tel:${customer.phone}`}
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                          title="Call Customer"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        {isOverdue && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[12px] font-mono tabular-nums">
                      <div>
                        <span className="text-[11px] font-sans text-slate-500 block">Balance:</span>
                        <span className={`font-bold text-[14px] ${currentBal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatNaira(currentBal)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-sans text-slate-500 block">Kegs Out:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {kegsOut} kegs
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-sans font-bold text-brand-600 dark:text-brand-400 pl-2">
                        <span>Ledger</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Desktop Master Row (≥900px, persistent master-detail selection) */}
                  <div className="hidden split:flex items-center justify-between p-4 gap-4">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-[14px] flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-brand-500 text-slate-950 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      }`}>
                        {customer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-heading font-bold text-[15px] text-slate-900 dark:text-white truncate">
                            {customer.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {customer.type}
                          </span>
                          {aging && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold border ${aging.colorClass}`}>
                              {aging.label}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                          <span className="font-mono">{customer.phone}</span>
                          <span>·</span>
                          <span>Terms: {customer.credit_term_days}d</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0 font-mono tabular-nums">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-sans block">Kegs Out</span>
                        <span className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
                          {kegsOut} kegs
                        </span>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <span className="text-[10px] text-slate-400 uppercase font-sans block">Balance</span>
                        <span className={`text-[15px] font-bold ${currentBal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatNaira(currentBal)}
                        </span>
                      </div>
                      <div className="flex items-center text-slate-400">
                        <ChevronRight className={`w-5 h-5 transition-transform ${isSelected ? 'text-brand-500 translate-x-1' : ''}`} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: PERSISTENT MASTER-DETAIL PANEL (Desktop ≥900px) */}
        <div className="hidden split:block split:col-span-5 space-y-4 sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
          {activeCustomer ? (
            <div className="space-y-4">
              {/* Panel tabs */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                {(['overview', 'ledger'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setPanelTab(t)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-sans font-bold capitalize transition-colors ${
                      panelTab === t
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t === 'ledger' ? 'Ledger / History' : 'Overview'}
                  </button>
                ))}
              </div>

              {panelTab === 'ledger' && (
                <CustomerLedgerPanel
                  rows={buildCustomerStatement(activeCustomer, orders, payments, customerCredits, kegReturns)}
                  balance={activeStats?.currentBalance || 0}
                  kegsOut={activeStats?.totalCompanyKegsOut || 0}
                  onSend={() => setStatementCustomer(activeCustomer)}
                />
              )}

              {panelTab === 'overview' && (<>
              {/* Customer Profile & Financial Summary Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-brand-500 text-slate-950 font-heading font-extrabold text-[16px] flex items-center justify-center flex-shrink-0 shadow-sm">
                      {activeCustomer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-bold text-[18px] text-slate-900 dark:text-white">
                          {activeCustomer.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {activeCustomer.type}
                        </span>
                        {activeAging && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold border ${activeAging.colorClass}`}>
                            {activeAging.label}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span className="font-mono">{activeCustomer.phone}</span>
                        <span>·</span>
                        <span>Credit Limit: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatNaira(activeCustomer.credit_limit)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Call & WhatsApp Quick Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a
                      href={`tel:${activeCustomer.phone}`}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                      title="Direct Call"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    {isActiveOverdue && (
                      <a
                        href={`https://wa.me/${activeCustomer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Hello ${activeCustomer.name}, this is a polite payment reminder from Iyanuoluwa Depot regarding your overdue balance of ${formatNaira(activeStats ? activeStats.currentBalance : 0)}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 transition-colors"
                        title="WhatsApp Reminder"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-3 gap-2 text-[12px] font-mono tabular-nums">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-500 uppercase block">Balance Due</span>
                    <span className={`text-[16px] font-bold ${
                      (activeStats?.currentBalance || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {formatNaira(activeStats?.currentBalance || 0)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-500 uppercase block">Company Kegs</span>
                    <span className="text-[16px] font-bold text-slate-800 dark:text-slate-200">
                      {activeStats?.totalCompanyKegsOut || 0}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-sans text-slate-500 uppercase block">Credit Term</span>
                    <span className="text-[16px] font-bold text-slate-800 dark:text-slate-200">
                      {activeCustomer.credit_term_days} Days
                    </span>
                  </div>
                </div>

                {/* Store credit banner (money the depot owes this customer from overpayments) */}
                {(activeStats?.creditBalance || 0) > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Store credit
                      </div>
                      <div className="text-[16px] font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                        {formatNaira(activeStats?.creditBalance || 0)} in credit
                      </div>
                    </div>
                    {(activeStats?.currentBalance || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const apply = Math.min(activeStats!.creditBalance, activeStats!.currentBalance);
                          const res = redeemCustomerCredit(activeCustomer.id, apply);
                          if (res.success) {
                            setInlineFeedback(`${formatNaira(apply)} store credit applied to ${activeCustomer.name}'s invoices.`);
                            setInlineError(null);
                            setTimeout(() => setInlineFeedback(null), 4000);
                          } else {
                            setInlineError(res.error || 'Could not apply store credit.');
                          }
                        }}
                        className="shrink-0 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-sans font-bold shadow-sm transition-all active:scale-95"
                      >
                        Apply to invoices
                      </button>
                    )}
                  </div>
                )}

                {/* Quick In-Panel Payment Form */}
                <div className="p-4 rounded-xl bg-brand-50/30 dark:bg-brand-950/20 border border-brand-200/80 dark:border-brand-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <span>In-Panel Payment Settlement</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenTransfer(activeCustomer)}
                      className="text-[11px] font-sans font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Transfer Kegs</span>
                    </button>
                  </div>

                  {inlineFeedback && (
                    <div className="p-2.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-[12px] font-sans flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{inlineFeedback}</span>
                    </div>
                  )}

                  {inlineError && (
                    <div className="p-2.5 rounded-lg bg-rose-100/80 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 text-[12px] font-sans flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{inlineError}</span>
                    </div>
                  )}

                  <form onSubmit={handleInlinePaymentSubmit} className="space-y-2.5">
                    {/* Quick Amount Chips */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInlineAmount((activeStats?.currentBalance || 0).toString())}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-300 hover:border-brand-500 font-semibold"
                      >
                        Full Bal ({formatNaira(activeStats?.currentBalance || 0)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineAmount('50000')}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-300 hover:border-brand-500 font-semibold"
                      >
                        ₦50k
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineAmount('100000')}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-300 hover:border-brand-500 font-semibold"
                      >
                        ₦100k
                      </button>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <input
                          type="number"
                          step="100"
                          min="1"
                          value={inlineAmount}
                          onChange={e => setInlineAmount(e.target.value)}
                          placeholder="Amount in ₦"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-[13px] font-mono font-bold focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="col-span-5">
                        <select
                          value={inlineMethod}
                          onChange={e => setInlineMethod(e.target.value as PaymentMethod)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-[12px] font-sans font-semibold focus:outline-none focus:border-brand-500"
                        >
                          <option value="transfer">Transfer</option>
                          <option value="cash">Cash</option>
                          <option value="pos">POS</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1.5"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Confirm & Record Payment</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Open Credit Invoices (FIFO Ledger) */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span>Open Credit Invoices ({activeStats?.openOrders.length || 0})</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Oldest first</span>
                </div>

                {activeStats?.openOrders && activeStats.openOrders.length > 0 ? (
                  <div className="space-y-2">
                    {activeStats.openOrders.map(order => {
                      const remainingDue = order.amount - (order.paid_amount || 0);
                      const isPastDue = order.due_date ? new Date() > new Date(order.due_date) : false;

                      return (
                        <div
                          key={order.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono"
                        >
                          <div className="space-y-0.5">
                            <div className="font-sans font-semibold text-slate-900 dark:text-slate-200">
                              {order.qty} × {packShort(order.pack_size_id)} · {order.product_id === 'veg' ? 'Veg Oil' : 'Palm Oil'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Due: {formatDepotDate(order.due_date)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {formatNaira(remainingDue)}
                            </div>
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-sans font-bold ${
                              isPastDue
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {isPastDue ? 'Overdue' : 'Active'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs font-sans">
                    No outstanding credit invoices for this customer.
                  </div>
                )}
              </div>

              {/* Inter-Customer Transfers for this Customer */}
              {activeTransfers.length > 0 && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Inter-Customer Transfers ({activeTransfers.length})</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeTransfers.map(tr => {
                      const isSender = tr.from_customer_id === activeCustomer.id;
                      const counterparty = isSender
                        ? customers.find(c => c.id === tr.to_customer_id)?.name || tr.to_customer_id
                        : customers.find(c => c.id === tr.from_customer_id)?.name || tr.from_customer_id;

                      return (
                        <div
                          key={tr.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-sans font-semibold text-slate-900 dark:text-slate-200">
                              {isSender ? `Sent to ${counterparty}` : `Received from ${counterparty}`}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {formatDepotDate(tr.date)} · Company Kegs
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            isSender
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          }`}>
                            {isSender ? '-' : '+'}{tr.qty} kegs
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </>)}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
              Select a customer from the left list to view their ledger &amp; history.
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentCustomerId && (
        <Modal
          isOpen
          onClose={() => setPaymentCustomerId(null)}
          title={
            <span className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>Record Credit Settlement</span>
            </span>
          }
        >
          <div className="space-y-5">
            {paymentError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-[12px] font-sans flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              {/* Quick Amount Chips */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Quick Amount Chips</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount('50000')}
                    className="py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200 hover:border-brand-500"
                  >
                    ₦50,000
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount('100000')}
                    className="py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200 hover:border-brand-500"
                  >
                    ₦100,000
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fullBal = customerStatsMap[paymentCustomerId]?.currentBalance || 0;
                      setPaymentAmount(fullBal.toString());
                    }}
                    className="py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums font-bold text-brand-600 dark:text-brand-400 hover:border-brand-500"
                  >
                    Full Balance
                  </button>
                </div>
              </div>

              {/* Manual Amount Input */}
              <div className="space-y-1.5">
                <label htmlFor="payment-amount" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Settlement Amount (₦)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">
                    ₦
                  </span>
                  <input
                    id="payment-amount"
                    type="number"
                    step="100"
                    min="1"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                    placeholder="50000"
                    required
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`py-2.5 rounded-xl border text-[12px] font-sans font-bold transition-all ${
                      paymentMethod === 'transfer'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500 text-emerald-900 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2.5 rounded-xl border text-[12px] font-sans font-bold transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500 text-emerald-900 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-sans text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                The payment clears the oldest unpaid invoices first.
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowPaymentBackdate(v => !v)}
                  className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  {showPaymentBackdate ? 'Using a specific date & time' : 'Not now? Backdate this payment'}
                </button>
                {showPaymentBackdate && (
                  <input
                    type="datetime-local"
                    value={paymentDateInput}
                    onChange={e => setPaymentDateInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[13px]"
                  />
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Receipt className="w-[18px] h-[18px] text-slate-950" />
                <span>Confirm Payment & Print Receipt</span>
              </button>
            </form>
          </div>
        </Modal>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <Modal
          isOpen
          onClose={() => setIsAddCustomerOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>Create Customer Profile</span>
            </span>
          }
        >
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4 text-[12px]">
              <div className="space-y-1">
                <label htmlFor="new-customer-name" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer / Business Name</label>
                <input
                  id="new-customer-name"
                  type="text"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Alhaji Bamidele Oils"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="new-customer-tier" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer Tier</label>
                <select
                  id="new-customer-tier"
                  value={newCustType}
                  onChange={e => setNewCustType(e.target.value as CustomerType)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans font-semibold focus:outline-none focus:border-brand-500 capitalize"
                >
                  <option value="retail">Retail</option>
                  <option value="agent">Agent</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="new-customer-credit-limit" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Credit Limit (₦)</label>
                  <input
                    id="new-customer-credit-limit"
                    type="number"
                    value={newCustLimit}
                    onChange={e => setNewCustLimit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                    placeholder="150000"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-customer-credit-terms" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Credit Terms (Days)</label>
                  <input
                    id="new-customer-credit-terms"
                    type="number"
                    value={newCustTerms}
                    onChange={e => setNewCustTerms(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                    placeholder="14"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="new-customer-phone" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Phone Number (with WhatsApp)</label>
                <input
                  id="new-customer-phone"
                  type="text"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="+2348012345678"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-mono tabular-nums focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] uppercase tracking-wider transition-all"
              >
                Save Customer Profile
              </button>
            </form>
        </Modal>
      )}

      {/* Inter-Customer Transfer Modal */}
      {transferFromCustomerId && (() => {
        const fromCustomer = customers.find(c => c.id === transferFromCustomerId);
        const fromStats = fromCustomer ? customerStatsMap[fromCustomer.id] : null;

        return (
          <Modal
            isOpen
            onClose={() => setTransferFromCustomerId(null)}
            size="lg"
            title={
              <span className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>Inter-Customer / Inter-Agent Transfer</span>
              </span>
            }
          >
            <div className="space-y-5">
              {transferError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-[12px] font-sans flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              {/* Explanatory Protocol Banner */}
              <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-[12px] font-sans text-purple-950 dark:text-purple-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>Direct Customer-to-Customer Handover</span>
                </div>
                <p className="text-[11px] text-purple-800 dark:text-purple-300">
                  Transfers company kegs or bulk product directly between customer accounts. Sender&apos;s ledger decreases, receiver&apos;s ledger increases. Total fleet at depot remains unchanged.
                </p>
              </div>

              <form onSubmit={handleRecordTransferSubmit} className="space-y-4 text-[12px]">
                {/* Sender Account */}
                <div className="space-y-1">
                  <label htmlFor="transfer-from-customer" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Transferring From (Sender)
                  </label>
                  <select
                    id="transfer-from-customer"
                    value={transferFromCustomerId}
                    onChange={e => setTransferFromCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-sans font-semibold text-[14px] focus:outline-none focus:border-purple-500"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({customerStatsMap[c.id]?.totalCompanyKegsOut || 0} kegs out)
                      </option>
                    ))}
                  </select>
                  {fromStats && (
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pt-0.5">
                      Sender current company keg balance: <strong className="text-slate-800 dark:text-slate-200">{fromStats.totalCompanyKegsOut} kegs</strong>
                    </div>
                  )}
                </div>

                {/* Receiver Account */}
                <div className="space-y-1">
                  <label htmlFor="transfer-to-customer" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Transferring To (Receiver)
                  </label>
                  <select
                    id="transfer-to-customer"
                    value={transferToCustomerId}
                    onChange={e => setTransferToCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white font-sans font-semibold text-[14px] focus:outline-none focus:border-purple-500"
                    required
                  >
                    <option value="" disabled>Select receiving customer / agent</option>
                    {customers
                      .filter(c => c.id !== transferFromCustomerId)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type.toUpperCase()}) — {customerStatsMap[c.id]?.totalCompanyKegsOut || 0} kegs out
                        </option>
                      ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <label htmlFor="transfer-qty" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Quantity (Company Kegs)
                  </label>
                  <input
                    id="transfer-qty"
                    type="number"
                    step="1"
                    min="1"
                    value={transferQty}
                    onChange={e => setTransferQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-mono tabular-nums font-bold focus:outline-none focus:border-purple-500"
                    placeholder="5"
                    required
                  />
                </div>

                {/* Transfer Notes */}
                <div className="space-y-1">
                  <label htmlFor="transfer-notes" className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Handover Notes / Reference (Optional)
                  </label>
                  <input
                    id="transfer-notes"
                    type="text"
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                    placeholder="e.g. Authorized yard transfer between agent branches"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-sans font-bold text-[14px] uppercase tracking-wider shadow-md transition-all active:scale-98"
                >
                  Confirm & Log Inter-Customer Transfer
                </button>
              </form>
            </div>
          </Modal>
        );
      })()}

      {/* MOBILE CUSTOMER LEDGER & INVOICES BOTTOM SHEET */}
      {selectedCustomerForSheet && (() => {
        const stats = customerStatsMap[selectedCustomerForSheet.id];
        const currentBal = stats ? stats.currentBalance : 0;
        const kegsOut = stats ? stats.totalCompanyKegsOut : 0;
        const aging = stats?.agingBadge;
        const isOverdue = aging?.status === 'overdue';
        const cleanPhone = selectedCustomerForSheet.phone.replace(/[^0-9]/g, '');
        const whatsappText = encodeURIComponent(
          `Hello ${selectedCustomerForSheet.name},\n\nThis is a reminder from Iyanuoluwa Depot regarding your outstanding balance of ${formatNaira(
            currentBal
          )}.\n\nThank you!`
        );
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${whatsappText}`;

        return (
          <BottomSheet
            isOpen={!!selectedCustomerForSheet}
            onClose={() => setSelectedCustomerForSheet(null)}
            title={selectedCustomerForSheet.name}
            subtitle={`${selectedCustomerForSheet.type.toUpperCase()} · Terms: ${selectedCustomerForSheet.credit_term_days} Days · Limit: ${formatNaira(selectedCustomerForSheet.credit_limit)}`}
          >
            <div className="space-y-4">
              {/* Balances & Limits Grid */}
              <div className="grid grid-cols-2 gap-3 text-[12px] font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-sans text-slate-500 block">Outstanding Balance</span>
                  <span className={`text-[17px] font-bold ${currentBal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatNaira(currentBal)}
                  </span>
                  {aging && (
                    <span className={`inline-block mt-1 px-1.5 py-0.2 rounded-full text-[10px] font-sans font-bold border ${aging.colorClass}`}>
                      {aging.label}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-sans text-slate-500 block">Company Kegs Out</span>
                  <span className="text-[17px] font-bold text-slate-900 dark:text-white">
                    {kegsOut} kegs
                  </span>
                  <span className="text-[11px] font-sans text-slate-500 block mt-1">
                    Limit: {formatNaira(selectedCustomerForSheet.credit_limit)}
                  </span>
                </div>
              </div>

              {/* Store credit (from overpayments) */}
              {(stats?.creditBalance || 0) > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-3 text-[12px]">
                  <span className="font-sans font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatNaira(stats?.creditBalance || 0)} in store credit
                  </span>
                  {currentBal > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const apply = Math.min(stats!.creditBalance, currentBal);
                        redeemCustomerCredit(selectedCustomerForSheet.id, apply);
                        setSelectedCustomerForSheet(null);
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold active:scale-95"
                    >
                      Apply to invoices
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons Strip */}
              <div className="grid grid-cols-2 gap-2 text-[13px] font-sans font-bold">
                <button
                  type="button"
                  onClick={() => {
                    const cust = selectedCustomerForSheet;
                    setSelectedCustomerForSheet(null);
                    handleOpenPayment(cust, currentBal);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Record Payment</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cust = selectedCustomerForSheet;
                    setSelectedCustomerForSheet(null);
                    handleOpenTransfer(cust);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Transfer Stock</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cust = selectedCustomerForSheet;
                    setSelectedCustomerForSheet(null);
                    setStatementCustomer(cust);
                  }}
                  className="col-span-2 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <FileText className="w-4 h-4" />
                  <span>View / send statement</span>
                </button>
              </div>

              {/* Communication Strip */}
              <div className="flex gap-2">
                <a
                  href={`tel:${selectedCustomerForSheet.phone}`}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[12px] font-sans font-semibold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {selectedCustomerForSheet.phone}</span>
                </a>
                {isOverdue && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[12px] font-sans font-semibold flex items-center justify-center gap-1.5 border border-emerald-300 dark:border-emerald-800"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>

              {/* Open Credit Invoices List */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-[12px] font-sans font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <span>Open Invoices ({stats?.openOrders.length || 0})</span>
                  <span className="text-[11px] text-slate-500 font-normal">Oldest first</span>
                </div>

                {stats?.openOrders.length === 0 ? (
                  <p className="text-[12px] font-sans text-slate-400 py-3 text-center">
                    No outstanding credit invoices for this customer.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {stats?.openOrders.map(order => {
                      const remainingDue = order.amount - (order.paid_amount || 0);
                      const dueDate = order.due_date ? new Date(order.due_date) : null;
                      const isPastDue = dueDate ? new Date() > dueDate : false;
                      const isVeg = order.product_id === 'veg';

                      return (
                        <div
                          key={order.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[12px] space-y-1"
                        >
                          <div className="flex items-center justify-between font-sans">
                            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                              />
                              <span>{order.qty} × {packShort(order.pack_size_id)} ({isVeg ? 'Veg Oil' : 'Palm Oil'})</span>
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums font-bold ${
                                isPastDue
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {isPastDue ? 'Overdue' : 'Active'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between font-mono tabular-nums text-slate-600 dark:text-slate-400 text-[11px]">
                            <span>Due: {formatDepotDate(order.due_date)}</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              Balance: {formatNaira(remainingDue)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </BottomSheet>
        );
      })()}

      {statementCustomer && (
        <CustomerStatementModal
          customer={statementCustomer}
          rows={buildCustomerStatement(statementCustomer, orders, payments, customerCredits, kegReturns)}
          balance={customerStatsMap[statementCustomer.id]?.currentBalance || 0}
          kegsOut={customerStatsMap[statementCustomer.id]?.totalCompanyKegsOut || 0}
          company={{ name: settings.company_name, phone: settings.company_phone, address: settings.company_address }}
          onClose={() => setStatementCustomer(null)}
        />
      )}
    </div>
  );
};

const CustomerLedgerPanel: React.FC<{
  rows: import('../types').CustomerStatementRow[];
  balance: number;
  kegsOut: number;
  onSend: () => void;
}> = ({ rows, balance, kegsOut, onSend }) => {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Statement
        </span>
        <button
          onClick={onSend}
          className="text-[11px] font-sans font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1"
        >
          <Send className="w-3.5 h-3.5" /> Send statement
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px] font-mono tabular-nums">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-sans text-slate-500 uppercase block">Balance owed</span>
          <span className={`text-[15px] font-bold ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatNaira(balance)}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-sans text-slate-500 uppercase block">Kegs on loan</span>
          <span className="text-[15px] font-bold text-slate-900 dark:text-white">{kegsOut}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-6 text-center text-[12px] text-slate-400">No history yet.</div>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-[12px] py-1.5 border-b border-slate-100 dark:border-slate-800/70 last:border-0">
              <div className="min-w-0">
                <div className="text-slate-700 dark:text-slate-200 truncate">
                  {r.label}
                  {r.paidStatus && r.kind === 'sale' && (
                    <span
                      className={`ml-1.5 text-[9px] font-sans font-black uppercase px-1 py-0.5 rounded ${
                        r.paidStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : r.paidStatus === 'part'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {r.paidStatus}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {formatDepotDate(r.date)} {formatDepotTime(r.date)}
                  {r.note ? ` · ${r.note}` : ''}
                  {` · ${r.kegBalance} keg(s)`}
                </div>
              </div>
              <div className="text-right shrink-0 font-mono tabular-nums">
                {r.debit > 0 && <div className="text-rose-600 dark:text-rose-400 font-bold">+{formatNaira(r.debit)}</div>}
                {r.credit > 0 && <div className="text-emerald-600 dark:text-emerald-400 font-bold">−{formatNaira(r.credit)}</div>}
                <div className="text-[10px] text-slate-400">bal {formatNaira(r.runningBalance)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
