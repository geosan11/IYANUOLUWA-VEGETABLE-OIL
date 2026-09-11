import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import {
  formatNaira,
  formatDepotTime,
  formatDepotDate,
  getDepotToday,
  depotDateKey,
  toDatetimeLocalValue,
  fromDatetimeLocalValue
} from '../services/businessLogic';
import { EXPENSE_CATEGORIES } from '../constants/config';
import {
  ReceiptText,
  Wallet,
  Plus,
  TrendingDown,
  Edit2,
  Check,
  CheckCircle2,
  DollarSign
} from 'lucide-react';

export const ExpensesScreen: React.FC = () => {
  const { expenses, settings, todayStats, addExpense, updateSettings } = useStore();

  const [category, setCategory] = useState<string>('Diesel/Gen');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [expenseDateInput, setExpenseDateInput] = useState<string>(() => toDatetimeLocalValue());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const currentFloat = settings.default_daily_float ?? settings.daily_float ?? 150000;
  const [isEditingFloat, setIsEditingFloat] = useState(false);
  const [editableFloat, setEditableFloat] = useState(currentFloat.toString());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayStr = getDepotToday();
  const todayExpenses = useMemo(() => {
    return expenses.filter(e => depotDateKey(e.date) === todayStr);
  }, [expenses, todayStr]);

  const handleQuickAddAmount = (addValue: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + addValue).toString());
  };

  const handleSaveFloat = () => {
    const val = parseFloat(editableFloat) || 150000;
    updateSettings({ daily_float: val, default_daily_float: val });
    setIsEditingFloat(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setErrorMsg('Enter an amount greater than zero.');
      return;
    }

    const finalCategory = customCategory.trim() ? customCategory.trim() : category;

    const result = addExpense(finalCategory, numAmount, note.trim() || undefined, fromDatetimeLocalValue(expenseDateInput));
    if (result.success) {
      setSuccessMsg(`Logged expense: ${formatNaira(numAmount)} for ${finalCategory}`);
      setAmount('');
      setNote('');
      setCustomCategory('');
      setExpenseDateInput(toDatetimeLocalValue());
      setShowDatePicker(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(result.error || 'Could not log the expense.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <span>Cash box & expenses</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Track the cash box: what came in, what was spent, and what is left.
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

      {/* Float KPI Summary (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Daily Float Budget (Editable) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cash in the box at start of day
            </span>
            <button
              onClick={() => {
                if (isEditingFloat) {
                  handleSaveFloat();
                } else {
                  setEditableFloat(currentFloat.toString());
                  setIsEditingFloat(true);
                }
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
            >
              {isEditingFloat ? <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" /> : <Edit2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {isEditingFloat ? (
            <div className="flex items-center gap-2 my-1">
              <input
                type="number"
                value={editableFloat}
                onChange={e => setEditableFloat(e.target.value)}
                className="w-36 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-brand-500 text-[18px] font-mono tabular-nums font-bold text-slate-900 dark:text-white focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveFloat}
                className="px-3 py-1.5 rounded-lg bg-brand-500 text-slate-950 text-[12px] font-sans font-bold shadow-sm"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="text-[32px] font-mono tabular-nums font-bold leading-tight text-slate-900 dark:text-slate-100">
              {formatNaira(currentFloat)}
            </div>
          )}

          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-2">
            Cash placed in the box at the start of the day.
          </div>
        </div>

        {/* 2. Today's Total Expenses (Neutral text, never red for routine operations) */}
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

        {/* 3. Net Remaining Cash In Hand */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-sans font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Net Float In Hand
            </span>
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className={`text-[32px] font-mono tabular-nums font-bold leading-tight ${todayStats.dailyFloatRemaining < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatNaira(todayStats.dailyFloatRemaining)}
          </div>
          <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-2">
            Remaining physical petty cash in counter drawer.
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
              {EXPENSE_CATEGORIES.map(cat => (
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
            <div className="grid grid-cols-4 gap-2">
              {[1000, 5000, 10000, 50000].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleQuickAddAmount(val)}
                  className="py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-white transition-colors"
                >
                  +{formatNaira(val)}
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
                type="number"
                step="100"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="25000"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                required
              />
            </div>
          </div>

          {/* Note Field */}
          <div className="space-y-1.5">
            <label htmlFor="expense-note" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Description / Reason
            </label>
            <input
              id="expense-note"
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Fuel for generator, gate security tip"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-sans font-medium focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Backdate (optional) — defaults to now */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowDatePicker(v => !v)}
              className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
            >
              {showDatePicker ? 'Using a specific date & time' : "Not now? Backdate this voucher"}
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
            <Plus className="w-[18px] h-[18px]" />
            <span>Record Expense & Deduct from Float</span>
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
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {todayExpenses.map(exp => (
                <div
                  key={exp.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-heading font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                        {exp.category}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {formatDepotTime(exp.date)}
                      </span>
                    </div>
                    {exp.note && <div className="text-[12px] font-sans text-slate-500 dark:text-slate-400 pl-1">{exp.note}</div>}
                  </div>

                  <div className="text-right font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200 text-[13px]">
                    -{formatNaira(exp.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
