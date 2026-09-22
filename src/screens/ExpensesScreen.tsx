import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { useToast } from '../services/toast';
import {
  formatNaira,
  formatDepotTime,
  formatDepotDate,
  getDepotToday,
  depotDateKey,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  formatWithCommas,
  parseFromCommas
} from '../services/businessLogic';
import {
  Invoice as ReceiptText,
  Plus,
  TrendDown as TrendingDown,
  CheckCircle as CheckCircle2,
  CurrencyDollar as DollarSign,
  ClockCounterClockwise,
  UserCheck,
  Users
} from '@phosphor-icons/react';
import { ONE_TIME_CUSTOMER_ID } from '../constants/config';

export const ExpensesScreen: React.FC = () => {
  const { expenses, todayStats, addExpense, customers, currentUser, customerStatsMap } = useStore();
  const { showToast } = useToast();

  const [category, setCategory] = useState<string>('Diesel/Fuel');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [expenseDateInput, setExpenseDateInput] = useState<string>(() => toDatetimeLocalValue());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [staffInCharge, setStaffInCharge] = useState<string>(() => currentUser?.full_name || 'Counter Staff');
  const [chargeToCustomer, setChargeToCustomer] = useState(false);
  const [chargedCustomerId, setChargedCustomerId] = useState<string>('');
  const [debtReason, setDebtReason] = useState<string>('');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const eligibleCustomers = useMemo(() => {
    return customers.filter(c => c.id !== ONE_TIME_CUSTOMER_ID);
  }, [customers]);

  const todayStr = getDepotToday();
  const todayExpenses = useMemo(() => {
    return expenses.filter(e => depotDateKey(e.date) === todayStr);
  }, [expenses, todayStr]);

  const handleQuickAddAmount = (addValue: number) => {
    const current = parseFromCommas(amount);
    setAmount(formatWithCommas(current + addValue));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const numAmount = parseFromCommas(amount);
    if (numAmount <= 0) {
      setErrorMsg('Enter an amount greater than zero.');
      showToast('error', 'Enter an amount greater than zero.');
      return;
    }

    if (chargeToCustomer && !chargedCustomerId) {
      setErrorMsg('Please select a customer to charge this debt to.');
      showToast('error', 'Please select a customer to charge this debt to.');
      return;
    }

    const finalCategory = customCategory.trim() ? customCategory.trim() : category;
    const targetCust = customers.find(c => c.id === chargedCustomerId);

    const result = addExpense(
      finalCategory,
      numAmount,
      note.trim() || undefined,
      fromDatetimeLocalValue(expenseDateInput),
      {
        recordedBy: staffInCharge.trim() || currentUser?.full_name || 'Staff',
        chargeToCustomerId: chargeToCustomer && chargedCustomerId ? chargedCustomerId : undefined,
        debtReason: debtReason.trim() || undefined
      }
    );

    if (result.success) {
      const chargeText = chargeToCustomer && targetCust ? ` · Debited to ${targetCust.name}'s debt` : '';
      const okMsg = `Logged voucher: ${formatNaira(numAmount)} for ${finalCategory}${chargeText}`;
      setSuccessMsg(okMsg);
      showToast('success', okMsg);
      setAmount('');
      setNote('');
      setCustomCategory('');
      setChargeToCustomer(false);
      setChargedCustomerId('');
      setDebtReason('');
      setExpenseDateInput(toDatetimeLocalValue());
      setShowDatePicker(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      const errMsg = result.error || 'Could not log the expense.';
      setErrorMsg(errMsg);
      showToast('error', errMsg);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <span>Expenses</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Log and track what the depot spends each day.
          </p>
        </div>
      </div>

      {successMsg && (
        <div role="status" aria-live="polite" className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[12px] font-sans font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" aria-live="assertive" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-[12px] font-sans font-semibold flex items-center gap-2 animate-in fade-in">
          <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Today's Expenses Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Spent Today
            </span>
            <TrendingDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="text-[32px] font-mono tabular-nums font-bold leading-tight text-slate-900 dark:text-slate-100">
            {formatNaira(todayStats.expensesToday)}
          </div>
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-2">
            <span className="font-mono tabular-nums font-semibold">{todayExpenses.length}</span> payments recorded today.
          </div>
        </div>
      </div>

      {/* Main 2-Column: Expense Entry Form & Today's Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Expense Logger Form (lg:col-span-6) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>Log Depot Expense Voucher</span>
            </h3>
          </div>

          {/* Category Quick-Select Chips */}
          <div className="space-y-2">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Expense Category
            </label>
            <div className="flex flex-wrap gap-2">
              {['Diesel/Fuel', 'Transport & Logistics', 'Depot Maintenance', 'Demurrage', 'Security & Wages', 'Utility / Power', 'Other'].map(cat => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setCustomCategory('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[13px] font-sans transition-all ${
                    category === cat && !customCategory
                      ? 'bg-brand-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Custom Category Input */}
            <input
              type="text"
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              placeholder="Or type custom category..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-sans font-medium focus:outline-none focus:border-brand-500 mt-2"
            />
          </div>

          {/* Quick-Add Amount Chips */}
          <div className="space-y-2">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Quick Increment Chips
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { val: 2000, label: '+₦2k' },
                { val: 5000, label: '+₦5k' },
                { val: 10000, label: '+₦10k' },
                { val: 20000, label: '+₦20k' },
                { val: 50000, label: '+₦50k' }
              ].map(chip => (
                <button
                  type="button"
                  key={chip.val}
                  onClick={() => handleQuickAddAmount(chip.val)}
                  className="py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-white transition-colors text-center"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Field */}
          <div className="space-y-1.5">
            <label htmlFor="expense-amount" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Voucher Amount (₦)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                ₦
              </span>
              <input
                id="expense-amount"
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(formatWithCommas(e.target.value))}
                placeholder="25,000"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                required
              />
            </div>
          </div>

          {/* Staff In Charge */}
          <div className="space-y-1.5">
            <label htmlFor="staff-in-charge" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Staff In Charge / Authorized By</span>
            </label>
            <input
              id="staff-in-charge"
              type="text"
              value={staffInCharge}
              onChange={e => setStaffInCharge(e.target.value)}
              placeholder="e.g. Counter Staff, Store Manager"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-sans font-medium focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Description / Note Field */}
          <div className="space-y-1.5">
            <label htmlFor="expense-note" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Description / Voucher Reason
            </label>
            <input
              id="expense-note"
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Fuel for generator, gate security tip, offloading surcharge"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-sans font-medium focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Charge to Customer Debt Option */}
          <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={chargeToCustomer}
                onChange={e => setChargeToCustomer(e.target.checked)}
                className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-[13px] font-sans font-bold text-amber-900 dark:text-amber-300">
                  Charge to Customer Account (Add as Customer Debt)
                </span>
                <p className="text-[11px] font-sans text-amber-700/80 dark:text-amber-400/80">
                  Use for customer-incurred expenses such as offloading fees, demurrage, or direct logistic advances.
                </p>
              </div>
            </label>

            {chargeToCustomer && (
              <div className="space-y-3 pt-2 border-t border-amber-500/20">
                <div>
                  <label className="text-[11px] font-sans font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    <span>Select Debtor Customer:</span>
                  </label>
                  <select
                    value={chargedCustomerId}
                    onChange={e => setChargedCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-amber-500/30 text-slate-900 dark:text-slate-100 text-[13px] font-sans font-medium focus:outline-none focus:border-amber-500"
                    required={chargeToCustomer}
                  >
                    <option value="">-- Choose registered customer --</option>
                    {eligibleCustomers.map(c => {
                      const currDebt = customerStatsMap[c.id]?.currentBalance || 0;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone || 'No phone'}) — Curr Debt: {formatNaira(currDebt)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {chargedCustomerId && (
                  <div className="text-[11px] font-sans text-amber-800 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-xl">
                    {(() => {
                      const sel = customers.find(c => c.id === chargedCustomerId);
                      if (!sel) return null;
                      const added = parseFloat(amount) || 0;
                      const currDebt = customerStatsMap[sel.id]?.currentBalance || 0;
                      const newBal = currDebt + added;
                      return (
                        <span>
                          <strong>{sel.name}</strong> will be billed <strong>{formatNaira(added)}</strong>. New total debt: <strong>{formatNaira(newBal)}</strong>.
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Backdate (optional) — defaults to now */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowDatePicker(v => !v)}
              aria-pressed={showDatePicker}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-sans font-bold transition-all active:scale-95 ${
                showDatePicker
                  ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-800 text-brand-700 dark:text-brand-400'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <ClockCounterClockwise className="w-3.5 h-3.5" weight="bold" />
              <span>{showDatePicker ? 'Using a specific date & time' : 'Backdate this voucher'}</span>
            </button>
            {showDatePicker && (
              <input
                type="datetime-local"
                value={expenseDateInput}
                onChange={e => setExpenseDateInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-mono focus:outline-none focus:border-brand-500"
              />
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-[18px] h-[18px]" weight="bold" />
            <span>Record Expense</span>
          </button>
        </form>

        {/* Right: Today's Itemized List (lg:col-span-6) */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                <span>Today's Itemized Expense Ledger</span>
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {formatDepotDate(new Date().toISOString())}
              </p>
            </div>
            <span className="text-[13px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
              Total: {formatNaira(todayStats.expensesToday)}
            </span>
          </div>

          {todayExpenses.length === 0 ? (
            <p className="text-[12px] font-sans text-slate-400 dark:text-slate-500 py-8 text-center">
              No expenses recorded yet today.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {todayExpenses.map(exp => {
                const debtor = exp.customer_id ? customers.find(c => c.id === exp.customer_id) : null;
                return (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-start justify-between text-xs gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-heading font-semibold text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                          {exp.category}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {formatDepotTime(exp.date)}
                        </span>
                        {exp.recorded_by && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-sans flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {exp.recorded_by}
                          </span>
                        )}
                      </div>
                      {exp.note && <div className="text-[12px] font-sans text-slate-600 dark:text-slate-400 pl-1">{exp.note}</div>}
                      {debtor && (
                        <div className="text-[11px] font-sans font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md inline-block">
                          Debt debited to {debtor.name}
                        </div>
                      )}
                    </div>

                    <div className="text-right font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200 text-[13px] flex-shrink-0">
                      -{formatNaira(exp.amount)}
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
