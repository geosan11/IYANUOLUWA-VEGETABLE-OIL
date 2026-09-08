import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { Customer, CustomerType, PaymentMethod } from '../types';
import { formatNaira, formatDepotDate } from '../services/businessLogic';
import {
  Users,
  Search,
  Phone,
  MessageSquare,
  CreditCard,
  Plus,
  ChevronDown,
  ChevronUp,
  Package,
  AlertCircle,
  Receipt
} from 'lucide-react';

type FilterChip = 'all' | 'overdue' | 'high_balance' | 'corporate' | 'agent';

export const CustomersScreen: React.FC = () => {
  const {
    customers,
    customerStatsMap,
    recordCustomerPayment,
    addCustomer
  } = useStore();

  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Payment Recording State
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // New Customer Modal State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustType, setNewCustType] = useState<CustomerType>('agent');
  const [newCustLimit, setNewCustLimit] = useState('150000');
  const [newCustTerms, setNewCustTerms] = useState('14');
  const [newCustPhone, setNewCustPhone] = useState('+234');

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

  const toggleExpand = (id: string) => {
    setExpandedCustomerId(prev => (prev === id ? null : id));
  };

  const handleOpenPayment = (customer: Customer, fullBalance: number) => {
    setPaymentCustomerId(customer.id);
    setPaymentAmount(fullBalance > 0 ? fullBalance.toString() : '');
    setPaymentError(null);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomerId) return;

    const numericAmount = parseFloat(paymentAmount) || 0;
    if (numericAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    const result = recordCustomerPayment(paymentCustomerId, numericAmount, paymentMethod);
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
            <span>Customer Accounts & Aging Invoices</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Real aging invoice tracking, FIFO credit payments, and customer keg ledger balances.
          </p>
        </div>

        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-95 text-slate-950 text-[14px] font-sans font-bold shadow-lg shadow-brand-500/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-[18px] h-[18px] text-slate-950" />
          <span>Add New Customer</span>
        </button>
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

      {/* Customer List / Table Cards (Desktop-First) */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[14px] font-sans shadow-sm">
            No customers match the active filters or search term.
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const stats = customerStatsMap[customer.id];
            const isExpanded = expandedCustomerId === customer.id;
            const currentBal = stats ? stats.currentBalance : 0;
            const kegsOut = stats ? stats.totalCompanyKegsOut : 0;
            const aging = stats?.agingBadge;
            const isOverdue = aging?.status === 'overdue';

            // Pre-filled WhatsApp message for manual tap
            const whatsappText = encodeURIComponent(
              `Hello ${customer.name},\n\nThis is a polite reminder from Iyanuoluwa Vegetable & Palm Oil Depot. You have an outstanding balance of ${formatNaira(
                currentBal
              )} which is currently overdue.\n\nPlease arrange for payment settlement via bank transfer at your earliest convenience.\n\nThank you!`
            );
            const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=${whatsappText}`;

            return (
              <div
                key={customer.id}
                className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all overflow-hidden shadow-sm"
              >
                {/* Main Card Header / Summary Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Customer Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 font-extrabold text-[14px] flex-shrink-0">
                      {customer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-semibold text-[16px] text-slate-900 dark:text-white">{customer.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-sans font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {customer.type}
                        </span>
                        {aging && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-bold border ${aging.colorClass}`}
                          >
                            {aging.label}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        <span>Phone: <span className="font-mono tabular-nums">{customer.phone}</span></span>
                        <span>·</span>
                        <span>Credit Limit: <span className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">{formatNaira(customer.credit_limit)}</span></span>
                        <span>·</span>
                        <span>Terms: <span className="font-mono tabular-nums">{customer.credit_term_days} Days</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Balance, Kegs, and Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 dark:border-slate-800">
                    {/* Company Kegs in custody */}
                    <div className="text-left lg:text-right font-mono tabular-nums">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block uppercase font-sans">Kegs Out:</span>
                      <span className="text-[14px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Package className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span>{kegsOut} kegs</span>
                      </span>
                    </div>

                    {/* Computed Current Balance */}
                    <div className="text-left lg:text-right font-mono tabular-nums min-w-[120px]">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block uppercase font-sans">Outstanding:</span>
                      <span
                        className={`text-[16px] font-bold ${
                          currentBal > 0
                            ? currentBal > customer.credit_limit
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatNaira(currentBal)}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Call Button */}
                      <a
                        href={`tel:${customer.phone}`}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                        title="Call Customer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      {/* WhatsApp Reminder Button (SHOWN ONLY WHEN OVERDUE) */}
                      {isOverdue && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 text-[12px] font-sans font-bold transition-all shadow-sm"
                          title="Send WhatsApp Reminder"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>
                      )}

                      {/* Record Payment Button */}
                      <button
                        onClick={() => handleOpenPayment(customer, currentBal)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[12px] font-sans font-bold transition-all active:scale-95 shadow-sm"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay</span>
                      </button>

                      {/* Accordion expand toggle */}
                      <button
                        onClick={() => toggleExpand(customer.id)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        title="View Open Invoices"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Section: Open Credit Invoices Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      <span>Open Credit Orders / Aging Invoices ({stats?.openOrders.length || 0})</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        Settled via FIFO (Oldest Due Date First)
                      </span>
                    </div>

                    {stats?.openOrders.length === 0 ? (
                      <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 py-2">
                        No outstanding credit invoices for this customer.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px] font-mono tabular-nums text-left">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-sans uppercase">
                              <th className="py-2 px-2">Order Date</th>
                              <th className="py-2 px-2">Due Date</th>
                              <th className="py-2 px-2">Product / Qty</th>
                              <th className="py-2 px-2 text-right">Amount</th>
                              <th className="py-2 px-2 text-right">Paid</th>
                              <th className="py-2 px-2 text-right">Balance Due</th>
                              <th className="py-2 px-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                            {stats?.openOrders.map(order => {
                              const remainingDue = order.amount - (order.paid_amount || 0);
                              const dueDate = order.due_date ? new Date(order.due_date) : null;
                              const isPastDue = dueDate ? new Date() > dueDate : false;

                              return (
                                <tr key={order.id} className="hover:bg-slate-100 dark:hover:bg-slate-900/60">
                                  <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">
                                    {formatDepotDate(order.date)}
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-700 dark:text-slate-300">
                                    {formatDepotDate(order.due_date)}
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-900 dark:text-slate-200 font-sans font-medium">
                                    {order.qty} {order.unit}s ({order.product_id === 'veg' ? 'Veg Oil' : 'Palm Oil'})
                                  </td>
                                  <td className="py-2.5 px-2 text-right text-slate-700 dark:text-slate-300 font-medium">
                                    {formatNaira(order.amount)}
                                  </td>
                                  <td className="py-2.5 px-2 text-right text-emerald-600 dark:text-emerald-400">
                                    {formatNaira(order.paid_amount || 0)}
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">
                                    {formatNaira(remainingDue)}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    {isPastDue ? (
                                      <span className="px-1.5 py-0.5 rounded text-[11px] font-sans font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                                        Overdue
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[11px] font-sans bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        Active
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <span>Record Credit Settlement</span>
              </h3>
              <button
                onClick={() => setPaymentCustomerId(null)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-[12px] font-sans font-semibold"
              >
                Cancel
              </button>
            </div>

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
                <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Settlement Amount (₦)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">
                    ₦
                  </span>
                  <input
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
                Payment will be automatically credited to the customer's oldest open invoices first (FIFO).
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
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <span>Create Customer Profile</span>
              </h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-[12px] font-sans font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-4 text-[12px]">
              <div className="space-y-1">
                <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer / Business Name</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Alhaji Bamidele Oils"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer Tier</label>
                <select
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
                  <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Credit Limit (₦)</label>
                  <input
                    type="number"
                    value={newCustLimit}
                    onChange={e => setNewCustLimit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                    placeholder="150000"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Credit Terms (Days)</label>
                  <input
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
                <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Phone Number (with WhatsApp)</label>
                <input
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
          </div>
        </div>
      )}
    </div>
  );
};
