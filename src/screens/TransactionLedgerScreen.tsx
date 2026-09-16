import React, { useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { usePermissions } from '../services/permissions';
import { Modal } from '../components/common/Modal';
import {
  formatNaira,
  formatDepotDate,
  formatDepotTime,
  getDepotToday,
  depotDateKey,
  toDatetimeLocalValue,
  fromDatetimeLocalValue
} from '../services/businessLogic';
import { packShort, PAYMENT_MODE_THEME, getPaymentModeTheme } from '../constants/config';
import { Sale, Order, Payment, Expense, Tank, ReceiptData, ContainerMode, PaymentMethod } from '../types';
import {
  Scroll as ScrollText,
  MagnifyingGlass as Search,
  Printer,
  PlusCircle,
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Pencil,
  Prohibit as Ban,
  ClockCounterClockwise as History,
  CreditCard,
  Money as Banknote,
  Truck,
  ArrowUUpLeft as Undo2,
  CalendarBlank,
  Wallet,
  DeviceMobile,
  Bank
} from '@phosphor-icons/react';

interface Props {
  onNavigate: (tab: string) => void;
}

type Scope = 'shift' | 'today' | 'all' | 'custom';
type Kind = 'sale' | 'payment' | 'expense' | 'intake';
type KindFilter = 'all' | Kind;

const PAYMENT_MODE_META: Record<PaymentMethod, { label: string; Icon: typeof CreditCard; cls: string }> = {
  cash: { label: 'Cash', Icon: Banknote, cls: PAYMENT_MODE_THEME.cash.textCls },
  transfer: { label: 'Transfer', Icon: Bank, cls: PAYMENT_MODE_THEME.transfer.textCls },
  pos: { label: 'POS / Card', Icon: DeviceMobile, cls: PAYMENT_MODE_THEME.pos.textCls },
  credit: { label: 'Debt', Icon: Wallet, cls: PAYMENT_MODE_THEME.credit.textCls }
};

interface TxnRow {
  id: string;
  kind: Kind;
  entityId: string;
  auditIds: string[];
  date: string;
  title: string;
  subtitle: string;
  amount: number;
  amountLabel: string;
  tone: 'in' | 'out' | 'neutral';
  voided: boolean;
  paymentMethod?: PaymentMethod;
  sale?: Sale;
  lines?: Order[];
  payment?: Payment;
  expense?: Expense;
  tank?: Tank;
}

type PaymentModeFilter = 'all' | PaymentMethod;

const PAYMENT_MODE_CHIPS: { id: PaymentModeFilter; label: string }[] = [
  { id: 'all', label: 'All Modes' },
  { id: 'cash', label: 'Cash' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'pos', label: 'Card / POS' },
  { id: 'credit', label: 'Debt' }
];

const KIND_META: Record<Kind, { label: string; Icon: typeof CreditCard; badge: string }> = {
  sale: { label: 'Sale', Icon: Banknote, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  payment: { label: 'Payment', Icon: CreditCard, badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  expense: { label: 'Expense', Icon: Undo2, badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  intake: { label: 'Intake', Icon: Truck, badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' }
};

export const TransactionLedgerScreen: React.FC<Props> = ({ onNavigate }) => {
  const {
    sales,
    orders,
    payments,
    expenses,
    tanks,
    customers,
    products,
    suppliers,
    auditLog,
    customerStatsMap,
    activeShift,
    setActiveReceipt,
    voidSale,
    voidPayment,
    updatePaymentDate,
    updateOrderLine,
    updateExpense,
    voidExpense,
    updateTankIntake
  } = useStore();
  const { isOwner } = usePermissions();

  const [scope, setScope] = useState<Scope>(activeShift ? 'shift' : 'today');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<PaymentModeFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<TxnRow | null>(null);
  const [editTarget, setEditTarget] = useState<TxnRow | null>(null);

  const custName = (id: string) => customers.find(c => c.id === id)?.name || 'Walk-in';
  const prodName = (id: string) => products.find(p => p.id === id)?.name || 'Oil';

  const allRows = useMemo<TxnRow[]>(() => {
    const rows: TxnRow[] = [];

    for (const sale of sales) {
      const lines = orders.filter(o => o.sale_id === sale.id);
      if (lines.length === 0) continue;
      const total = lines.reduce((s, l) => s + l.line_amount, 0);
      const outstanding = lines.reduce((s, l) => s + Math.max(0, l.line_amount - (l.paid_amount || 0)), 0);
      rows.push({
        id: `sale:${sale.id}`,
        kind: 'sale',
        entityId: sale.id,
        auditIds: [sale.id, ...lines.map(l => l.id)],
        date: sale.date,
        title: custName(sale.customer_id),
        subtitle: `${lines.length} item${lines.length === 1 ? '' : 's'} · ${sale.payment_method}${
          sale.payment_method === 'credit' && outstanding > 0.01 ? ` · owes ${formatNaira(outstanding)}` : ''
        }`,
        amount: total,
        amountLabel: formatNaira(total),
        tone: 'in',
        voided: !!sale.voided,
        paymentMethod: sale.payment_method,
        sale,
        lines
      });
    }

    for (const p of payments) {
      rows.push({
        id: `pay:${p.id}`,
        kind: 'payment',
        entityId: p.id,
        auditIds: [p.id],
        date: p.date,
        title: custName(p.customer_id),
        subtitle: p.source === 'credit_redeem' ? 'Store credit applied' : `${p.method} settlement`,
        amount: p.amount,
        amountLabel: formatNaira(p.amount),
        tone: 'in',
        voided: !!p.voided,
        paymentMethod: p.method,
        payment: p
      });
    }

    for (const e of expenses) {
      rows.push({
        id: `exp:${e.id}`,
        kind: 'expense',
        entityId: e.id,
        auditIds: [e.id],
        date: e.date,
        title: e.category,
        subtitle: e.note || '—',
        amount: -e.amount,
        amountLabel: `-${formatNaira(e.amount)}`,
        tone: 'out',
        voided: !!e.voided,
        paymentMethod: 'cash',
        expense: e
      });
    }

    for (const t of tanks) {
      const supplier = suppliers.find(s => s.id === t.supplier_id)?.name;
      rows.push({
        id: `tank:${t.id}`,
        kind: 'intake',
        entityId: t.id,
        auditIds: [t.id],
        date: t.date,
        title: t.truck_label,
        subtitle: `${prodName(t.product_id)}${supplier ? ` · ${supplier}` : ''}`,
        amount: 0,
        amountLabel: `+${t.received_litres.toLocaleString()} L`,
        tone: 'neutral',
        voided: false,
        paymentMethod: undefined,
        tank: t
      });
    }

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, orders, payments, expenses, tanks, customers, products, suppliers]);

  const customFromMs = scope === 'custom' && customFrom ? new Date(fromDatetimeLocalValue(customFrom)).getTime() : null;
  const customToMs = scope === 'custom' && customTo ? new Date(fromDatetimeLocalValue(customTo)).getTime() : null;

  const scopedRows = useMemo(() => {
    const today = getDepotToday();
    return allRows.filter(r => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      if (paymentModeFilter !== 'all' && r.paymentMethod !== paymentModeFilter) return false;
      if (scope === 'today' && depotDateKey(r.date) !== today) return false;
      if (scope === 'shift') {
        if (!activeShift) {
          if (depotDateKey(r.date) !== today) return false;
        } else if (new Date(r.date).getTime() < new Date(activeShift.start_time).getTime()) {
          return false;
        }
      }
      if (scope === 'custom') {
        const t = new Date(r.date).getTime();
        if (customFromMs != null && t < customFromMs) return false;
        if (customToMs != null && t > customToMs) return false;
      }
      const q = search.trim().toLowerCase();
      if (q && !(`${r.title} ${r.subtitle}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allRows, kindFilter, paymentModeFilter, scope, activeShift, search, customFromMs, customToMs]);

  const kpi = useMemo(() => {
    let gross = 0;
    let received = 0;
    let spent = 0;
    for (const r of scopedRows) {
      if (r.voided) continue;
      if (r.kind === 'sale') gross += r.amount;
      if (r.kind === 'payment') received += r.amount;
      if (r.kind === 'expense') spent += -r.amount;
    }
    const creditOwed = Object.values(customerStatsMap).reduce((s, c) => s + c.currentBalance, 0);
    return { gross, received, spent, creditOwed };
  }, [scopedRows, customerStatsMap]);

  // Value moved by payment mode in this window — sale value booked under
  // each method, plus credit settlements collected via that method.
  const paymentModeTotals = useMemo(() => {
    const totals: Record<PaymentMethod, number> = { cash: 0, transfer: 0, pos: 0, credit: 0 };
    for (const r of scopedRows) {
      if (r.voided) continue;
      if (r.kind === 'sale' && r.sale) {
        totals[r.sale.payment_method] += r.amount;
      } else if (r.kind === 'payment' && r.payment) {
        totals[r.payment.method] += r.amount;
      }
    }
    return totals;
  }, [scopedRows]);

  const reprintSale = (sale: Sale, lines: Order[]) => {
    const customer = customers.find(c => c.id === sale.customer_id);
    if (!customer) return;
    const first = lines[0];
    const receipt: ReceiptData = {
      receiptNumber: `REC-${sale.id.replace(/^sale-/, '')}`,
      type: 'order',
      date: sale.date,
      customer,
      sale,
      lines,
      order: first,
      product: products.find(p => p.id === first.product_id),
      packLabel: packShort(first.pack_size_id),
      varietyName: first.variety_name,
      pricingTier: first.pricing_tier,
      amountTendered: sale.amount_tendered ?? null,
      changeDue: sale.change_due ?? null,
      paymentMethod: sale.payment_method,
      previousBalance: 0,
      newBalance: lines.reduce((s, l) => s + Math.max(0, l.line_amount - (l.paid_amount || 0)), 0),
      cashierName: sale.cashier_name || 'Depot Cashier'
    };
    setActiveReceipt(receipt);
  };

  const SCOPES: { id: Scope; label: string }[] = [
    { id: 'shift', label: activeShift ? 'This shift' : 'Today' },
    { id: 'today', label: 'Today' },
    { id: 'all', label: 'All' },
    { id: 'custom', label: 'Custom range' }
  ];
  const KIND_CHIPS: { id: KindFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'sale', label: 'Sales' },
    { id: 'payment', label: 'Payments' },
    { id: 'expense', label: 'Expenses' },
    { id: 'intake', label: 'Intake' }
  ];

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold text-slate-900 dark:text-white leading-tight">Transactions</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Everything in and out, newest first — with date, time and an edit trail.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-sans font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={() => onNavigate('order')}
            className="px-3 py-2 rounded-xl bg-brand-500 text-slate-950 text-xs font-sans font-bold flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" /> New sale
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          ['Gross sales', formatNaira(kpi.gross), 'text-slate-900 dark:text-white'],
          ['Payments in', formatNaira(kpi.received), 'text-sky-600 dark:text-sky-400'],
          ['Expenses', formatNaira(kpi.spent), 'text-rose-600 dark:text-rose-400'],
          ['Debt owed', formatNaira(kpi.creditOwed), 'text-amber-600 dark:text-amber-400']
        ].map(([label, val, cls]) => (
          <div key={label} className="depot-card p-3 rounded-xl">
            <div className="text-xs font-sans uppercase tracking-wider text-slate-500">{label}</div>
            <div className={`text-base font-mono font-extrabold tabular-nums mt-0.5 ${cls}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Payment mode breakdown */}
      <div>
        <div className="text-xs font-sans font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          By payment mode
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(Object.keys(PAYMENT_MODE_META) as PaymentMethod[]).map(method => {
            const { label, Icon } = PAYMENT_MODE_META[method];
            const theme = PAYMENT_MODE_THEME[method];
            return (
              <div
                key={method}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${theme.bgSubtleCls} ${theme.borderCls}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-white/90 dark:bg-slate-900 border ${theme.borderCls} flex items-center justify-center shrink-0 ${theme.textCls} shadow-xs`}>
                  <Icon className="w-4 h-4" weight="bold" />
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-sans font-bold uppercase tracking-wider truncate ${theme.textCls}`}>{label}</div>
                  <div className={`text-sm font-mono font-extrabold tabular-nums ${theme.textCls}`}>
                    {formatNaira(paymentModeTotals[method])}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, category, truck…"
            className="depot-input w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-sans placeholder-slate-400"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SCOPES.map(s => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold border flex items-center gap-1.5 ${
                scope === s.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              {s.id === 'custom' && <CalendarBlank className="w-3.5 h-3.5" weight={scope === 'custom' ? 'bold' : 'thin'} />}
              {s.label}
            </button>
          ))}
          <span className="w-px bg-slate-200 dark:bg-slate-800 mx-1" />
          {KIND_CHIPS.map(k => (
            <button
              key={k.id}
              onClick={() => setKindFilter(k.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold border ${
                kindFilter === k.id
                  ? 'bg-brand-500 text-slate-950 border-brand-500'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              {k.label}
            </button>
          ))}
          <span className="w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:inline-block" />
          {PAYMENT_MODE_CHIPS.map(pm => {
            const isSelected = paymentModeFilter === pm.id;
            const meta = pm.id !== 'all' ? PAYMENT_MODE_META[pm.id] : null;
            const theme = pm.id !== 'all' ? PAYMENT_MODE_THEME[pm.id] : null;
            const Icon = meta?.Icon;
            return (
              <button
                key={pm.id}
                type="button"
                onClick={() => setPaymentModeFilter(pm.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold border flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? theme
                      ? theme.buttonActiveCls
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                    : theme
                    ? `bg-white dark:bg-slate-900 ${theme.textCls} ${theme.borderCls} hover:border-current`
                    : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border-slate-200 dark:border-slate-800'
                }`}
              >
                {theme ? (
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : theme.dotCls} shrink-0`} />
                ) : null}
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" weight={isSelected ? 'bold' : 'regular'} />}
                <span>{pm.label}</span>
              </button>
            );
          })}
        </div>

        {scope === 'custom' && (
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <label className="text-xs font-sans font-semibold text-slate-500">
              From
              <input
                type="datetime-local"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="mt-1 block px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-sans font-semibold text-slate-500">
              To
              <input
                type="datetime-local"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="mt-1 block px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs"
              />
            </label>
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => {
                  setCustomFrom('');
                  setCustomTo('');
                }}
                className="text-xs font-sans font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 pb-2"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feed — a proper column table so rows scan left-to-right */}
      <div className="depot-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-500 font-sans">
              <tr>
                <th className="text-left px-3.5 py-2.5 font-bold whitespace-nowrap">Date &amp; time</th>
                <th className="text-left px-3.5 py-2.5 font-bold whitespace-nowrap">Type</th>
                <th className="text-left px-3.5 py-2.5 font-bold whitespace-nowrap">Mode of Payment</th>
                <th className="text-left px-3.5 py-2.5 font-bold">Description</th>
                <th className="text-right px-3.5 py-2.5 font-bold whitespace-nowrap">Amount</th>
                <th className="text-right px-3.5 py-2.5 font-bold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {scopedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    Nothing in this window.
                  </td>
                </tr>
              )}
              {scopedRows.map(row => {
                const { Icon, badge, label } = KIND_META[row.kind];
                const isOpen = expanded === row.id;
                const showAudit = auditFor === row.id;
                const rowAudits = auditLog.filter(a => row.auditIds.includes(a.entity_id));
                return (
                  <React.Fragment key={row.id}>
                    <tr className={row.voided ? 'opacity-60' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'}>
                      <td className="px-3.5 py-3 align-top whitespace-nowrap font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        <div>{formatDepotDate(row.date)}</div>
                        <div className="text-xs text-slate-400">{formatDepotTime(row.date)}</div>
                      </td>
                      <td className="px-3.5 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${badge}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className={`text-xs font-sans font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge}`}>
                            {label}
                          </span>
                        </div>
                        {row.voided && (
                          <span className="inline-block mt-1 text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            Voided
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 align-top whitespace-nowrap">
                        {row.paymentMethod ? (
                          (() => {
                            const meta = PAYMENT_MODE_META[row.paymentMethod];
                            const theme = getPaymentModeTheme(row.paymentMethod);
                            const Icon = meta?.Icon || CreditCard;
                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans font-bold capitalize border shadow-xs ${theme.badgeCls}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${theme.dotCls} shrink-0`} />
                                <Icon className="w-3.5 h-3.5 shrink-0" weight="bold" />
                                <span>{meta?.label || theme.label}</span>
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 align-top min-w-[180px]">
                        <div className={`text-sm font-sans font-bold text-slate-900 dark:text-white truncate ${row.voided ? 'line-through' : ''}`}>
                          {row.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{row.subtitle}</div>
                      </td>
                      <td className="px-3.5 py-3 align-top text-right whitespace-nowrap">
                        <span
                          className={`text-sm font-mono font-extrabold tabular-nums ${
                            row.voided
                              ? 'text-slate-400 line-through'
                              : row.tone === 'out'
                              ? 'text-rose-600 dark:text-rose-400'
                              : row.tone === 'neutral'
                              ? 'text-slate-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {row.amountLabel}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {(row.kind === 'sale' || row.kind === 'payment') && (
                            <button
                              onClick={() => setExpanded(isOpen ? null : row.id)}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                              className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                                isOpen
                                  ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-800 text-brand-700 dark:text-brand-400'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {isOpen ? <ChevronDown className="w-4 h-4" weight="bold" /> : <ChevronRight className="w-4 h-4" weight="bold" />}
                            </button>
                          )}
                          {rowAudits.length > 0 && (
                            <button
                              onClick={() => setAuditFor(showAudit ? null : row.id)}
                              aria-expanded={showAudit}
                              title="Edit history"
                              className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                                showAudit
                                  ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-800 text-brand-700 dark:text-brand-400'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <History className="w-4 h-4" weight="bold" />
                            </button>
                          )}
                          {row.kind === 'sale' && row.sale && row.lines && !row.voided && (
                            <button
                              onClick={() => reprintSale(row.sale!, row.lines!)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              title="Reprint"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {isOwner && !row.voided && row.kind !== 'intake' && (
                            <button
                              onClick={() => setEditTarget(row)}
                              className="p-1 rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {isOwner && !row.voided && row.kind === 'intake' && (
                            <button
                              onClick={() => setEditTarget(row)}
                              className="p-1 rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                              title="Correct date / details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {isOwner && !row.voided && (row.kind === 'sale' || row.kind === 'payment' || row.kind === 'expense') && (
                            <button
                              onClick={() => setVoidTarget(row)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                              title="Void"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isOpen && row.lines && (
                      <tr>
                        <td colSpan={6} className="px-3.5 pb-3 bg-slate-50/60 dark:bg-slate-950/40">
                          <div className="space-y-1.5 pt-2">
                            {row.lines.map(l => (
                              <div key={l.id} className="flex items-center justify-between text-xs font-sans">
                                <span className="text-slate-600 dark:text-slate-300 truncate">
                                  {l.qty} × {packShort(l.pack_size_id)} · {prodName(l.product_id)} / {l.variety_name}
                                  {l.container_mode === 'taken' && ' · keg taken'}
                                  {l.container_mode === 'bought' && ' · keg bought'}
                                  {l.price_adjusted && ` · adj: ${l.price_adjust_reason || 'price changed'}`}
                                </span>
                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 shrink-0 ml-2">
                                  {formatNaira(l.line_amount)}
                                </span>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setExpanded(null)}
                              className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-sans font-bold transition-all active:scale-95"
                            >
                              <ChevronDown className="w-3 h-3" weight="bold" />
                              <span>Collapse</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isOpen && row.kind === 'payment' && row.payment && (
                      <tr>
                        <td colSpan={6} className="px-3.5 pb-3 bg-slate-50/60 dark:bg-slate-950/40">
                          <div className="space-y-1.5 pt-2">
                            <div className="text-xs font-sans font-bold uppercase tracking-wider text-slate-400">
                              Applied to
                            </div>
                            {row.payment.applied_to.length === 0 && row.payment.overpayment_to_credit <= 0 && (
                              <div className="text-xs text-slate-400">Nothing on record for this payment.</div>
                            )}
                            {row.payment.applied_to.map(a => {
                              const line = orders.find(o => o.id === a.order_id);
                              return (
                                <div key={a.order_id} className="flex items-center justify-between text-xs font-sans">
                                  <span className="text-slate-600 dark:text-slate-300 truncate">
                                    {line
                                      ? `${line.qty} × ${packShort(line.pack_size_id)} · ${prodName(line.product_id)} / ${line.variety_name}`
                                      : `Sale line ${a.order_id}`}
                                  </span>
                                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 shrink-0 ml-2">
                                    {formatNaira(a.amount)}
                                  </span>
                                </div>
                              );
                            })}
                            {row.payment.overpayment_to_credit > 0 && (
                              <div className="flex items-center justify-between text-xs font-sans text-emerald-700 dark:text-emerald-400">
                                <span>Overpayment → store credit</span>
                                <span className="font-mono font-semibold shrink-0 ml-2">
                                  {formatNaira(row.payment.overpayment_to_credit)}
                                </span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpanded(null)}
                              className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-sans font-bold transition-all active:scale-95"
                            >
                              <ChevronDown className="w-3 h-3" weight="bold" />
                              <span>Collapse</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {showAudit && (
                      <tr>
                        <td colSpan={6} className="px-3.5 pb-3 bg-slate-50/60 dark:bg-slate-950/40">
                          <div className="space-y-1.5 pt-2">
                            <div className="text-xs font-sans font-bold uppercase tracking-wider text-slate-400">Edit history</div>
                            {rowAudits.map(a => (
                              <div key={a.id} className="text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold capitalize text-slate-700 dark:text-slate-300">{a.action}</span>
                                {' · '}
                                {formatDepotDate(a.at)} {formatDepotTime(a.at)} · {a.actor_name || a.actor_role}
                                {a.reason ? ` · “${a.reason}”` : ''}
                                {a.changes.length > 0 && (
                                  <div className="pl-3 text-xs font-mono text-slate-400">
                                    {a.changes.map((c, i) => (
                                      <div key={i}>
                                        {c.field}: {String(c.old)} → {String(c.new)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setAuditFor(null)}
                              className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-sans font-bold transition-all active:scale-95"
                            >
                              <ChevronDown className="w-3 h-3" weight="bold" />
                              <span>Collapse</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {voidTarget && (
        <VoidModal
          row={voidTarget}
          onClose={() => setVoidTarget(null)}
          onConfirm={reason => {
            const r =
              voidTarget.kind === 'sale'
                ? voidSale(voidTarget.entityId, reason)
                : voidTarget.kind === 'payment'
                ? voidPayment(voidTarget.entityId, reason)
                : voidExpense(voidTarget.entityId, reason);
            return r;
          }}
        />
      )}

      {editTarget && (
        <EditModal
          row={editTarget}
          suppliers={suppliers}
          onClose={() => setEditTarget(null)}
          onSaveLine={(lineId, patch, reason) => updateOrderLine(lineId, patch, reason)}
          onSaveExpense={(id, patch, reason) => updateExpense(id, patch, reason)}
          onSaveIntake={(id, patch, reason) => updateTankIntake(id, patch, reason)}
          onSavePaymentDate={(id, date, reason) => updatePaymentDate(id, date, reason)}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */

const VoidModal: React.FC<{
  row: TxnRow;
  onClose: () => void;
  onConfirm: (reason: string) => { success: boolean; error?: string };
}> = ({ row, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal isOpen onClose={onClose} title={<span className="flex items-center gap-2"><Ban className="w-4 h-4 text-rose-500" /> Void {KIND_META[row.kind].label.toLowerCase()}</span>}>
      <div className="space-y-3">
        <p className="text-xs font-sans text-slate-600 dark:text-slate-300">
          <b>{row.title}</b> · {row.amountLabel} · {formatDepotDate(row.date)}. Voiding removes it from every balance and
          restores stock. It stays visible with an audit note.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Reason (required)"
          className="depot-input w-full px-3 py-2 rounded-xl text-sm font-sans placeholder-slate-400"
        />
        {err && <div className="text-xs text-rose-600 dark:text-rose-400">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-sans font-semibold">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!reason.trim()) return setErr('A reason is required.');
              const res = onConfirm(reason.trim());
              if (res.success) onClose();
              else setErr(res.error || 'Could not void.');
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-sans font-bold"
          >
            Void it
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */

const EditModal: React.FC<{
  row: TxnRow;
  suppliers: { id: string; name: string }[];
  onClose: () => void;
  onSaveLine: (
    lineId: string,
    patch: { qty?: number; unitPrice?: number; containerMode?: ContainerMode; date?: string },
    reason: string
  ) => { success: boolean; error?: string };
  onSaveExpense: (
    id: string,
    patch: { category?: string; amount?: number; note?: string; date?: string },
    reason: string
  ) => { success: boolean; error?: string };
  onSaveIntake: (
    id: string,
    patch: { date?: string; truck_label?: string; supplier_id?: string | null; space_note?: string },
    reason: string
  ) => { success: boolean; error?: string };
  onSavePaymentDate: (id: string, date: string, reason: string) => { success: boolean; error?: string };
}> = ({ row, suppliers, onClose, onSaveLine, onSaveExpense, onSaveIntake, onSavePaymentDate }) => {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // sale: edit the first line (Phase 3 covers single-line edits inline; multi-line lands later)
  const line = row.lines?.[0];
  const [qty, setQty] = useState(line ? String(line.qty) : '');
  const [unitPrice, setUnitPrice] = useState(line ? String(line.unit_price) : '');
  const [containerMode, setContainerMode] = useState<ContainerMode>(line?.container_mode || 'none');

  const [expCategory, setExpCategory] = useState(row.expense?.category || '');
  const [expAmount, setExpAmount] = useState(row.expense ? String(row.expense.amount) : '');
  const [expNote, setExpNote] = useState(row.expense?.note || '');

  const [tkLabel, setTkLabel] = useState(row.tank?.truck_label || '');
  const [tkSupplier, setTkSupplier] = useState(row.tank?.supplier_id || '');
  const [tkNote, setTkNote] = useState(row.tank?.space_note || '');

  const [dateStr, setDateStr] = useState(toDatetimeLocalValue(row.date));

  const submit = () => {
    if (!reason.trim()) return setErr('A reason is required.');
    const isoDate = fromDatetimeLocalValue(dateStr);
    let res: { success: boolean; error?: string };
    if (row.kind === 'sale' && line) {
      res = onSaveLine(
        line.id,
        {
          qty: Number(qty) || line.qty,
          unitPrice: Number(unitPrice) || undefined,
          containerMode,
          date: isoDate
        },
        reason.trim()
      );
    } else if (row.kind === 'expense' && row.expense) {
      res = onSaveExpense(
        row.expense.id,
        { category: expCategory.trim(), amount: Number(expAmount) || undefined, note: expNote, date: isoDate },
        reason.trim()
      );
    } else if (row.kind === 'intake' && row.tank) {
      res = onSaveIntake(
        row.tank.id,
        { truck_label: tkLabel.trim(), supplier_id: tkSupplier || null, space_note: tkNote, date: isoDate },
        reason.trim()
      );
    } else if (row.kind === 'payment' && row.payment) {
      res = onSavePaymentDate(row.payment.id, isoDate, reason.trim());
    } else {
      res = { success: false, error: 'Nothing to edit' };
    }
    if (res.success) onClose();
    else setErr(res.error || 'Could not save.');
  };

  const field = 'depot-input w-full px-3 py-2 rounded-xl text-sm font-sans placeholder-slate-400';

  return (
    <Modal isOpen onClose={onClose} title={<span className="flex items-center gap-2"><Pencil className="w-4 h-4 text-brand-500" /> Edit {KIND_META[row.kind].label.toLowerCase()}</span>}>
      <div className="space-y-3">
        {row.kind === 'sale' && !line && (
          <p className="text-xs font-sans text-rose-600 dark:text-rose-400">This sale has no editable line.</p>
        )}

        {row.kind === 'sale' && line && (
          <>
            {row.lines && row.lines.length > 1 && (
              <p className="text-xs font-sans text-amber-600 dark:text-amber-400">
                Multi-line sale — editing the first line ({packShort(line.pack_size_id)}). Void &amp; re-enter for bigger changes.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-sans font-semibold text-slate-500">
                Packs
                <input type="number" min={0} step={1} value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ''))} className={field} />
              </label>
              <label className="text-xs font-sans font-semibold text-slate-500">
                Unit price (₦)
                <input type="number" min={0} step={1} value={unitPrice} onChange={e => setUnitPrice(e.target.value.replace(/[^0-9]/g, ''))} className={field} />
              </label>
            </div>
            {line.returnable && (
              <div className="flex gap-1.5">
                {(['taken', 'bought', 'none'] as ContainerMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setContainerMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold border capitalize ${
                      containerMode === m
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {row.kind === 'expense' && (
          <>
            <label className="text-xs font-sans font-semibold text-slate-500 block">
              Category
              <input value={expCategory} onChange={e => setExpCategory(e.target.value)} className={field} />
            </label>
            <label className="text-xs font-sans font-semibold text-slate-500 block">
              Amount (₦)
              <input type="number" min={0} step={1} value={expAmount} onChange={e => setExpAmount(e.target.value.replace(/[^0-9]/g, ''))} className={field} />
            </label>
            <label className="text-xs font-sans font-semibold text-slate-500 block">
              Note
              <input value={expNote} onChange={e => setExpNote(e.target.value)} className={field} />
            </label>
          </>
        )}

        {row.kind === 'intake' && (
          <>
            <label className="text-xs font-sans font-semibold text-slate-500 block">
              Truck / label
              <input value={tkLabel} onChange={e => setTkLabel(e.target.value)} className={field} />
            </label>
            <label className="text-xs font-sans font-semibold text-slate-500 block">
              Supplier
              <select value={tkSupplier} onChange={e => setTkSupplier(e.target.value)} className={field}>
                <option value="">—</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-sans font-semibold text-slate-500 block">
              Note
              <input value={tkNote} onChange={e => setTkNote(e.target.value)} className={field} />
            </label>
          </>
        )}

        {row.kind === 'payment' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Only the recorded date &amp; time can be corrected here — to change the amount, void this payment and record it again.
          </p>
        )}

        <label className="text-xs font-sans font-semibold text-slate-500 block">
          Date &amp; time
          <input type="datetime-local" value={dateStr} onChange={e => setDateStr(e.target.value)} className={field} />
        </label>

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder="Reason for this change (required)"
          className={field}
        />
        {err && <div className="text-xs text-rose-600 dark:text-rose-400">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-sans font-semibold">
            Cancel
          </button>
          <button onClick={submit} className="px-4 py-2 rounded-xl bg-brand-500 text-slate-950 text-xs font-sans font-bold">
            Save change
          </button>
        </div>
      </div>
    </Modal>
  );
};
