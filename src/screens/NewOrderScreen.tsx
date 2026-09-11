import React, { useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { usePermissions } from '../services/permissions';
import { formatNaira, formatDepotDate, toDatetimeLocalValue, fromDatetimeLocalValue } from '../services/businessLogic';
import { priceSaleLine } from '../services/pricing';
import { PACK_SIZES, packLabel, packShort } from '../constants/config';
import { ContainerMode, CustomerType, PaymentMethod } from '../types';
import { Modal } from '../components/common/Modal';
import {
  PlusCircle,
  MagnifyingGlass as Search,
  Minus,
  Plus,
  Trash as Trash2,
  X,
  ShieldWarning as ShieldAlert,
  Check,
  CaretRight as ChevronRight,
  Package
} from '@phosphor-icons/react';

/** Small numbered step marker for the 4 section headers, echoing a terminal-style flow. */
const StepBadge: React.FC<{ n: number; label: string }> = ({ n, label }) => (
  <div className="flex items-center gap-2">
    <span className="w-5 h-5 rounded bg-brand-500/20 text-brand-700 dark:text-brand-400 font-mono tabular-nums font-bold text-[11px] flex items-center justify-center shrink-0">
      {n}
    </span>
    <span className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500">{label}</span>
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

export const NewOrderScreen: React.FC = () => {
  const {
    products,
    packPrices,
    customers,
    customerStatsMap,
    shiftGateStatus,
    recordShiftOpeningReadings,
    createSale,
    physicalTanks
  } = useStore();
  const { can } = usePermissions();

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

  // ---- shift gate ----
  const [gateInputs, setGateInputs] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState<string | null>(null);
  const anyBulk = products.some(p => p.supply_model === 'bulk_truck');
  const gateBlocked = anyBulk && !shiftGateStatus.isPassed;

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

  const submitGate = () => {
    setGateError(null);
    const readings: Record<string, number> = {};
    for (const p of shiftGateStatus.missingPumps) {
      const v = Number(gateInputs[p.id]);
      if (!Number.isFinite(v) || v <= 0) {
        setGateError(`Enter a valid opening reading for ${p.label}.`);
        return;
      }
      readings[p.id] = v;
    }
    const res = recordShiftOpeningReadings(readings);
    if (!res.success) setGateError(res.error || 'Could not save the readings.');
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
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center">
          <PlusCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h1 className="text-lg font-heading font-bold text-slate-900 dark:text-white leading-tight">New sale</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">Build the sale one pack at a time, then take one payment.</p>
        </div>
      </div>

      <Modal
        isOpen={gateBlocked}
        onClose={() => {}}
        hideCloseButton
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" weight="bold" /> Record opening pump readings
          </span>
        }
        subtitle="Every bulk pump needs today's opening meter reading before the counter unlocks."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shiftGateStatus.missingPumps.map(p => {
              const sourceTank = physicalTanks.find(t => t.id === p.physical_tank_id);
              return (
                <label key={p.id} className="text-[12px] font-sans text-slate-700 dark:text-slate-300">
                  {p.label}
                  {sourceTank && <span className="text-slate-400"> — {sourceTank.label}</span>}
                  <input
                    type="number"
                    value={gateInputs[p.id] || ''}
                    onChange={e => setGateInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={`last ${p.last_meter_reading.toLocaleString()} L`}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] font-mono"
                  />
                </label>
              );
            })}
          </div>
          {gateError && <div className="text-[12px] text-rose-600 dark:text-rose-400">{gateError}</div>}
          <button
            onClick={submitGate}
            className="w-full px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px] shadow-[0_0_0_3px_rgba(0,183,73,0.18)]"
          >
            Unlock counter
          </button>
        </div>
      </Modal>

      <div>
        <div className="grid grid-cols-1 split:grid-cols-12 gap-5">
          {/* ---------- BUILDER ---------- */}
          <div className="split:col-span-7 space-y-5">
            {/* Customer */}
            <section className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
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
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[14px] font-sans font-semibold focus:outline-none focus:border-brand-500"
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
                        className="w-full text-left px-3.5 py-2.5 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                        <span className="text-[11px] capitalize text-slate-400">{c.type}</span>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="px-3.5 py-3 text-[12px] text-slate-400">No match</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-slate-500">Balance</span>
                <span className={`font-mono font-bold ${(customerStats?.currentBalance || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatNaira(customerStats?.currentBalance || 0)}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-slate-500">Limit {formatNaira(customer.credit_limit)}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 mr-1">Price tier</span>
                {TIERS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTierOverride(t === customer.type ? null : t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold uppercase border transition-colors ${
                      tier === t
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {tierOverride && <span className="text-[10px] text-amber-600 dark:text-amber-400">overridden</span>}
              </div>
            </section>

            {/* Item builder */}
            <section className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <StepBadge n={2} label="Add an item" />

              {/* product */}
              <div className="flex flex-wrap gap-2">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p.id)}
                    className={`px-3.5 py-2 rounded-xl text-[13px] font-sans font-semibold border transition-all ${
                      p.id === product.id
                        ? 'bg-brand-500 text-slate-950 border-brand-500 shadow-[0_0_0_3px_rgba(0,183,73,0.18)]'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* variety */}
              <div className="flex flex-wrap gap-1.5">
                {product.varieties.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVarietyId(v.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-sans font-semibold border transition-colors ${
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
                <div className="text-[12px] text-amber-700 dark:text-amber-400">
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
                            ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 shadow-[0_0_0_3px_rgba(0,183,73,0.14)]'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-[13px] font-sans font-bold text-slate-900 dark:text-white">{s.short}</div>
                        <div className="text-[11px] font-mono text-slate-500">
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
                    <span className="text-[12px] text-slate-500 w-16">Packs</span>
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
                        className="w-16 text-center py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[15px]"
                      />
                      <button
                        onClick={() => setQty(q => q + 1)}
                        className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{preview.litres.toLocaleString()} L</span>
                  </div>

                  {/* container mode */}
                  {isReturnable && (
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-slate-500 w-16">Keg</span>
                      <div className="flex gap-1.5">
                        {(['taken', 'bought'] as ContainerMode[]).map(m => (
                          <button
                            key={m}
                            onClick={() => setContainerMode(m)}
                            className={`px-3 py-1.5 rounded-lg text-[12px] font-sans font-bold border capitalize transition-colors ${
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
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                          +{formatNaira(preview.containerAmount)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* price + override */}
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-slate-500 w-16">Price</span>
                    {!overrideOn ? (
                      <>
                        <span className="font-mono font-bold text-[15px] text-slate-900 dark:text-white">
                          {formatNaira(preview.unitPrice)}
                        </span>
                        <span className="text-[11px] text-slate-400">/ {packShort(packSizeId)}</span>
                        <button
                          onClick={() => {
                            setOverrideOn(true);
                            setOverrideValue(String(preview.matrixUnitPrice ?? preview.unitPrice));
                          }}
                          className="text-[11px] font-sans font-semibold text-brand-600 dark:text-brand-400"
                        >
                          Adjust
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative w-32">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px]">₦</span>
                            <input
                              type="number"
                              value={overrideValue}
                              onChange={e => setOverrideValue(e.target.value)}
                              className="w-full pl-6 pr-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[13px]"
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
                            <span className="text-[10px] text-slate-400 font-mono">std {formatNaira(preview.matrixUnitPrice)}</span>
                          )}
                        </div>
                        {preview.priceAdjusted && (
                          <input
                            value={priceReason}
                            onChange={e => setPriceReason(e.target.value)}
                            placeholder="Reason for the price change (required)"
                            className="w-full px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-[12px]"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {preview.unpriced && (
                    <div className="text-[12px] text-rose-600 dark:text-rose-400">
                      No price for {product.name} / {product.varieties.find(v => v.id === varietyId)?.name} /{' '}
                      {packLabel(packSizeId)} at the {tier} tier. Set it in Inventory.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[13px] font-mono font-bold text-slate-900 dark:text-white">
                      Line: {formatNaira(preview.lineAmount)}
                    </span>
                    <button
                      onClick={addLine}
                      disabled={!canAddLine}
                      className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-[13px] flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" weight="bold" /> Add to sale
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ---------- CART + PAYMENT ---------- */}
          <div className="split:col-span-5 space-y-4">
            <section className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="mb-3">
                <StepBadge n={3} label={`Sale (${lines.length})`} />
              </div>
              {lines.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-400 flex flex-col items-center gap-2">
                  <Package className="w-6 h-6" /> No items yet
                </div>
              ) : (
                <div className="space-y-2">
                  {lines.map(l => (
                    <div key={l.key} className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="min-w-0">
                        <div className="text-[13px] font-sans font-semibold text-slate-900 dark:text-white truncate">
                          {l.qty} × {packShort(l.packSizeId)} · {l.productName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {l.varietyName} · {formatNaira(l.unitPrice)}/{packShort(l.packSizeId)}
                          {l.containerMode === 'taken' && ' · keg taken'}
                          {l.containerMode === 'bought' && ' · keg bought'}
                          {l.priceAdjusted && ' · price adjusted'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[13px] font-mono font-bold text-slate-900 dark:text-white">{formatNaira(l.lineAmount)}</span>
                        <button onClick={() => removeLine(l.key)} className="text-slate-400 hover:text-rose-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[13px] font-sans font-bold text-slate-600 dark:text-slate-300">Total</span>
                <span className="text-[18px] font-mono font-extrabold text-slate-900 dark:text-white">{formatNaira(cartTotal)}</span>
              </div>
            </section>

            <section className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <StepBadge n={4} label="Payment" />
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2.5 rounded-xl text-[13px] font-sans font-bold border transition-all ${
                      paymentMethod === m.id
                        ? 'bg-brand-500 text-slate-950 border-brand-500 shadow-[0_0_0_3px_rgba(0,183,73,0.18)]'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[14px]">₦</span>
                    <input
                      type="number"
                      value={amountTendered}
                      onChange={e => setAmountTendered(e.target.value)}
                      placeholder="Cash tendered"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[14px]"
                    />
                  </div>
                  {amountTendered !== '' && (
                    <div className={`text-[12px] font-mono ${shortTender ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {shortTender ? `Short ${formatNaira(cartTotal - tenderedNum)}` : `Change ${formatNaira(changeDue)}`}
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'credit' && (
                <div className="text-[12px] space-y-1">
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
                    <div className={overLimitBlocked ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-amber-600 dark:text-amber-400'}>
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
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
              />

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowBackdate(v => !v)}
                  className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  {showBackdate ? 'Using a specific date & time' : 'Not now? Backdate this sale'}
                </button>
                {showBackdate && (
                  <input
                    type="datetime-local"
                    value={saleDateInput}
                    onChange={e => setSaleDateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[13px]"
                  />
                )}
              </div>

              {error && (
                <div className="text-[12px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                onClick={completeSale}
                disabled={lines.length === 0 || shortTender || overLimitBlocked}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans font-bold text-[14px] flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" weight="bold" /> Complete sale · {formatNaira(cartTotal)}
                <ChevronRight className="w-4 h-4" weight="bold" />
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewOrderScreen;
