import React, { useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { usePermissions } from '../services/permissions';
import {
  formatNaira,
  formatDepotDate,
  formatDepotTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue
} from '../services/businessLogic';
import { priceSaleLine } from '../services/pricing';
import { PACK_SIZES, packLabel, packShort, getPaymentModeTheme } from '../constants/config';
import { ContainerMode, CustomerType, PaymentMethod, ReceiptData } from '../types';
import { Modal } from '../components/common/Modal';
import {
  MagnifyingGlass as Search,
  Minus,
  Plus,
  Trash as Trash2,
  X,
  ShieldWarning as ShieldAlert,
  Check,
  CaretRight as ChevronRight,
  ClockCounterClockwise,
  ArrowLeft,
  Printer,
  ArrowSquareOut,
  GasPump,
  Coins,
  UserCheck,
  ArrowsCounterClockwise
} from '@phosphor-icons/react';

/** Small numbered step marker for section headers, echoing a terminal-style flow. */
const StepBadge: React.FC<{ n: number; label: string }> = ({ n, label }) => (
  <div className="flex items-center gap-2">
    <span className="w-5 h-5 rounded bg-brand-500/20 text-brand-700 dark:text-brand-400 font-mono tabular-nums font-bold text-xs flex items-center justify-center shrink-0">
      {n}
    </span>
    <span className="text-xs font-sans font-bold uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

const TIERS: CustomerType[] = ['retail', 'agent', 'corporate'];
const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'pos', label: 'Card / POS' },
  { id: 'credit', label: 'Credit' }
];

interface DraftLine {
  key: string;
  productId: string;
  productName: string;
  varietyId: string;
  varietyName: string;
  packSizeId: string;
  qty: number;
  containerMode: ContainerMode;
  overrideUnitPrice: number | null;
  priceAdjustReason: string | null;
  unitPrice: number;
  lineAmount: number;
  litres: number;
  priceAdjusted: boolean;
}

export interface NewOrderScreenProps {
  onNavigate?: (tab: string) => void;
}

export const NewOrderScreen: React.FC<NewOrderScreenProps> = ({ onNavigate }) => {
  const {
    products,
    packPrices,
    customers,
    customerStatsMap,
    shiftGateStatus,
    activeShift,
    startShift,
    recordShiftOpeningReadings,
    createSale,
    physicalTanks,
    sales,
    orders,
    setActiveReceipt,
    currentUser,
    settings
  } = useStore();
  const { can } = usePermissions();

  // ---- In-page Previous Transactions View toggle ----
  const [showPreviousTransactions, setShowPreviousTransactions] = useState(false);
  const [txnSearch, setTxnSearch] = useState('');

  // ---- customer + tier ----
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [tierOverride, setTierOverride] = useState<CustomerType | null>(null);

  const customer = customers.find(c => c.id === customerId) || null;
  const customerStats = customer ? customerStatsMap[customer.id] : null;
  const tier: CustomerType = tierOverride || customer?.type || 'retail';

  // ---- item builder ----
  const [productId, setProductId] = useState<string>(products[0]?.id || '');
  const product = products.find(p => p.id === productId) || null;
  const [varietyId, setVarietyId] = useState<string>(products[0]?.varieties[0]?.id || '');
  const [packSizeId, setPackSizeId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [containerMode, setContainerMode] = useState<ContainerMode>('taken');
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideValue, setOverrideValue] = useState('');
  const [priceReason, setPriceReason] = useState('');

  // ---- cart + payment ----
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showBackdate, setShowBackdate] = useState(false);
  const [saleDateInput, setSaleDateInput] = useState(() => toDatetimeLocalValue());

  // ---- shift gate & start shift ----
  const [gateInputs, setGateInputs] = useState<Record<string, string>>({});
  const [gateCashierName, setGateCashierName] = useState(() => currentUser?.full_name || '');
  const [gateOpeningFloat, setGateOpeningFloat] = useState(() => (settings?.default_daily_float || 50000).toString());
  const [gateError, setGateError] = useState<string | null>(null);
  const anyBulk = products.some(p => p.supply_model === 'bulk_truck');
  const gateBlocked = anyBulk && !shiftGateStatus.isPassed;

  const copyPreviousReadings = () => {
    const prefilled: Record<string, string> = {};
    for (const p of shiftGateStatus.missingPumps) {
      prefilled[p.id] = p.last_meter_reading.toString();
    }
    setGateInputs(prev => ({ ...prev, ...prefilled }));
  };

  const packConfig = product?.pack_config ?? [];
  const sellableSizes = PACK_SIZES.filter(s => packConfig.some(c => c.pack_size_id === s.id));
  const activePackCfg = packConfig.find(c => c.pack_size_id === packSizeId) || null;
  const isReturnable = activePackCfg?.returnable ?? false;

  const selectProduct = (id: string) => {
    const p = products.find(pr => pr.id === id);
    setProductId(id);
    setVarietyId(p?.varieties[0]?.id || '');
    setPackSizeId('');
    setContainerMode('taken');
    setOverrideOn(false);
    setOverrideValue('');
    setPriceReason('');
  };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(c => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
      .slice(0, 8);
  }, [customers, customerSearch]);

  const preview = useMemo(() => {
    if (!product || !varietyId || !packSizeId) return null;
    return priceSaleLine({
      product,
      varietyId,
      packSizeId,
      tier,
      qty,
      containerMode: isReturnable ? containerMode : 'none',
      overrideUnitPrice: overrideOn && overrideValue ? Number(overrideValue) : null,
      packPrices
    });
  }, [product, varietyId, packSizeId, tier, qty, containerMode, isReturnable, overrideOn, overrideValue, packPrices]);

  const cartTotal = lines.reduce((s, l) => s + l.lineAmount, 0);
  const tenderedNum = Number(amountTendered) || 0;
  const changeDue = paymentMethod === 'cash' ? Math.max(0, tenderedNum - cartTotal) : 0;
  const shortTender = paymentMethod === 'cash' && amountTendered !== '' && tenderedNum < cartTotal;

  const projectedBalance = (customerStats?.currentBalance || 0) + (paymentMethod === 'credit' ? cartTotal : 0);
  const overLimit = !!customer && paymentMethod === 'credit' && projectedBalance > customer.credit_limit;
  const overLimitBlocked = overLimit && !can('authorizeCreditOverride');

  const canAddLine =
    !!product &&
    !!varietyId &&
    !!packSizeId &&
    qty > 0 &&
    !!preview &&
    !preview.unpriced &&
    (!preview.priceAdjusted || priceReason.trim().length > 0);

  const addLine = () => {
    if (!product || !preview || !canAddLine) return;
    const variety = product.varieties.find(v => v.id === varietyId);
    setLines(prev => [
      ...prev,
      {
        key: `dl-${Date.now()}-${prev.length}`,
        productId: product.id,
        productName: product.name,
        varietyId,
        varietyName: variety?.name || '',
        packSizeId,
        qty,
        containerMode: isReturnable ? containerMode : 'none',
        overrideUnitPrice: overrideOn && overrideValue ? Number(overrideValue) : null,
        priceAdjustReason: preview.priceAdjusted ? priceReason.trim() : null,
        unitPrice: preview.unitPrice,
        lineAmount: preview.lineAmount,
        litres: preview.litres,
        priceAdjusted: preview.priceAdjusted
      }
    ]);
    // reset the item panel, keep customer + tier
    setPackSizeId('');
    setQty(1);
    setContainerMode('taken');
    setOverrideOn(false);
    setOverrideValue('');
    setPriceReason('');
    setError(null);
  };

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));

  const completeSale = () => {
    setError(null);
    if (!customer) return setError('Select a customer.');
    if (lines.length === 0) return setError('Add at least one item.');
    if (shortTender) return setError('Cash tendered is less than the total.');
    if (overLimitBlocked) return setError('This sale puts the customer over their credit limit — owner approval required.');

    const result = createSale({
      customerId: customer.id,
      paymentMethod,
      amountTendered: paymentMethod === 'cash' && tenderedNum > 0 ? tenderedNum : null,
      note: note.trim() || undefined,
      pricingTier: tierOverride || undefined,
      date: showBackdate ? fromDatetimeLocalValue(saleDateInput) : undefined,
      lines: lines.map(l => ({
        productId: l.productId,
        varietyId: l.varietyId,
        packSizeId: l.packSizeId,
        qty: l.qty,
        containerMode: l.containerMode,
        overrideUnitPrice: l.overrideUnitPrice,
        priceAdjustReason: l.priceAdjustReason || undefined
      }))
    });

    if (!result.success) {
      setError(result.error || 'Could not record the sale.');
      return;
    }
    setLines([]);
    setAmountTendered('');
    setNote('');
    setTierOverride(null);
    setShowBackdate(false);
    setSaleDateInput(toDatetimeLocalValue());
  };

  const submitGate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGateError(null);
    const readings: Record<string, number> = {};
    for (const p of shiftGateStatus.missingPumps) {
      const valStr = gateInputs[p.id];
      const v = Number(valStr);
      if (!valStr || !Number.isFinite(v) || v <= 0) {
        setGateError(`Enter a valid opening reading for ${p.label}.`);
        return;
      }
      if (v < p.last_meter_reading) {
        setGateError(`Meter reading for ${p.label} cannot be less than previous reading (${p.last_meter_reading.toLocaleString()} L). Pumps only count up.`);
        return;
      }
      readings[p.id] = v;
    }

    if (!activeShift) {
      const cashier = gateCashierName.trim() || currentUser?.full_name || 'Staff';
      const floatVal = parseFloat(gateOpeningFloat) || 0;
      if (floatVal < 0) {
        setGateError('Opening cash float cannot be negative.');
        return;
      }
      const res = startShift({
        cashierName: cashier,
        openingFloat: floatVal,
        notes: 'Morning shift opened with verified pump readings',
        openingReadings: readings
      });
      if (!res.success) {
        setGateError(res.error || 'Could not start shift.');
        return;
      }
    } else {
      const res = recordShiftOpeningReadings(readings);
      if (!res.success) {
        setGateError(res.error || 'Could not save the readings.');
        return;
      }
    }
  };

  // ---- Recent Transactions List for in-page view ----
  const recentTransactions = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(sale => {
        const saleLines = orders.filter(o => o.sale_id === sale.id);
        const total = saleLines.reduce((s, l) => s + l.line_amount, 0);
        const cust = customers.find(c => c.id === sale.customer_id) || null;
        return {
          sale,
          lines: saleLines,
          total,
          customer: cust,
          customerName: cust?.name || 'Walk-in Customer'
        };
      })
      .filter(item => {
        if (!txnSearch.trim()) return true;
        const q = txnSearch.toLowerCase();
        return (
          item.customerName.toLowerCase().includes(q) ||
          item.sale.id.toLowerCase().includes(q) ||
          item.sale.payment_method.toLowerCase().includes(q) ||
          item.lines.some(l => l.variety_name.toLowerCase().includes(q) || l.product_id.toLowerCase().includes(q))
        );
      });
  }, [sales, orders, customers, txnSearch]);

  const handlePrintReceipt = (item: (typeof recentTransactions)[0]) => {
    const first = item.lines[0];
    if (!first || !item.customer) return;
    const receipt: ReceiptData = {
      receiptNumber: item.sale.id.replace('sale-', 'REC-'),
      type: 'order',
      date: item.sale.date,
      customer: item.customer,
      sale: item.sale,
      lines: item.lines,
      order: first,
      product: products.find(p => p.id === first.product_id),
      packLabel: packShort(first.pack_size_id),
      varietyName: first.variety_name,
      pricingTier: first.pricing_tier,
      amountTendered: item.sale.amount_tendered ?? null,
      changeDue: item.sale.change_due ?? null,
      paymentMethod: item.sale.payment_method,
      previousBalance: 0,
      newBalance: item.lines.reduce((s, l) => s + Math.max(0, l.line_amount - (l.paid_amount || 0)), 0),
      cashierName: item.sale.cashier_name || 'Depot Cashier'
    };
    setActiveReceipt(receipt);
  };

  if (!customer || !product) {
    return (
      <div className="max-w-md mx-auto py-16 text-center text-sm text-slate-500">
        Add at least one customer and one product (with prices in Inventory) to record a sale.
      </div>
    );
  }

  return (
    <div className="pb-28 split:pb-8">
      <Modal
        isOpen={gateBlocked}
        onClose={() => {}}
        hideCloseButton
        title={
          <span className="flex items-center gap-2.5 text-slate-900 dark:text-white font-heading font-bold text-base">
            <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <GasPump className="w-4 h-4" weight="bold" />
            </span>
            <span>{!activeShift ? 'Start Morning Shift & Verify Pumps' : 'Verify Morning Pump Readings'}</span>
          </span>
        }
        subtitle={
          !activeShift
            ? 'To begin inputting sales for the day, depot policy requires starting a shift and logging opening meter readings for all active dispensing pumps.'
            : `Shift is open for ${activeShift.cashier_name || 'Staff'}. Enter opening meter readings for all active bulk pumps before recording sales.`
        }
      >
        <form onSubmit={submitGate} className="space-y-4">
          {!activeShift && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Cashier / Staff on Duty *
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={gateCashierName}
                    onChange={e => setGateCashierName(e.target.value)}
                    placeholder="e.g. Fatima Yusuf"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Opening Cash Float (NGN) *
                </label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={gateOpeningFloat}
                    onChange={e => setGateOpeningFloat(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Physical cash placed in the drawer for customer change.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Dispensing Pumps Meter Readings ({shiftGateStatus.missingPumps.length})
              </div>
              <button
                type="button"
                onClick={copyPreviousReadings}
                className="text-xs font-sans font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <ArrowsCounterClockwise className="w-3.5 h-3.5" />
                <span>Use Previous Closing Readings</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {shiftGateStatus.missingPumps.map(p => {
                const sourceTank = physicalTanks.find(t => t.id === p.physical_tank_id);
                const prod = products.find(pr => pr.id === p.product_id);
                return (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-bold text-xs text-slate-900 dark:text-white">{p.label}</span>
                      <span className="text-xs font-mono text-slate-400">Prev: {p.last_meter_reading.toLocaleString()} L</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {prod?.name || 'Bulk Oil'}{sourceTank ? ` · ${sourceTank.label}` : ''}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        value={gateInputs[p.id] ?? ''}
                        onChange={e => setGateInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={`Min ${p.last_meter_reading} L`}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                      />
                      <span className="absolute right-3 top-2 text-xs font-mono text-slate-400">Litres</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {gateError && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" weight="bold" />
              <span>{gateError}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Check className="w-4 h-4" weight="bold" />
            <span>{!activeShift ? 'Start Shift & Unlock Counter' : 'Verify Readings & Unlock Counter'}</span>
          </button>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* PREVIOUS TRANSACTION VIEW (IN THIS PAGE)                                   */}
      {/* ========================================================================= */}
      {showPreviousTransactions ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1">
            <button
              type="button"
              id="btn-back-to-new-sale"
              onClick={() => setShowPreviousTransactions(false)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-sans font-bold transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="bold" />
              <span>← Back to New Sale</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                id="btn-goto-ledger"
                onClick={() => onNavigate('ledger')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-sans font-bold shadow-sm transition-all"
              >
                <span>Full Ledger</span>
                <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
              </button>
            )}
          </div>
          <div className="depot-card p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txnSearch}
                  onChange={e => setTxnSearch(e.target.value)}
                  placeholder="Search previous transactions by customer or order..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Showing <b>{recentTransactions.length}</b> transaction{recentTransactions.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <ClockCounterClockwise className="w-8 h-8 text-slate-400" />
                <p>No previous transactions found{txnSearch ? ' matching your search' : ' yet'}.</p>
                <button
                  onClick={() => setShowPreviousTransactions(false)}
                  className="mt-2 text-brand-600 dark:text-brand-400 font-bold hover:underline"
                >
                  Create a new sale →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentTransactions.map(item => (
                  <div
                    key={item.sale.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 -mx-4 px-4 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                          {item.customerName}
                        </span>
                        {(() => {
                          const theme = getPaymentModeTheme(item.sale.payment_method);
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono uppercase px-2 py-0.5 rounded-md border tracking-wider ${theme.badgeCls}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${theme.dotCls} shrink-0`} />
                              <span>{theme.badgeLabel}</span>
                            </span>
                          );
                        })()}
                        <span className="text-xs font-mono text-slate-400">
                          {formatDepotDate(item.sale.date)} · {formatDepotTime(item.sale.date)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {item.lines.length > 0 ? (
                          item.lines.map((l, idx) => (
                            <span key={l.id}>
                              {idx > 0 && ' · '}
                              {l.qty} × {packShort(l.pack_size_id)} {l.variety_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">Standard counter sale</span>
                        )}
                      </div>

                      {item.sale.cashier_name && (
                        <div className="text-xs text-slate-400">
                          Cashier: <span className="text-slate-600 dark:text-slate-300">{item.sale.cashier_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-base text-slate-900 dark:text-white">
                          {formatNaira(item.total)}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {item.sale.id.replace('sale-', 'REC-')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-sans font-semibold transition-colors"
                        title="Reprint receipt"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* STANDARD NEW SALE BUILDER                                                 */
        /* (CARD 3 IS REMOVED; PAYMENT IS CARD 3; RECENT TXN BUTTON INCLUDED)        */
        /* ========================================================================= */
        <div>
          <div className="grid grid-cols-1 split:grid-cols-12 gap-5">
            {/* ---------- BUILDER COLUMN (LEFT) ---------- */}
            <div className="split:col-span-7 space-y-5">
              {/* Card 1: Customer */}
              <section className="depot-card p-4 space-y-3">
                <StepBadge n={1} label="Customer" />
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={customerOpen ? customerSearch : customer.name}
                    onChange={e => {
                      setCustomerSearch(e.target.value);
                      setCustomerOpen(true);
                    }}
                    onFocus={() => {
                      setCustomerOpen(true);
                      setCustomerSearch('');
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-sans font-semibold focus:outline-none focus:border-brand-500"
                  />
                  {customerOpen && (
                    <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
                      {filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setCustomerId(c.id);
                            setTierOverride(null);
                            setCustomerOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                        >
                          <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                          <span className="text-xs capitalize text-slate-400">{c.type}</span>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="px-3.5 py-3 text-xs text-slate-400">No match</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Balance</span>
                  <span
                    className={`font-mono font-bold ${
                      (customerStats?.currentBalance || 0) > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {formatNaira(customerStats?.currentBalance || 0)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-slate-500">Limit {formatNaira(customer.credit_limit)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 mr-1">Price tier</span>
                  {TIERS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTierOverride(t === customer.type ? null : t)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-sans font-bold uppercase border transition-colors ${
                        tier === t
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                          : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  {tierOverride && <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">overridden</span>}
                </div>
              </section>

              {/* Card 2: Item builder */}
              <section className="depot-card p-4 space-y-4">
                <StepBadge n={2} label="Add an item" />

                {/* product selector */}
                <div className="flex flex-wrap gap-2">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-sans font-semibold border transition-all ${
                        p.id === product.id
                          ? 'bg-brand-500 text-slate-950 border-brand-500 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                {/* variety selector */}
                <div className="flex flex-wrap gap-1.5">
                  {product.varieties.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setVarietyId(v.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold border transition-colors ${
                        v.id === varietyId
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>

                {/* pack size tiles */}
                {sellableSizes.length === 0 ? (
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    This product has no pack sizes set. Configure them in the Inventory tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {sellableSizes.map(s => {
                      const linePrice = priceSaleLine({
                        product,
                        varietyId,
                        packSizeId: s.id,
                        tier,
                        qty: 1,
                        containerMode: 'none',
                        packPrices
                      });
                      const selected = s.id === packSizeId;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setPackSizeId(s.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            selected
                              ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-sans font-bold text-slate-900 dark:text-white">{s.short}</div>
                          <div className="text-xs font-mono text-slate-500">
                            {linePrice.unpriced ? (
                              <span className="text-amber-600 dark:text-amber-400">no price</span>
                            ) : (
                              formatNaira(linePrice.unitPrice)
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {packSizeId && preview && (
                  <div className="space-y-3 pt-1">
                    {/* qty stepper */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16">Packs</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQty(q => Math.max(1, q - 1))}
                          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                          className="w-16 text-center py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-sm"
                        />
                        <button
                          onClick={() => setQty(q => q + 1)}
                          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{preview.litres.toLocaleString()} L</span>
                    </div>

                    {/* container mode */}
                    {isReturnable && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-16">Keg</span>
                        <div className="flex gap-1.5">
                          {(['taken', 'bought'] as ContainerMode[]).map(m => (
                            <button
                              key={m}
                              onClick={() => setContainerMode(m)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold border capitalize transition-colors ${
                                containerMode === m
                                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                                  : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        {containerMode === 'bought' && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-mono">
                            +{formatNaira(preview.containerAmount)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* price + override */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16">Price</span>
                      {!overrideOn ? (
                        <>
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {formatNaira(preview.unitPrice)}
                          </span>
                          <span className="text-xs text-slate-400">/ {packShort(packSizeId)}</span>
                          <button
                            onClick={() => {
                              setOverrideOn(true);
                              setOverrideValue(String(preview.matrixUnitPrice ?? preview.unitPrice));
                            }}
                            className="text-xs font-sans font-semibold text-brand-600 dark:text-brand-400"
                          >
                            Adjust
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="relative w-32">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                                ₦
                              </span>
                              <input
                                type="number"
                                value={overrideValue}
                                onChange={e => setOverrideValue(e.target.value)}
                                className="w-full pl-6 pr-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-xs"
                              />
                            </div>
                            <button
                              onClick={() => {
                                setOverrideOn(false);
                                setOverrideValue('');
                                setPriceReason('');
                              }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            {preview.matrixUnitPrice != null && (
                              <span className="text-xs text-slate-400 font-mono">
                                std {formatNaira(preview.matrixUnitPrice)}
                              </span>
                            )}
                          </div>
                          {preview.priceAdjusted && (
                            <input
                              value={priceReason}
                              onChange={e => setPriceReason(e.target.value)}
                              placeholder="Reason for the price change (required)"
                              className="w-full px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-xs"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {preview.unpriced && (
                      <div className="text-xs text-rose-600 dark:text-rose-400">
                        No price for {product.name} / {product.varieties.find(v => v.id === varietyId)?.name} /{' '}
                        {packLabel(packSizeId)} at the {tier} tier. Set it in Inventory.
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        Line: {formatNaira(preview.lineAmount)}
                      </span>
                      <button
                        onClick={addLine}
                        disabled={!canAddLine}
                        className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-xs flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-4 h-4" weight="bold" /> Add to sale
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* ---------- PAYMENT & SUMMARY COLUMN (RIGHT) ---------- */}
            {/* Note: Card 3 is removed. Payment is now Step 3. */}
            <div className="split:col-span-5 space-y-4">
              {/* Quick shortcut to Previous Transactions */}
              <div className="depot-card p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/80 flex items-center justify-center text-brand-600 dark:text-brand-400">
                    <ClockCounterClockwise className="w-4 h-4" weight="bold" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Previous Transactions</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {sales.length} counter transaction{sales.length === 1 ? '' : 's'} on record
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-view-previous-transactions-card"
                  onClick={() => setShowPreviousTransactions(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-sans font-bold border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  View list →
                </button>
              </div>

              {/* Step 3: Payment & Items Summary */}
              <section className="depot-card p-4 space-y-3.5">
                <StepBadge n={3} label="Payment" />

                {/* Items in Sale (only shown when lines exist, replacing the standalone Card 3) */}
                {lines.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                      <span>Items in Sale ({lines.length})</span>
                      <span className="text-slate-900 dark:text-white font-mono text-xs">{formatNaira(cartTotal)}</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-200/50 dark:divide-slate-800/60">
                      {lines.map(l => (
                        <div key={l.key} className="flex items-center justify-between gap-2 pt-1.5 first:pt-0">
                          <div className="min-w-0">
                            <div className="text-xs font-sans font-semibold text-slate-900 dark:text-white truncate">
                              {l.qty} × {packShort(l.packSizeId)} · {l.productName}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {l.varietyName} · {formatNaira(l.unitPrice)}
                              {l.containerMode === 'taken' && ' · keg taken'}
                              {l.containerMode === 'bought' && ' · keg bought'}
                              {l.priceAdjusted && ' · adjusted'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                              {formatNaira(l.lineAmount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLine(l.key)}
                              className="text-slate-400 hover:text-rose-500 p-1"
                              aria-label="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total</span>
                      <span className="text-base font-mono font-extrabold text-slate-900 dark:text-white">
                        {formatNaira(cartTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment method selector */}
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(m => {
                    const isSelected = paymentMethod === m.id;
                    const theme = getPaymentModeTheme(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-sans font-bold border transition-all flex items-center justify-center gap-2 ${
                          isSelected
                            ? theme.buttonActiveCls + ' scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${theme.dotCls} shrink-0`} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        ₦
                      </span>
                      <input
                        type="number"
                        value={amountTendered}
                        onChange={e => setAmountTendered(e.target.value)}
                        placeholder="Cash tendered"
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-sm"
                      />
                    </div>
                    {amountTendered !== '' && (
                      <div
                        className={`text-xs font-mono ${
                          shortTender ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {shortTender ? `Short ${formatNaira(cartTotal - tenderedNum)}` : `Change ${formatNaira(changeDue)}`}
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'credit' && (
                  <div className="text-xs space-y-1">
                    <div className="text-slate-500">
                      Due{' '}
                      {formatDepotDate(
                        new Date(
                          (showBackdate ? new Date(fromDatetimeLocalValue(saleDateInput)).getTime() : Date.now()) +
                            customer.credit_term_days * 86400000
                        ).toISOString()
                      )}
                      {' · '}new balance {formatNaira(projectedBalance)}
                    </div>
                    {overLimit && (
                      <div
                        className={
                          overLimitBlocked
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {overLimitBlocked
                          ? 'Over credit limit — owner approval required.'
                          : 'Over credit limit (owner override).'}
                      </div>
                    )}
                  </div>
                )}

                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setShowBackdate(v => !v)}
                    className="text-xs font-sans font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    {showBackdate ? 'Using a specific date & time' : 'Not now? Backdate this sale'}
                  </button>
                  {showBackdate && (
                    <input
                      type="datetime-local"
                      value={saleDateInput}
                      onChange={e => setSaleDateInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs"
                    />
                  )}
                </div>

                {error && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  onClick={completeSale}
                  disabled={lines.length === 0 || shortTender || overLimitBlocked}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" weight="bold" /> Complete sale · {formatNaira(cartTotal)}
                  <ChevronRight className="w-4 h-4" weight="bold" />
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewOrderScreen;
