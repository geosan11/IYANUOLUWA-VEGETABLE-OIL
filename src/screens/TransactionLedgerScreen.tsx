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
import { packShort } from '../constants/config';
import { Sale, Order, Payment, Expense, Tank, ReceiptData, ContainerMode } from '../types';
import {
  ScrollText,
  Search,
  Printer,
  PlusCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Ban,
  History,
  CreditCard,
  Banknote,
  Truck,
  Undo2
} from 'lucide-react';

interface Props {
  onNavigate: (tab: string) => void;
}

type Scope = 'shift' | 'today' | 'all';
type Kind = 'sale' | 'payment' | 'expense' | 'intake';
type KindFilter = 'all' | Kind;

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
  sale?: Sale;
  lines?: Order[];
  payment?: Payment;
  expense?: Expense;
  tank?: Tank;
}

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
        tank: t
      });
    }

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, orders, payments, expenses, tanks, customers, products, suppliers]);

  const scopedRows = useMemo(() => {
    const today = getDepotToday();
    return allRows.filter(r => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      if (scope === 'today' && depotDateKey(r.date) !== today) return false;
      if (scope === 'shift') {
        if (!activeShift) {
          if (depotDateKey(r.date) !== today) return false;
        } else if (new Date(r.date).getTime() < new Date(activeShift.start_time).getTime()) {
          return false;
        }
      }
      const q = search.trim().toLowerCase();
      if (q && !(`${r.title} ${r.subtitle}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allRows, kindFilter, scope, activeShift, search]);

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
    { id: 'all', label: 'All' }
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
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Everything in and out, newest first — with date, time and an edit trail.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[12px] font-sans font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={() => onNavigate('order')}
            className="px-3 py-2 rounded-xl bg-brand-500 text-slate-950 text-[12px] font-sans font-bold flex items-center gap-1.5"
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
          ['Credit owed', formatNaira(kpi.creditOwed), 'text-amber-600 dark:text-amber-400']
        ].map(([label, val, cls]) => (
          <div key={label} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-sans uppercase tracking-wider text-slate-500">{label}</div>
            <div className={`text-[15px] font-mono font-extrabold tabular-nums mt-0.5 ${cls}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, category, truck…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SCOPES.map(s => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-sans font-semibold border ${
                scope === s.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
          <span className="w-px bg-slate-200 dark:bg-slate-800 mx-1" />
          {KIND_CHIPS.map(k => (
            <button
              key={k.id}
              onClick={() => setKindFilter(k.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-sans font-semibold border ${
                kindFilter === k.id
                  ? 'bg-brand-500 text-slate-950 border-brand-500'
                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-2">
        {scopedRows.length === 0 && (
          <div className="py-12 text-center text-[13px] text-slate-400">Nothing in this window.</div>
        )}
        {scopedRows.map(row => {
          const { Icon, badge, label } = KIND_META[row.kind];
          const isOpen = expanded === row.id;
          const showAudit = auditFor === row.id;
          const rowAudits = auditLog.filter(a => row.auditIds.includes(a.entity_id));
          return (
            <div
              key={row.id}
              className={`rounded-2xl border bg-white dark:bg-slate-900 ${
                row.voided ? 'border-slate-200 dark:border-slate-800 opacity-60' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="p-3.5 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${badge}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-sans font-bold text-slate-900 dark:text-white truncate ${row.voided ? 'line-through' : ''}`}>
                      {row.title}
                    </span>
                    <span className={`text-[9px] font-sans font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${badge}`}>{label}</span>
                    {row.voided && (
                      <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        Voided
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{row.subtitle}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {formatDepotDate(row.date)} · {formatDepotTime(row.date)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-[14px] font-mono font-extrabold tabular-nums ${
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
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {row.kind === 'sale' && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : row.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label="Expand"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                    {rowAudits.length > 0 && (
                      <button
                        onClick={() => setAuditFor(showAudit ? null : row.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Edit history"
                      >
                        <History className="w-4 h-4" />
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
                </div>
              </div>

              {isOpen && row.lines && (
                <div className="px-3.5 pb-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
                  {row.lines.map(l => (
                    <div key={l.id} className="flex items-center justify-between text-[12px]">
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
                </div>
              )}

              {showAudit && (
                <div className="px-3.5 pb-3 border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1.5">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">Edit history</div>
                  {rowAudits.map(a => (
                    <div key={a.id} className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold capitalize text-slate-700 dark:text-slate-300">{a.action}</span>
                      {' · '}
                      {formatDepotDate(a.at)} {formatDepotTime(a.at)} · {a.actor_name || a.actor_role}
                      {a.reason ? ` · “${a.reason}”` : ''}
                      {a.changes.length > 0 && (
                        <div className="pl-3 text-[10px] font-mono text-slate-400">
                          {a.changes.map((c, i) => (
                            <div key={i}>
                              {c.field}: {String(c.old)} → {String(c.new)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
        <p className="text-[13px] text-slate-600 dark:text-slate-300">
          <b>{row.title}</b> · {row.amountLabel} · {formatDepotDate(row.date)}. Voiding removes it from every balance and
          restores stock. It stays visible with an audit note.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Reason (required)"
          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
        />
        {err && <div className="text-[12px] text-rose-600 dark:text-rose-400">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[13px] font-sans font-semibold">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!reason.trim()) return setErr('A reason is required.');
              const res = onConfirm(reason.trim());
              if (res.success) onClose();
              else setErr(res.error || 'Could not void.');
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-sans font-bold"
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

  const field = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]';

  return (
    <Modal isOpen onClose={onClose} title={<span className="flex items-center gap-2"><Pencil className="w-4 h-4 text-brand-500" /> Edit {KIND_META[row.kind].label.toLowerCase()}</span>}>
      <div className="space-y-3">
        {row.kind === 'sale' && !line && (
          <p className="text-[13px] text-rose-600 dark:text-rose-400">This sale has no editable line.</p>
        )}

        {row.kind === 'sale' && line && (
          <>
            {row.lines && row.lines.length > 1 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Multi-line sale — editing the first line ({packShort(line.pack_size_id)}). Void &amp; re-enter for bigger changes.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-sans font-semibold text-slate-500">
                Packs
                <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} className={field} />
              </label>
              <label className="text-[11px] font-sans font-semibold text-slate-500">
                Unit price (₦)
                <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className={field} />
              </label>
            </div>
            {line.returnable && (
              <div className="flex gap-1.5">
                {(['taken', 'bought', 'none'] as ContainerMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setContainerMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-sans font-bold border capitalize ${
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
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Category
              <input value={expCategory} onChange={e => setExpCategory(e.target.value)} className={field} />
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Amount (₦)
              <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} className={field} />
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Note
              <input value={expNote} onChange={e => setExpNote(e.target.value)} className={field} />
            </label>
          </>
        )}

        {row.kind === 'intake' && (
          <>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Truck / label
              <input value={tkLabel} onChange={e => setTkLabel(e.target.value)} className={field} />
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
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
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Note
              <input value={tkNote} onChange={e => setTkNote(e.target.value)} className={field} />
            </label>
          </>
        )}

        {row.kind === 'payment' && (
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Only the recorded date &amp; time can be corrected here — to change the amount, void this payment and record it again.
          </p>
        )}

        <label className="text-[11px] font-sans font-semibold text-slate-500 block">
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
        {err && <div className="text-[12px] text-rose-600 dark:text-rose-400">{err}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[13px] font-sans font-semibold">
            Cancel
          </button>
          <button onClick={submit} className="px-4 py-2 rounded-xl bg-brand-500 text-slate-950 text-[13px] font-sans font-bold">
            Save change
          </button>
        </div>
      </div>
    </Modal>
  );
};
