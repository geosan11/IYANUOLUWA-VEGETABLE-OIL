import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import {
  lookupRatePerLitre,
  calculateOrderPricing,
  formatNaira,
  formatNairaWords,
  formatDepotDate
} from '../services/businessLogic';
import { UnitType, PaymentMethod, KegSource, CustomerType } from '../types';
import {
  User,
  Package,
  CreditCard,
  AlertTriangle,
  Calendar,
  AlertCircle,
  Fuel,
  Plus,
  Minus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gauge,
  Lock,
  Unlock,
  ShieldAlert,
  Zap,
  Banknote,
  Smartphone,
  Landmark,
  ClipboardList
} from 'lucide-react';

const TANK_CAP_FALLBACK: Record<string, number> = { veg: 30000, red: 15000 };

const PAYMENT_MODES: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: 'cash', label: 'Cash in Hand', icon: Banknote },
  { id: 'transfer', label: 'Bank Transfer', icon: Smartphone },
  { id: 'pos', label: 'Card (POS)', icon: CreditCard },
  { id: 'credit', label: 'Credit (Ledger)', icon: Landmark }
];

export const NewOrderScreen: React.FC = () => {
  const {
    products,
    rateCards,
    customers,
    customerStatsMap,
    kegInventory,
    tankStockByProduct,
    physicalTanks,
    pumps,
    orders,
    settings,
    activeShift,
    shiftGateStatus,
    createNewOrder,
    recordPumpReading,
    recordShiftOpeningReadings
  } = useStore();

  // ---- Sale entry state ----
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || '');
  const [productId, setProductId] = useState<string>(products[0]?.id || 'veg');
  const [varietyId, setVarietyId] = useState<string>('');
  const [unit, setUnit] = useState<UnitType>('litre');
  const [qty, setQty] = useState<string>('300');
  const [kegSource, setKegSource] = useState<KegSource>('company');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Pricing tier override (defaults to the customer's registered tier)
  const [tierOverride, setTierOverride] = useState<CustomerType | null>(null);

  // Manual / discounted rate
  const [isCustomRateEnabled, setIsCustomRateEnabled] = useState(false);
  const [customRateInput, setCustomRateInput] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  // Pump & per-order meter
  const [selectedPumpId, setSelectedPumpId] = useState<string>(() => {
    const initial = pumps.find(p => p.product_id === (products[0]?.id || 'veg')) || pumps[0];
    return initial?.id || '';
  });
  const [orderMeterReading, setOrderMeterReading] = useState('');
  const [deliveredTons, setDeliveredTons] = useState('');
  const [isMeterPanelOpen, setIsMeterPanelOpen] = useState(false);

  // Cumulative pump meter logger
  const [isPumpLoggerOpen, setIsPumpLoggerOpen] = useState(false);
  const [loggerPumpId, setLoggerPumpId] = useState<string>(pumps[0]?.id || '');
  const [loggerReading, setLoggerReading] = useState('');
  const [loggerNote, setLoggerNote] = useState('');
  const [loggerStatus, setLoggerStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Shift opening-meter gate
  const [gateReadings, setGateReadings] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState<string | null>(null);

  // Overrides
  const [overrideKegShortage, setOverrideKegShortage] = useState(false);
  const [overrideCreditLimit, setOverrideCreditLimit] = useState(false);
  const [kegShortageModal, setKegShortageModal] = useState(false);
  const [creditModal, setCreditModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDispensing, setIsDispensing] = useState(false);
  const [mobileSlipOpen, setMobileSlipOpen] = useState(false);

  const selectedCustomer = customers.find(c => c.id === customerId) || customers[0];
  const selectedProduct = products.find(p => p.id === productId) || products[0];
  const isPreKegged = selectedProduct?.supply_model === 'pre_kegged' || productId === 'red';
  const customerStats = selectedCustomer ? customerStatsMap[selectedCustomer.id] : null;
  const varieties = selectedProduct?.varieties || [];

  // Oil spec / variety is required and starts empty until staff selects an option
  useEffect(() => {
    setVarietyId('');
  }, [productId]);

  // Keep the pump on a line that matches the product (bulk liquid products only)
  useEffect(() => {
    if (isPreKegged) {
      setSelectedPumpId('');
      setOrderMeterReading('');
      return;
    }
    const current = pumps.find(p => p.id === selectedPumpId);
    if (!current || (current.product_id && current.product_id !== productId)) {
      const compatible = pumps.find(p => p.product_id === productId) || pumps[0];
      setSelectedPumpId(compatible ? compatible.id : '');
      setOrderMeterReading('');
    }
  }, [productId, pumps, selectedPumpId, isPreKegged]);

  const selectedVariety = varieties.find(v => v.id === varietyId) || null;
  const varietyDelta = selectedVariety ? Number(selectedVariety.rate_delta_per_litre || 0) : 0;

  const effectiveTier: CustomerType = tierOverride || selectedCustomer?.type || 'retail';
  const registeredTier: CustomerType = selectedCustomer?.type || 'retail';

  const tierCardRate = useMemo(
    () => (selectedProduct ? lookupRatePerLitre(rateCards, selectedProduct.id, effectiveTier) : 5000),
    [rateCards, selectedProduct, effectiveTier]
  );
  const standardRate = tierCardRate + varietyDelta;

  const effectiveRate = useMemo(() => {
    if (isCustomRateEnabled && customRateInput) {
      const parsed = parseFloat(customRateInput);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return standardRate;
  }, [isCustomRateEnabled, customRateInput, standardRate]);

  const isDiscountApplied = effectiveRate < standardRate - 0.001;

  const pricing = useMemo(
    () =>
      calculateOrderPricing(
        unit,
        parseFloat(qty) || 0,
        effectiveRate,
        selectedProduct?.litres_per_keg || 30,
        selectedProduct?.litres_per_ton || 1075,
        unit === 'keg' ? kegSource : null,
        selectedProduct?.keg_sell_price || null
      ),
    [unit, qty, effectiveRate, selectedProduct, kegSource]
  );

  // Savings vs. what a walk-in retail customer would pay for the same spec
  const retailRate = useMemo(
    () => (selectedProduct ? lookupRatePerLitre(rateCards, selectedProduct.id, 'retail') + varietyDelta : 0),
    [rateCards, selectedProduct, varietyDelta]
  );
  const savingsVsRetail = Math.max(0, (retailRate - effectiveRate) * pricing.litres);

  const productStock = tankStockByProduct[productId]?.totalLitres || 0;
  const activeFifoTank = tankStockByProduct[productId]?.tanks[0] || null;

  const priorPumpReading = useMemo(() => {
    if (!selectedPumpId) return 0;
    const withMeter = (orders || [])
      .filter(o => o.pump_id === selectedPumpId && o.meter_reading != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (withMeter.length > 0) return Number(withMeter[0].meter_reading);
    return Number(pumps.find(p => p.id === selectedPumpId)?.last_meter_reading) || 0;
  }, [orders, pumps, selectedPumpId]);

  const meterAnalysis = useMemo(() => {
    if (!orderMeterReading || !selectedPumpId) return null;
    const current = parseFloat(orderMeterReading);
    if (isNaN(current)) return null;
    const delta = current - priorPumpReading;
    const variance = delta - pricing.litres;
    return {
      delta: Number(delta.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      isOver: Math.abs(variance) > settings.pump_variance_threshold
    };
  }, [orderMeterReading, selectedPumpId, priorPumpReading, pricing.litres, settings.pump_variance_threshold]);

  const creditDueDate = useMemo(() => {
    if (paymentMethod !== 'credit' || !selectedCustomer) return null;
    const d = new Date();
    d.setDate(d.getDate() + selectedCustomer.credit_term_days);
    return d.toISOString();
  }, [paymentMethod, selectedCustomer]);

  const isCreditExceeded = useMemo(() => {
    if (paymentMethod !== 'credit' || !customerStats || !selectedCustomer) return false;
    return customerStats.currentBalance + pricing.amount > selectedCustomer.credit_limit;
  }, [paymentMethod, customerStats, pricing.amount, selectedCustomer]);

  const isKegShortage = useMemo(() => {
    if (unit !== 'keg' || (kegSource !== 'company' && kegSource !== 'purchased')) return false;
    return (parseFloat(qty) || 0) > kegInventory.kegsAtDepot;
  }, [unit, kegSource, qty, kegInventory.kegsAtDepot]);

  const isStockInsufficient = pricing.litres > productStock;

  const tenderedNum = parseFloat(amountTendered) || 0;
  const changeDue = paymentMethod === 'cash' && tenderedNum > 0 ? Math.max(0, tenderedNum - pricing.amount) : 0;
  const shortTender = paymentMethod === 'cash' && tenderedNum > 0 && tenderedNum < pricing.amount;

  // ---- Tank reserve bars (Step 1 cards) ----
  const reserveByProduct = useMemo(() => {
    const out: Record<string, { litres: number; cap: number; pct: number; kegs: number }> = {};
    products.forEach(p => {
      const litres = tankStockByProduct[p.id]?.totalLitres || 0;
      const cap =
        physicalTanks.filter(pt => pt.product_id === p.id).reduce((s, pt) => s + pt.capacity_litres, 0) ||
        TANK_CAP_FALLBACK[p.id] ||
        20000;
      out[p.id] = {
        litres,
        cap,
        pct: Math.min(100, cap > 0 ? (litres / cap) * 100 : 0),
        kegs: Math.floor(litres / (p.litres_per_keg || 30))
      };
    });
    return out;
  }, [products, tankStockByProduct, physicalTanks]);

  // ---- Handlers ----
  const quickAdd = (n: number) => setQty(((parseFloat(qty) || 0) + n).toString());
  const setMaxTank = () => {
    if (unit === 'keg') {
      setQty(Math.floor(productStock / (selectedProduct?.litres_per_keg || 30)).toString());
    } else if (unit === 'ton') {
      setQty((productStock / (selectedProduct?.litres_per_ton || 1075)).toFixed(2));
    } else {
      setQty(Math.floor(productStock).toString());
    }
  };

  const handleUnlockGate = (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    const toRecord: Record<string, number> = {};
    for (const p of shiftGateStatus.missingPumps) {
      const v = parseFloat(gateReadings[p.id]);
      if (isNaN(v) || v <= 0) {
        setGateError(`Enter a valid meter reading for ${p.label}.`);
        return;
      }
      toRecord[p.id] = v;
    }
    const res = recordShiftOpeningReadings(toRecord);
    if (!res.success) setGateError(res.error || 'Could not save opening meters.');
    else setGateReadings({});
  };

  const handleLoggerSubmit = () => {
    const n = parseFloat(loggerReading);
    if (isNaN(n)) return;
    const res = recordPumpReading(loggerPumpId, n, loggerNote.trim() || undefined);
    if (res.success) {
      setLoggerStatus({ ok: true, msg: `Logged ${n.toLocaleString()} L for ${pumps.find(p => p.id === loggerPumpId)?.label}.` });
      setLoggerReading('');
      setLoggerNote('');
      setTimeout(() => setLoggerStatus(null), 4500);
    } else {
      setLoggerStatus({ ok: false, msg: res.error || 'Could not record reading.' });
    }
  };

  const runSale = (allowKeg: boolean, allowCredit: boolean) => {
    setErrorMessage(null);

    if (varieties.length > 0 && !varietyId) {
      setErrorMessage('Oil spec / variety is required — please select an option before proceeding with the sale.');
      const el = document.getElementById('variety');
      if (el) el.focus();
      return;
    }

    if (!shiftGateStatus.isPassed && !isPreKegged) {
      setErrorMessage('Sales are locked — record opening meter readings for bulk dispensing pumps first.');
      return;
    }
    const numericQty = parseFloat(qty) || 0;
    if (numericQty <= 0) {
      setErrorMessage('Enter a quantity greater than zero.');
      return;
    }
    if (isDiscountApplied && !discountReason.trim()) {
      setErrorMessage(
        `Discount reason required — ₦${effectiveRate.toLocaleString()}/L is below the ₦${standardRate.toLocaleString()}/L standard rate for this spec and tier.`
      );
      return;
    }
    if (isStockInsufficient) {
      setErrorMessage(
        `Not enough stock — this sale needs ${pricing.litres.toLocaleString()} L but only ${productStock.toLocaleString()} L is in the tanks.`
      );
      return;
    }
    if (shortTender) {
      setErrorMessage(`Cash tendered (${formatNaira(tenderedNum)}) is less than the total (${formatNaira(pricing.amount)}).`);
      return;
    }
    if (!isPreKegged) {
      const pump = pumps.find(p => p.id === selectedPumpId);
      if (pump && pump.product_id && pump.product_id !== selectedProduct.id) {
        setErrorMessage(`${pump.label} is not on the ${selectedProduct.name} line — pick a matching pump.`);
        return;
      }
    }
    if (isKegShortage && !allowKeg) {
      setKegShortageModal(true);
      return;
    }
    if (isCreditExceeded && !allowCredit) {
      setCreditModal(true);
      return;
    }

    setIsDispensing(true);
    const result = createNewOrder({
      customerId: selectedCustomer.id,
      productId: selectedProduct.id,
      unit,
      qty: numericQty,
      paymentMethod,
      kegSource: unit === 'keg' ? kegSource : null,
      pumpId: isPreKegged ? undefined : (selectedPumpId || undefined),
      meterReading: !isPreKegged && orderMeterReading ? parseFloat(orderMeterReading) : null,
      deliveredQty: deliveredTons ? parseFloat(deliveredTons) : null,
      customRate: isCustomRateEnabled ? effectiveRate : undefined,
      discountReason: isDiscountApplied ? discountReason.trim() : undefined,
      pricingTier: tierOverride || undefined,
      varietyId: varietyId || null,
      amountTendered: paymentMethod === 'cash' && tenderedNum > 0 ? tenderedNum : null,
      note: note.trim() || undefined
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Could not complete the sale.');
      setIsDispensing(false);
      return;
    }

    // Reset for the next customer
    setVarietyId('');
    setQty(unit === 'ton' ? '5' : unit === 'keg' ? '10' : '300');
    setOrderMeterReading('');
    setDeliveredTons('');
    setAmountTendered('');
    setNote('');
    setIsCustomRateEnabled(false);
    setCustomRateInput('');
    setDiscountReason('');
    setTierOverride(null);
    setOverrideKegShortage(false);
    setOverrideCreditLimit(false);
    setKegShortageModal(false);
    setCreditModal(false);
    setMobileSlipOpen(false);
    setTimeout(() => setIsDispensing(false), 700);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSale(overrideKegShortage, overrideCreditLimit);
  };

  const gateLocked = !shiftGateStatus.isPassed && !isPreKegged;
  const paymentLabel = PAYMENT_MODES.find(m => m.id === paymentMethod)?.label || paymentMethod;

  return (
    <div className="space-y-5 pb-24">
      {/* ============ SHIFT OPENING METER GATE ============ */}
      {gateLocked && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-500 shadow-lg text-rose-900 dark:text-rose-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200 dark:border-rose-900/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[16px] font-heading font-bold">Sales locked — log opening pump meters</h3>
                <p className="text-[12px] opacity-90">
                  {activeShift?.cashier_name || 'This shift'} must record the opening reading on every pump before any sale.
                </p>
              </div>
            </div>
            <span className="text-[12px] font-mono font-bold px-3 py-1 rounded-lg bg-white/80 dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 self-start">
              {shiftGateStatus.missingPumps.length} pending
            </span>
          </div>
          {gateError && (
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{gateError}</span>
            </div>
          )}
          <form onSubmit={handleUnlockGate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {shiftGateStatus.missingPumps.map(pump => (
                <div key={pump.id} className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-300 dark:border-rose-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pump.product_id === 'veg' ? '#F59E0B' : '#EF4444' }} />
                      {pump.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Prior: {pump.last_meter_reading.toLocaleString()} L</span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    min={pump.last_meter_reading}
                    required
                    placeholder={`>= ${pump.last_meter_reading}`}
                    value={gateReadings[pump.id] || ''}
                    onChange={e => setGateReadings({ ...gateReadings, [pump.id]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold text-[14px] focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="w-full sm:w-auto px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-sans font-bold text-[13px] shadow-md transition-all flex items-center justify-center gap-2 active:scale-95">
              <Unlock className="w-4 h-4" />
              <span>Save opening meters &amp; unlock</span>
            </button>
          </form>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-[13px] font-sans flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="ml-auto text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* ============ 65 / 35 TERMINAL ============ */}
      <form onSubmit={handleSubmit} className={`grid grid-cols-1 split:grid-cols-3 gap-5 items-start ${gateLocked ? 'opacity-60 pointer-events-none select-none' : ''}`}>
        {/* ---------- LEFT: STEPS ---------- */}
        <div className="split:col-span-2 space-y-4">
          {/* STEP 1 — COMMODITY + SPEC + PUMP */}
          <section className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
            <StepHeader n={1} title="Select oil & pump line" sub="Confirm the tank source and metered line" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map(p => {
                const isSel = p.id === productId;
                const isVeg = p.id === 'veg';
                const r = reserveByProduct[p.id];
                const rate = lookupRatePerLitre(rateCards, p.id, effectiveTier);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`relative text-left rounded-2xl p-4 border-2 transition-all ${
                      isSel
                        ? isVeg
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30'
                          : 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 hover:border-slate-300'
                    }`}
                  >
                    {isSel && (
                      <span className={`absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full text-white ${isVeg ? 'bg-amber-500' : 'bg-rose-500'}`}>
                        SELECTED
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-xl text-white flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}>
                        {isVeg ? '🌻' : '🛢️'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-heading font-bold text-slate-900 dark:text-white truncate">{p.name}</div>
                        <div className="text-[11px] font-sans text-slate-500">
                          {p.supply_model === 'pre_kegged' ? 'Pre-kegged' : 'Bulk truck'} · {p.litres_per_keg}L/keg
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-end justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{effectiveTier} rate</div>
                        <div className="text-[18px] font-mono tabular-nums font-black text-slate-900 dark:text-white leading-none">
                          ₦{rate.toLocaleString()}<span className="text-[11px] font-sans font-bold text-slate-400"> /L</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400">Tank reserve</div>
                        <div className="text-[12px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300">
                          {r.litres.toLocaleString()} L <span className="text-slate-400">(~{r.kegs} kegs)</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1 ml-auto">
                          <div className="h-full rounded-full" style={{ width: `${r.pct}%`, backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Spec / variety */}
            {varieties.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="variety" className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" /> Oil spec / variety
                    <span className="text-rose-600 font-bold">* (Required)</span>
                  </label>
                  {!varietyId && (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/60 animate-pulse">
                      Selection Required
                    </span>
                  )}
                </div>
                <select
                  id="variety"
                  required
                  value={varietyId}
                  onChange={e => {
                    setVarietyId(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className={`mt-1 w-full px-3.5 py-2.5 rounded-xl border font-sans font-semibold text-[14px] transition-all focus:outline-none focus:border-brand-500 ${
                    !varietyId
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-400 dark:border-rose-700 text-slate-500 dark:text-slate-400 ring-1 ring-rose-300 dark:ring-rose-800'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                  }`}
                >
                  <option value="" disabled>
                    -- Select Oil Spec / Variety * --
                  </option>
                  {varieties.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.rate_delta_per_litre ? ` (${v.rate_delta_per_litre > 0 ? '+' : ''}₦${v.rate_delta_per_litre}/L)` : ''}
                    </option>
                  ))}
                </select>
                {!varietyId ? (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium flex items-center gap-1">
                    <span>* Please select the oil variety being sold to calculate the correct pricing.</span>
                  </p>
                ) : (
                  selectedVariety && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                      <span>✓ Selected: {selectedVariety.name} {selectedVariety.rate_delta_per_litre ? `(${selectedVariety.rate_delta_per_litre > 0 ? '+' : ''}₦${selectedVariety.rate_delta_per_litre}/L applied)` : '(Standard rate)'}</span>
                    </p>
                  )
                )}
              </div>
            )}

            {/* Dispense mechanism: Pumps for bulk vegetable oil, direct keg handover for pre-kegged palm oil */}
            {!isPreKegged ? (
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-purple-500" /> Dispense pump line
                  </label>
                  <button type="button" onClick={() => setIsMeterPanelOpen(o => !o)} className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5" /> {isMeterPanelOpen ? 'Hide meter' : 'Meter reading'}
                  </button>
                </div>
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pumps.map(pump => {
                    const isSel = selectedPumpId === pump.id;
                    return (
                      <button
                        type="button"
                        key={pump.id}
                        onClick={() => setSelectedPumpId(pump.id)}
                        className={`p-2.5 rounded-xl border text-left text-[12px] transition-all ${
                          isSel
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-300 font-bold shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-sans font-bold truncate">{pump.label}</span>
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                          Meter {pump.last_meter_reading.toLocaleString()} L
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Pre-Kegged Stock:</strong> Factory-sealed {selectedProduct?.litres_per_keg || 25}L containers dispatched directly from yard bays. No dispensing pump line required.
                  </span>
                </div>
                <span className="font-mono font-bold text-[11px] bg-amber-200/70 dark:bg-amber-900/60 px-2.5 py-1 rounded shrink-0">
                  1 Keg = {selectedProduct?.litres_per_keg || 25}L
                </span>
              </div>
            )}

            {!isPreKegged && isMeterPanelOpen && selectedPumpId && (
                <div className="mt-2 p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-purple-700 dark:text-purple-300">
                    <span className="font-sans font-semibold">Nozzle meter now</span>
                    <span>Prior: <b>{priorPumpReading.toLocaleString()} L</b></span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min={priorPumpReading}
                      value={orderMeterReading}
                      onChange={e => setOrderMeterReading(e.target.value)}
                      placeholder={`e.g. ${(priorPumpReading + pricing.litres).toFixed(0)}`}
                      className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-purple-300 dark:border-purple-800 text-slate-900 dark:text-white font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setOrderMeterReading((priorPumpReading + pricing.litres).toString())}
                      className="px-3 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-[11px] font-bold border border-purple-300 dark:border-purple-800"
                    >
                      +{pricing.litres}L
                    </button>
                  </div>
                  {meterAnalysis && (
                    <div className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono tabular-nums flex items-center gap-1.5 ${
                      meterAnalysis.isOver
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                    }`}>
                      {meterAnalysis.isOver ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Delta {meterAnalysis.delta}L · variance {meterAnalysis.variance > 0 ? `+${meterAnalysis.variance}` : meterAnalysis.variance}L
                      {meterAnalysis.isOver && ` (over ±${settings.pump_variance_threshold}L)`}
                    </div>
                  )}
                  <button type="button" onClick={() => setIsPumpLoggerOpen(o => !o)} className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    {isPumpLoggerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Log a cumulative calibration reading
                  </button>
                  {isPumpLoggerOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <select value={loggerPumpId} onChange={e => setLoggerPumpId(e.target.value)} className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white">
                        {pumps.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                      <input type="number" step="0.5" value={loggerReading} onChange={e => setLoggerReading(e.target.value)} placeholder="New meter L" className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white" />
                      <div className="flex gap-1.5">
                        <input type="text" value={loggerNote} onChange={e => setLoggerNote(e.target.value)} placeholder="Note" className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white" />
                        <button type="button" onClick={handleLoggerSubmit} className="px-2.5 rounded-lg bg-purple-600 text-white text-xs font-bold">Save</button>
                      </div>
                      {loggerStatus && (
                        <div className={`sm:col-span-3 text-[11px] font-semibold ${loggerStatus.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{loggerStatus.msg}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
          </section>

          {/* STEP 2 — VOLUME + CONTAINER */}
          <section className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
            <StepHeader
              n={2}
              title="Volume & container"
              sub={`Metered at ${selectedProduct?.litres_per_keg || 30}.00 L per keg`}
              right={<span className="text-[12px] font-mono tabular-nums font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">= {pricing.litres.toLocaleString()} L</span>}
            />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
              {/* Unit toggle */}
              <div className="md:col-span-5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-1">
                {(isPreKegged ? (['keg', 'litre'] as UnitType[]) : (['keg', 'litre', 'ton'] as UnitType[])).map(u => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => {
                      setUnit(u);
                      if (u === 'ton') setQty('5');
                      else if (u === 'keg' && (parseFloat(qty) || 0) > 200) setQty('10');
                    }}
                    className={`py-2.5 rounded-lg text-[12px] font-bold capitalize transition-all ${
                      unit === u ? 'bg-brand-500 text-slate-950 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {u === 'keg' ? `Keg (${selectedProduct?.litres_per_keg}L)` : u === 'litre' ? 'Litres' : 'Tons'}
                  </button>
                ))}
              </div>
              {/* Stepper */}
              <div className="md:col-span-7 bg-slate-50 dark:bg-slate-950 rounded-xl p-1.5 border-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button type="button" onClick={() => quickAdd(unit === 'keg' ? -1 : unit === 'ton' ? -0.5 : -30)} className="w-11 h-11 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center active:scale-95">
                  <Minus className="w-5 h-5" />
                </button>
                <div className="text-center flex-1 px-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={unit === 'keg' ? '1' : unit === 'ton' ? '0.1' : '0.5'}
                    min="0"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full text-center font-mono font-black text-3xl text-slate-900 dark:text-white bg-transparent border-0 p-0 focus:ring-0 leading-none"
                  />
                  <span className="text-[11px] font-bold text-slate-500 block mt-0.5">
                    {unit === 'keg'
                      ? `= ${pricing.litres.toLocaleString()} Litres (${selectedProduct?.litres_per_keg || 25}L per keg)`
                      : unit === 'litre'
                      ? `= ${(Number(qty || 0) / (selectedProduct?.litres_per_keg || 25)).toFixed(1)} kegs (${selectedProduct?.litres_per_keg || 25}L per keg)`
                      : `= ${(Number(qty || 0) * 1075).toLocaleString()} Litres (Tonnage)`}
                  </span>
                </div>
                <button type="button" onClick={() => quickAdd(unit === 'keg' ? 1 : unit === 'ton' ? 0.5 : 30)} className="w-11 h-11 rounded-lg bg-brand-500 text-slate-950 border border-brand-600 flex items-center justify-center active:scale-95">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(unit === 'ton' ? [1, 2, 5, 10] : unit === 'keg' ? [1, 5, 10, 20] : [30, 60, 150, 300, 600]).map(v => (
                <button type="button" key={v} onClick={() => quickAdd(v)} className="py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-bold text-[11px] text-slate-800 dark:text-slate-200 hover:border-brand-500">
                  +{v} {unit === 'litre' ? 'L' : unit}
                </button>
              ))}
              <button type="button" onClick={setMaxTank} className="py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-amber-400 dark:text-amber-600 font-black text-[10px] uppercase tracking-wide">
                Max tank
              </button>
            </div>

            {unit === 'ton' && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[12px]">
                <div className="flex items-center justify-between text-blue-950 dark:text-blue-200 font-semibold">
                  <span>Wholesale tonnage — delivered check</span>
                  <span className="font-mono">1 T = {selectedProduct?.litres_per_ton || 1075} L</span>
                </div>
                <input type="number" step="0.01" value={deliveredTons} onChange={e => setDeliveredTons(e.target.value)} placeholder={`Delivered tons (e.g. ${qty})`} className="mt-1.5 w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[13px] font-mono focus:outline-none focus:border-blue-500" />
                {deliveredTons && parseFloat(deliveredTons) < (parseFloat(qty) || 0) && (
                  <div className="mt-1 text-[11px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                    Shortfall {((parseFloat(qty) || 0) - parseFloat(deliveredTons)).toFixed(2)} T
                    ({(((parseFloat(qty) || 0) - parseFloat(deliveredTons)) * (selectedProduct?.litres_per_ton || 1075)).toFixed(0)} L)
                  </div>
                )}
              </div>
            )}

            {unit === 'keg' && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-brand-600" /> Container source
                    <span className="text-rose-600">*</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Depot stock: <b className="text-slate-900 dark:text-white">{kegInventory.kegsAtDepot}</b></span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
                  {([
                    { id: 'company', title: 'Company Keg', sub: 'Returnable — debt logged' },
                    { id: 'own', title: "Customer's Own", sub: 'No container charge' },
                    { id: 'purchased', title: 'Buy Outright', sub: `+${formatNaira(selectedProduct?.keg_sell_price || 0)}/keg` }
                  ] as const).map(opt => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setKegSource(opt.id as KegSource)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        kegSource === opt.id
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-heading font-bold">{opt.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
                {kegSource === 'purchased' && pricing.kegAmount > 0 && (
                  <div className="mt-2 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-[12px] font-bold text-amber-800 dark:text-amber-300">
                    <span>Container line: {qty} kegs × {formatNaira(selectedProduct?.keg_sell_price || 0)}</span>
                    <span>+{formatNaira(pricing.kegAmount)}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* STEP 3 — BUYER + PAYMENT */}
          <section className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
            <StepHeader n={3} title="Buyer & payment" sub="Tier is auto-detected — override only when needed" />

            <label htmlFor="cust" className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-600" /> Customer account <span className="text-rose-600">*</span>
            </label>
            <select
              id="cust"
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setTierOverride(null); }}
              className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-sans font-semibold text-[14px] focus:outline-none focus:border-brand-500"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type.toUpperCase()}) — limit {formatNaira(c.credit_limit)}</option>
              ))}
            </select>

            {/* Tier + rate line */}
            <div className="mt-2 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="w-6 h-6 rounded-lg bg-brand-500 text-white font-black flex items-center justify-center text-xs">✓</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-200 capitalize">
                  {tierOverride ? `${tierOverride} pricing (override)` : `${registeredTier} pricing (auto)`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {(['retail', 'agent', 'corporate'] as CustomerType[]).map(t => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setTierOverride(t === registeredTier ? null : t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize border transition-all ${
                      effectiveTier === t
                        ? 'bg-brand-500 text-slate-950 border-brand-600'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom rate / discount */}
            <div className="mt-2 flex items-center justify-between">
              <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <input type="checkbox" checked={isCustomRateEnabled} onChange={e => setIsCustomRateEnabled(e.target.checked)} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500" />
                Manual rate / discount
              </label>
              <span className="text-[11px] font-mono text-slate-500">Standard: ₦{standardRate.toLocaleString()}/L</span>
            </div>
            {isCustomRateEnabled && (
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="number" step="10" value={customRateInput} onChange={e => setCustomRateInput(e.target.value)} placeholder={`₦/L (e.g. ${standardRate})`} className="px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[13px] font-mono font-bold text-slate-900 dark:text-white" />
                <input type="text" value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="Authorised discount reason" className={`px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border text-[13px] text-slate-900 dark:text-white ${isDiscountApplied && !discountReason.trim() ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700'}`} />
              </div>
            )}

            {/* Payment modes */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_MODES.map(m => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2.5 px-2 rounded-xl border-2 text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                      active ? 'border-brand-500 bg-brand-500 text-slate-950' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-center leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {paymentMethod === 'cash' && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Cash tendered</label>
                  <input type="number" step="100" value={amountTendered} onChange={e => setAmountTendered(e.target.value)} placeholder={pricing.amount.toFixed(0)} className={`w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border text-[14px] font-mono font-bold text-slate-900 dark:text-white ${shortTender ? 'border-rose-400' : 'border-slate-300 dark:border-slate-700'}`} />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">Change due</span>
                  <div className={`w-full px-3 py-2 rounded-lg border text-[14px] font-mono font-bold ${shortTender ? 'border-rose-400 text-rose-600' : 'border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400'} bg-slate-50 dark:bg-slate-950`}>
                    {shortTender ? 'Short!' : formatNaira(changeDue)}
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'credit' && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[12px] font-sans text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Due {formatDepotDate(creditDueDate)} ({selectedCustomer?.credit_term_days}d)</span>
                {isCreditExceeded && <span className="font-bold text-rose-600 dark:text-rose-400">Over limit</span>}
              </div>
            )}

            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Sale note / dispatch ref (optional)" className="mt-2 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px] text-slate-900 dark:text-white" />
          </section>
        </div>

        {/* ---------- RIGHT: LIVE SLIP ---------- */}
        <div className="hidden split:block split:col-span-1 split:sticky split:top-4 self-start">
          <SlipCard
            productName={selectedProduct?.name || ''}
            varietyName={selectedVariety?.name || null}
            hasVarieties={varieties.length > 0}
            effectiveTier={effectiveTier}
            effectiveRate={effectiveRate}
            standardRate={standardRate}
            litres={pricing.litres}
            qty={parseFloat(qty) || 0}
            unit={unit}
            oilAmount={pricing.oilAmount}
            kegAmount={pricing.kegAmount}
            kegSource={kegSource}
            kegUnitPrice={selectedProduct?.keg_sell_price || 0}
            total={pricing.amount}
            savings={savingsVsRetail}
            customerName={selectedCustomer?.name || ''}
            paymentLabel={paymentLabel}
            cashierName={activeShift?.cashier_name || 'Counter'}
            isDispensing={isDispensing}
            disabled={gateLocked || isStockInsufficient || shortTender || (varieties.length > 0 && !varietyId)}
            onDispense={() => runSale(overrideKegShortage, overrideCreditLimit)}
          />
        </div>
      </form>

      {/* ---------- MOBILE STICKY TOTAL + SLIP ---------- */}
      <div className="split:hidden fixed bottom-16 left-0 right-0 z-30 px-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase text-slate-400">Total</div>
            <div className="text-[20px] font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400 leading-none">{formatNaira(pricing.amount)}</div>
          </div>
          <button type="button" onClick={() => setMobileSlipOpen(true)} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[12px] font-bold border border-slate-200 dark:border-slate-700">Slip</button>
          <button
            type="button"
            disabled={isDispensing || gateLocked || isStockInsufficient || shortTender || (varieties.length > 0 && !varietyId)}
            onClick={() => runSale(overrideKegShortage, overrideCreditLimit)}
            className="px-4 py-2.5 rounded-xl bg-brand-500 text-slate-950 text-[13px] font-black disabled:opacity-50 flex items-center gap-1.5"
          >
            <Zap className="w-4 h-4" /> {isDispensing ? '...' : (varieties.length > 0 && !varietyId) ? 'Select Spec' : 'Dispense'}
          </button>
        </div>
      </div>

      {mobileSlipOpen && (
        <div className="split:hidden fixed inset-0 z-50 flex items-end bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileSlipOpen(false)}>
          <div className="w-full bg-transparent p-3" onClick={e => e.stopPropagation()}>
            <SlipCard
              productName={selectedProduct?.name || ''}
              varietyName={selectedVariety?.name || null}
              hasVarieties={varieties.length > 0}
              effectiveTier={effectiveTier}
              effectiveRate={effectiveRate}
              standardRate={standardRate}
              litres={pricing.litres}
              qty={parseFloat(qty) || 0}
              unit={unit}
              oilAmount={pricing.oilAmount}
              kegAmount={pricing.kegAmount}
              kegSource={kegSource}
              kegUnitPrice={selectedProduct?.keg_sell_price || 0}
              total={pricing.amount}
              savings={savingsVsRetail}
              customerName={selectedCustomer?.name || ''}
              paymentLabel={paymentLabel}
              cashierName={activeShift?.cashier_name || 'Counter'}
              isDispensing={isDispensing}
              disabled={gateLocked || isStockInsufficient || shortTender || (varieties.length > 0 && !varietyId)}
              onDispense={() => runSale(overrideKegShortage, overrideCreditLimit)}
            />
          </div>
        </div>
      )}

      {/* ---------- KEG SHORTAGE MODAL ---------- */}
      {kegShortageModal && (
        <DecisionModal
          tone="amber"
          title="Yard keg reserve is low"
          onCancel={() => setKegShortageModal(false)}
          onConfirm={() => { setOverrideKegShortage(true); setKegShortageModal(false); runSale(true, overrideCreditLimit); }}
          confirmLabel="Authorise & dispense"
          rows={[
            ['Company kegs requested', `${qty}`],
            ['Available in yard', `${kegInventory.kegsAtDepot}`],
            ['Safety threshold', `${settings.kegs_at_depot_low_threshold}`]
          ]}
          body="This sale takes the yard below its safety reserve of returnable containers. Continue only if authorised."
        />
      )}

      {/* ---------- CREDIT LIMIT MODAL ---------- */}
      {creditModal && (
        <DecisionModal
          tone="rose"
          title="Sale goes over the credit limit"
          onCancel={() => setCreditModal(false)}
          onConfirm={() => { setOverrideCreditLimit(true); setCreditModal(false); runSale(overrideKegShortage, true); }}
          confirmLabel="Authorise manager override"
          rows={[
            ['Customer', selectedCustomer?.name || ''],
            ['Current owed', formatNaira(customerStats?.currentBalance || 0)],
            ['This sale', `+${formatNaira(pricing.amount)}`],
            ['Projected owed', formatNaira((customerStats?.currentBalance || 0) + pricing.amount)],
            ['Approved limit', formatNaira(selectedCustomer?.credit_limit || 0)]
          ]}
          body="Recording this credit sale needs management authorisation."
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const StepHeader: React.FC<{ n: number; title: string; sub: string; right?: React.ReactNode }> = ({ n, title, sub, right }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black flex items-center justify-center">{n}</span>
      <div>
        <h3 className="text-[14px] font-heading font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
    </div>
    {right}
  </div>
);

interface SlipProps {
  productName: string;
  varietyName: string | null;
  hasVarieties?: boolean;
  effectiveTier: CustomerType;
  effectiveRate: number;
  standardRate: number;
  litres: number;
  qty: number;
  unit: UnitType;
  oilAmount: number;
  kegAmount: number;
  kegSource: KegSource;
  kegUnitPrice: number;
  total: number;
  savings: number;
  customerName: string;
  paymentLabel: string;
  cashierName: string;
  isDispensing: boolean;
  disabled: boolean;
  onDispense: () => void;
}

const SlipCard: React.FC<SlipProps> = (p) => (
  <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5">
    <div className="text-center pb-3 border-b-2 border-dashed border-slate-200 dark:border-slate-800">
      <span className="inline-block bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-black text-[10px] tracking-widest px-2.5 py-0.5 rounded uppercase">
        Live dispense slip
      </span>
      <div className="text-[13px] font-heading font-black text-slate-900 dark:text-white mt-1.5">IYANUOLUWA OIL DEPOT</div>
      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
        {p.cashierName} · {formatDepotDate(new Date().toISOString())}
      </div>
    </div>

    <div className="py-3 space-y-2.5 text-[12px]">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Commodity &amp; rate</div>
          <div className="font-heading font-bold text-slate-900 dark:text-white truncate">{p.productName}</div>
          {p.varietyName ? (
            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400">{p.varietyName}</div>
          ) : p.hasVarieties ? (
            <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 animate-pulse">⚠️ Spec required</div>
          ) : null}
          <div className="text-[9px] font-black uppercase mt-0.5 inline-block bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">{p.effectiveTier} tier</div>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400">₦{p.effectiveRate.toLocaleString()}/L</span>
          {p.effectiveRate < p.standardRate && (
            <span className="block text-[9px] text-slate-400 line-through">₦{p.standardRate.toLocaleString()}/L</span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Volume billed</div>
          <div className="font-bold text-slate-800 dark:text-slate-200">{p.litres.toLocaleString()} L</div>
        </div>
        <span className="font-mono font-black text-slate-900 dark:text-white">{formatNaira(p.oilAmount)}</span>
      </div>

      {p.kegSource === 'purchased' && p.kegAmount > 0 && (
        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Container surcharge</div>
            <div className="font-medium text-amber-700 dark:text-amber-400">{p.qty} × {formatNaira(p.kegUnitPrice)}</div>
          </div>
          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">+{formatNaira(p.kegAmount)}</span>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
        <div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase">Buyer &amp; settlement</div>
          <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{p.customerName}</div>
        </div>
        <span className="text-[10px] font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 px-2 py-0.5 rounded">{p.paymentLabel}</span>
      </div>
    </div>

    <div className="border-t-2 border-dashed border-slate-300 dark:border-slate-700 my-2" />

    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 text-center my-2">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">Total amount</span>
        {p.savings > 0 && (
          <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">
            Saves {formatNaira(p.savings)}
          </span>
        )}
      </div>
      <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-mono">{formatNaira(p.total)}</div>
      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{formatNairaWords(p.total)}</p>
    </div>

    <button
      type="button"
      disabled={p.isDispensing || p.disabled}
      onClick={p.onDispense}
      className="mt-2 w-full bg-brand-500 hover:bg-brand-400 active:scale-[0.99] text-slate-950 font-black text-[15px] py-3.5 rounded-2xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      <Zap className={`w-5 h-5 ${p.isDispensing ? 'animate-spin' : ''}`} />
      <span className="uppercase tracking-wide">
        {p.isDispensing
          ? 'Processing…'
          : p.hasVarieties && !p.varietyName
          ? 'Select oil spec to dispense'
          : 'Dispense oil & print slip'}
      </span>
    </button>
  </div>
);

const DecisionModal: React.FC<{
  tone: 'amber' | 'rose';
  title: string;
  body: string;
  rows: [string, string][];
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ tone, title, body, rows, confirmLabel, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
    <div className={`w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border shadow-2xl overflow-hidden ${tone === 'amber' ? 'border-amber-300 dark:border-amber-700' : 'border-rose-300 dark:border-rose-700'}`}>
      <div className={`p-4 border-b flex items-center gap-2.5 ${tone === 'amber' ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' : 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'}`}>
        {tone === 'amber' ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
        <h3 className="font-heading font-bold text-[15px] text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4 space-y-3 text-[13px]">
        <div className={`p-3 rounded-xl space-y-1.5 ${tone === 'amber' ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-rose-50 dark:bg-rose-950/30'}`}>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between font-mono tabular-nums">
              <span className="font-sans text-slate-600 dark:text-slate-400">{k}</span>
              <span className="font-bold text-slate-900 dark:text-white">{v}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-slate-600 dark:text-slate-300">{body}</p>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[13px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-[13px] font-bold ${tone === 'amber' ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-rose-600 hover:bg-rose-500'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </div>
);
