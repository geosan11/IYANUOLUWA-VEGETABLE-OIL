import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { BottomSheet } from '../components/common/BottomSheet';
import { useIsDesktopSplit } from '../hooks/useBreakpoint';
import {
  formatNaira,
  formatDepotDate,
  formatDepotTime,
  getDepotToday,
  depotDateKey
} from '../services/businessLogic';
import { Order, PaymentMethod } from '../types';
import {
  ScrollText,
  Search,
  Printer,
  PlusCircle,
  MessageSquare,
  Droplet,
  CreditCard,
  Banknote,
  Fuel,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

interface Props {
  onNavigate: (tab: string) => void;
}

type Scope = 'shift' | 'today' | 'all';

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
  pos: 'Card / POS',
  credit: 'Credit'
};

const slipNo = (o: Order) => o.id.replace(/^ord-/, '');
const outstanding = (o: Order) => Math.max(0, o.amount - (o.paid_amount || 0));

export const TransactionLedgerScreen: React.FC<Props> = ({ onNavigate }) => {
  const { orders, customers, products, pumps, tanks, settings, activeShift, setActiveReceipt } = useStore();
  const isDesktop = useIsDesktopSplit();

  const [scope, setScope] = useState<Scope>(activeShift ? 'shift' : 'today');
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'credit'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOrder, setSheetOrder] = useState<Order | null>(null);

  const lookup = useMemo(
    () => ({
      cust: (id: string) => customers.find(c => c.id === id),
      prod: (id: string) => products.find(p => p.id === id),
      pump: (id: string | null) => (id ? pumps.find(p => p.id === id) : undefined)
    }),
    [customers, products, pumps]
  );

  // FIFO tank provenance for a slip: multi-entry when the sale spanned 2+ tanks,
  // else the single primary tank (kept as a one-line label).
  const tankSources = (o: Order): { label: string; litres: number }[] => {
    const allocs =
      o.tank_allocations && o.tank_allocations.length
        ? o.tank_allocations
        : o.source_tank_id
        ? [{ tank_id: o.source_tank_id, litres: o.litres }]
        : [];
    return allocs.map(a => ({
      label: tanks.find(t => t.id === a.tank_id)?.truck_label || a.tank_id,
      litres: a.litres
    }));
  };

  // 1. Scope the orders
  const scoped = useMemo(() => {
    const today = getDepotToday();
    return orders.filter(o => {
      if (scope === 'all') return true;
      if (scope === 'today') return depotDateKey(o.date) === today;
      // shift
      if (!activeShift) return depotDateKey(o.date) === today;
      return new Date(o.date).getTime() >= new Date(activeShift.start_time).getTime();
    });
  }, [orders, scope, activeShift]);

  // 2. Filter + search
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped
      .filter(o => {
        if (productFilter !== 'all' && o.product_id !== productFilter) return false;
        if (statusFilter === 'paid' && (o.payment_method === 'credit' && outstanding(o) > 0.01)) return false;
        if (statusFilter === 'credit' && !(o.payment_method === 'credit' && outstanding(o) > 0.01)) return false;
        if (!q) return true;
        const c = lookup.cust(o.customer_id);
        const p = lookup.prod(o.product_id);
        return (
          slipNo(o).toLowerCase().includes(q) ||
          (c?.name || '').toLowerCase().includes(q) ||
          (p?.name || '').toLowerCase().includes(q) ||
          (o.variety_name || '').toLowerCase().includes(q) ||
          (o.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [scoped, productFilter, statusFilter, search, lookup]);

  // 3. KPIs over the scoped set
  const kpi = useMemo(() => {
    let gross = 0,
      settled = 0,
      creditOutstanding = 0,
      litres = 0;
    const perProduct: Record<string, number> = {};
    scoped.forEach(o => {
      gross += o.amount;
      litres += o.litres;
      perProduct[o.product_id] = (perProduct[o.product_id] || 0) + o.litres;
      if (o.payment_method === 'credit') creditOutstanding += outstanding(o);
      else settled += o.paid_amount || 0;
    });
    return { gross, settled, creditOutstanding, litres, perProduct, count: scoped.length };
  }, [scoped]);

  const selected = rows.find(o => o.id === selectedId) || rows[0] || null;

  const reprint = (o: Order) => {
    const customer = lookup.cust(o.customer_id);
    if (!customer) return;
    setActiveReceipt({
      receiptNumber: `REC-${slipNo(o)}`,
      type: 'order',
      date: o.date,
      customer,
      order: o,
      product: lookup.prod(o.product_id),
      pumpLabel: lookup.pump(o.pump_id)?.label,
      kegPrice: o.keg_price ?? null,
      kegAmount: o.keg_amount ?? null,
      discountReason: o.discount_reason ?? null,
      varietyName: o.variety_name ?? null,
      pricingTier: o.pricing_tier ?? null,
      paymentMethod: o.payment_method,
      // Reprint copy — balances shown "as of now", not at time of sale.
      previousBalance: 0,
      newBalance: o.payment_method === 'credit' ? outstanding(o) : 0,
      cashierName: activeShift?.cashier_name || 'Depot Cashier'
    });
  };

  const whatsappHref = (o: Order) => {
    const c = lookup.cust(o.customer_id);
    const phone = (c?.phone || '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `${settings.company_name}\nSlip #${slipNo(o)} · ${formatDepotDate(o.date)} ${formatDepotTime(o.date)}\n` +
        `${lookup.prod(o.product_id)?.name || 'Oil'} — ${o.litres.toLocaleString()} L\n` +
        `Total: ${formatNaira(o.amount)} · ${PAYMENT_LABEL[o.payment_method]}` +
        (o.payment_method === 'credit' && outstanding(o) > 0 ? `\nOutstanding: ${formatNaira(outstanding(o))}` : '')
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  const statusFor = (o: Order) => {
    if (o.payment_method === 'credit' && outstanding(o) > 0.01) {
      return { label: `Credit · ${outstanding(o) < o.amount ? 'part-paid' : 'unpaid'}`, tone: 'amber' as const };
    }
    return { label: `Paid · ${PAYMENT_LABEL[o.payment_method]}`, tone: 'emerald' as const };
  };

  const openRow = (o: Order) => {
    if (isDesktop) setSelectedId(o.id);
    else setSheetOrder(o);
  };

  const scopeLabel = scope === 'shift' ? 'This shift' : scope === 'today' ? 'Today' : 'All time';

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[22px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>Sales log</span>
          </h2>
          <p className="text-[13px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Every dispense slip — search, reprint, or resend by WhatsApp.
            {activeShift?.cashier_name && ` · Shift: ${activeShift.cashier_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[13px] font-sans font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print list</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('order')}
            className="h-11 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[13px] font-sans font-bold flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New sale</span>
          </button>
        </div>
      </div>

      {/* Scope toggle */}
      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 text-[12px] font-sans font-bold">
        {(['shift', 'today', 'all'] as Scope[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            disabled={s === 'shift' && !activeShift}
            className={`px-3.5 py-1.5 rounded-lg capitalize transition-all disabled:opacity-40 ${
              scope === s ? 'bg-brand-500 text-slate-950 shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {s === 'shift' ? 'This shift' : s === 'today' ? 'Today' : 'All time'}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label={`Gross sales (${scopeLabel})`} value={formatNaira(kpi.gross)} icon={Banknote} sub={`${kpi.count} sale${kpi.count === 1 ? '' : 's'}`}>
          {kpi.gross > 0 && (
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex mt-2">
              <div className="h-full bg-brand-500" style={{ width: `${(kpi.settled / kpi.gross) * 100}%` }} title="Settled" />
              <div className="h-full bg-amber-400" style={{ width: `${(kpi.creditOutstanding / kpi.gross) * 100}%` }} title="Credit outstanding" />
            </div>
          )}
        </KpiCard>

        <KpiCard label="Money in (cash / transfer / card)" value={formatNaira(kpi.settled)} icon={CheckCircle2} tone="emerald" sub={kpi.gross > 0 ? `${Math.round((kpi.settled / kpi.gross) * 100)}% collected` : '—'} />

        <KpiCard label="Credit still owed" value={formatNaira(kpi.creditOutstanding)} icon={CreditCard} tone={kpi.creditOutstanding > 0 ? 'amber' : 'slate'} sub={kpi.creditOutstanding > 0 ? 'From credit sales in view' : 'Nothing outstanding'} />

        <KpiCard label="Oil dispensed" value={`${kpi.litres.toLocaleString()} L`} icon={Droplet} sub={`≈ ${Math.round(kpi.litres / (settings.litres_per_keg || 30))} kegs`}>
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(kpi.perProduct).map(([pid, l]) => (
              <span key={pid} className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {lookup.prod(pid)?.name?.split(' ')[0] || pid}: {l.toLocaleString()}L
              </span>
            ))}
          </div>
        </KpiCard>
      </div>

      {/* Search + filters */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search slip #, customer, product, note…"
            className="w-full h-12 pl-10 pr-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-sans text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill active={productFilter === 'all'} onClick={() => setProductFilter('all')}>All ({scoped.length})</Pill>
          {products.map(p => {
            const n = scoped.filter(o => o.product_id === p.id).length;
            return (
              <Pill key={p.id} active={productFilter === p.id} onClick={() => setProductFilter(p.id)}>
                {p.name.split(' ')[0]} ({n})
              </Pill>
            );
          })}
          <Pill active={statusFilter === 'paid'} onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')} tone="emerald">
            Paid
          </Pill>
          <Pill active={statusFilter === 'credit'} onClick={() => setStatusFilter(statusFilter === 'credit' ? 'all' : 'credit')} tone="amber">
            Credit owed
          </Pill>
        </div>
      </div>

      {/* Grid: list + inspector */}
      <div className="grid grid-cols-1 split:grid-cols-3 gap-5 items-start">
        <div className="split:col-span-2 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[13px] font-heading font-semibold text-slate-900 dark:text-white">Dispense slips</span>
            <span className="text-[11px] font-sans text-slate-500">{rows.length} shown</span>
          </div>

          {rows.length === 0 ? (
            <div className="p-10 text-center text-[13px] font-sans text-slate-500 dark:text-slate-400">
              No sales match this view.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden split:block overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Slip / time</th>
                      <th className="px-4 py-2.5">Customer</th>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5 text-right">Volume</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
                    {rows.map(o => {
                      const c = lookup.cust(o.customer_id);
                      const p = lookup.prod(o.product_id);
                      const st = statusFor(o);
                      const isSel = selected?.id === o.id;
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedId(o.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedId(o.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSel}
                          aria-label={`Slip ${slipNo(o)}, ${lookup.cust(o.customer_id)?.name || 'walk-in'}, ${formatNaira(o.amount)}`}
                          className={`cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${isSel ? 'bg-brand-50/60 dark:bg-brand-950/25' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                        >
                          <td className="px-4 py-3 align-top">
                            <div className="font-bold text-brand-700 dark:text-brand-400">#{slipNo(o)}</div>
                            <div className="text-[11px] text-slate-500 font-sans">{formatDepotTime(o.date)}</div>
                            {o.pump_id && (
                              <div className="text-[10px] text-slate-400 font-sans uppercase mt-0.5 flex items-center gap-0.5">
                                <Fuel className="w-3 h-3" />
                                {lookup.pump(o.pump_id)?.label}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top font-sans">
                            <div className="font-bold text-slate-900 dark:text-white">{c?.name || 'Walk-in'}</div>
                            <span className="inline-block mt-0.5 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {(o.pricing_tier || c?.type || 'retail')} tier
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.product_id === 'veg' ? '#F59E0B' : '#EF4444' }} />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{p?.name}</span>
                            </div>
                            {o.variety_name && <div className="text-[11px] text-slate-500">{o.variety_name}</div>}
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <div className="font-bold text-slate-900 dark:text-white">{o.litres.toLocaleString()} L</div>
                            <div className="text-[11px] text-slate-500 font-sans">{o.qty} {o.unit}{o.qty === 1 ? '' : 's'}</div>
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <div className="font-bold text-slate-900 dark:text-white">{formatNaira(o.amount)}</div>
                            <span className={`inline-block mt-0.5 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded ${
                              st.tone === 'emerald'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              <button type="button" onClick={() => reprint(o)} title="Reprint slip" className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700">
                                <Printer className="w-4 h-4" />
                              </button>
                              <a href={whatsappHref(o)} target="_blank" rel="noopener noreferrer" title="Send by WhatsApp" className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                                <MessageSquare className="w-4 h-4" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="split:hidden divide-y divide-slate-100 dark:divide-slate-800/70">
                {rows.map(o => {
                  const c = lookup.cust(o.customer_id);
                  const p = lookup.prod(o.product_id);
                  const st = statusFor(o);
                  return (
                    <button key={o.id} type="button" onClick={() => openRow(o)} className="w-full text-left p-4 flex items-center gap-3 active:bg-slate-50 dark:active:bg-slate-800/40">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-700 dark:text-brand-400 text-[13px]">#{slipNo(o)}</span>
                          <span className="text-[11px] text-slate-500">{formatDepotTime(o.date)}</span>
                        </div>
                        <div className="font-heading font-semibold text-[14px] text-slate-900 dark:text-white truncate">{c?.name || 'Walk-in'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: o.product_id === 'veg' ? '#F59E0B' : '#EF4444' }} />
                          {p?.name} · {o.litres.toLocaleString()} L
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-[14px]">{formatNaira(o.amount)}</div>
                        <span className={`text-[10px] font-bold ${st.tone === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`}>{st.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Inspector (desktop) */}
        <div className="hidden split:block split:col-span-1 split:sticky split:top-4">
          {selected ? (
            <SlipInspector
              order={selected}
              customerName={lookup.cust(selected.customer_id)?.name || 'Walk-in'}
              productName={lookup.prod(selected.product_id)?.name || ''}
              pumpLabel={lookup.pump(selected.pump_id)?.label}
              sources={tankSources(selected)}
              cashier={activeShift?.cashier_name || 'Counter'}
              companyName={settings.company_name}
              status={statusFor(selected)}
              onPrint={() => reprint(selected)}
              whatsappHref={whatsappHref(selected)}
            />
          ) : (
            <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-8 text-center text-[13px] text-slate-500">
              Select a slip to inspect it.
            </div>
          )}
        </div>
      </div>

      {/* Inspector (mobile sheet) */}
      {sheetOrder && (
        <BottomSheet
          isOpen={!!sheetOrder}
          onClose={() => setSheetOrder(null)}
          title={`Slip #${slipNo(sheetOrder)}`}
          subtitle={`${lookup.cust(sheetOrder.customer_id)?.name || 'Walk-in'} · ${formatDepotDate(sheetOrder.date)}`}
        >
          <SlipInspector
            order={sheetOrder}
            customerName={lookup.cust(sheetOrder.customer_id)?.name || 'Walk-in'}
            productName={lookup.prod(sheetOrder.product_id)?.name || ''}
            pumpLabel={lookup.pump(sheetOrder.pump_id)?.label}
            sources={tankSources(sheetOrder)}
            cashier={activeShift?.cashier_name || 'Counter'}
            companyName={settings.company_name}
            status={statusFor(sheetOrder)}
            bare
            onPrint={() => { reprint(sheetOrder); setSheetOrder(null); }}
            whatsappHref={whatsappHref(sheetOrder)}
          />
        </BottomSheet>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const KpiCard: React.FC<{
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
  tone?: 'slate' | 'emerald' | 'amber';
  children?: React.ReactNode;
}> = ({ label, value, icon: Icon, sub, tone = 'slate', children }) => {
  const valueColor =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white';
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
        <span className="text-[11px] font-sans font-medium uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4" />
      </div>
      <div className={`text-[24px] font-mono tabular-nums font-bold leading-tight mt-1.5 ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
      {children}
    </div>
  );
};

const Pill: React.FC<{ active: boolean; onClick: () => void; tone?: 'brand' | 'emerald' | 'amber'; children: React.ReactNode }> = ({
  active,
  onClick,
  tone = 'brand',
  children
}) => {
  const activeCls =
    tone === 'emerald' ? 'bg-emerald-500 text-white' : tone === 'amber' ? 'bg-amber-500 text-slate-950' : 'bg-brand-500 text-slate-950';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-lg text-[12px] font-sans font-bold whitespace-nowrap transition-all ${
        active ? `${activeCls} shadow-sm` : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
};

const SlipInspector: React.FC<{
  order: Order;
  customerName: string;
  productName: string;
  pumpLabel?: string;
  sources?: { label: string; litres: number }[];
  cashier: string;
  companyName: string;
  status: { label: string; tone: 'emerald' | 'amber' };
  bare?: boolean;
  onPrint: () => void;
  whatsappHref: string;
}> = ({ order: o, customerName, productName, pumpLabel, sources = [], cashier, companyName, status, bare, onPrint, whatsappHref }) => {
  const oilAmount = o.amount - (o.keg_amount || 0);
  const body = (
    <>
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <span className="text-[13px] font-heading font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <ScrollText className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Slip inspector
        </span>
        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded ${
          status.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
        }`}>
          {status.label}
        </span>
      </div>

      <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono tabular-nums text-[12px] text-slate-800 dark:text-slate-200">
        <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-slate-700">
          <div className="font-heading font-black text-[13px] text-slate-900 dark:text-white">{companyName}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Slip #{slipNo(o)} · {formatDepotDate(o.date)} {formatDepotTime(o.date)}</div>
        </div>
        <div className="py-2 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1">
          <Row k="Customer" v={customerName} />
          <Row k="Price tier" v={(o.pricing_tier || 'retail') as string} cap />
          {pumpLabel && <Row k="Pump" v={pumpLabel} />}
          {sources.length === 1 && <Row k="Source" v={sources[0].label} />}
          {sources.length > 1 && (
            <div className="flex justify-between gap-3">
              <span className="font-sans text-slate-500 dark:text-slate-400 shrink-0">Source</span>
              <span className="font-bold text-slate-900 dark:text-white text-right">
                {sources.map(s => `${s.label} × ${s.litres.toLocaleString()} L`).join(', ')}
              </span>
            </div>
          )}
          <Row k="Cashier" v={cashier} />
        </div>
        <div className="py-2 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1">
          <div className="flex justify-between font-bold">
            <span className="font-sans">{productName}{o.variety_name ? ` — ${o.variety_name}` : ''}</span>
            <span>{formatNaira(oilAmount)}</span>
          </div>
          <div className="text-[10px] text-slate-500">{o.litres.toLocaleString()} L @ ₦{o.rate.toLocaleString()}/L · {o.qty} {o.unit}{o.qty === 1 ? '' : 's'}</div>
          {o.keg_source === 'purchased' && o.keg_amount ? (
            <div className="flex justify-between text-amber-700 dark:text-amber-400">
              <span className="font-sans">Kegs bought outright</span>
              <span>+{formatNaira(o.keg_amount)}</span>
            </div>
          ) : null}
        </div>
        <div className="pt-2 space-y-0.5">
          <div className="flex justify-between font-bold text-[14px] text-slate-900 dark:text-white">
            <span className="font-sans">Total</span>
            <span>{formatNaira(o.amount)}</span>
          </div>
          <Row k="Paid" v={formatNaira(o.paid_amount || 0)} />
          {o.payment_method === 'credit' && outstanding(o) > 0 && <Row k="Outstanding" v={formatNaira(outstanding(o))} />}
          {o.due_date && <Row k="Due" v={formatDepotDate(o.due_date)} />}
        </div>
        {o.note && <div className="mt-2 text-[10px] text-slate-500 font-sans">Note: {o.note}</div>}
      </div>

      {o.meter_reading != null && (
        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-sans text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
          <span>
            Meter read {Number(o.meter_reading).toLocaleString()} L
            {o.meter_variance != null && ` · variance ${o.meter_variance > 0 ? '+' : ''}${o.meter_variance} L`}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <button type="button" onClick={onPrint} className="h-12 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]">
          <Printer className="w-5 h-5" /> Reprint slip
        </button>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-sans font-bold text-[13px] flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700">
          <MessageSquare className="w-4 h-4 text-emerald-600" /> Send by WhatsApp
        </a>
      </div>
    </>
  );

  if (bare) return <div>{body}</div>;
  return <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm p-4">{body}</div>;
};

const Row: React.FC<{ k: string; v: string; cap?: boolean }> = ({ k, v, cap }) => (
  <div className="flex justify-between">
    <span className="font-sans text-slate-500 dark:text-slate-400">{k}</span>
    <span className={`font-bold text-slate-900 dark:text-white ${cap ? 'capitalize' : ''}`}>{v}</span>
  </div>
);
