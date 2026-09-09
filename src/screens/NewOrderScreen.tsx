import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import {
  lookupRatePerLitre,
  calculateOrderPricing,
  formatNaira,
  formatDepotDate
} from '../services/businessLogic';
import { UnitType, PaymentMethod, KegSource } from '../types';
import {
  ShoppingCart,
  User,
  Package,
  CreditCard,
  AlertTriangle,
  Calendar,
  AlertCircle,
  Receipt,
  Fuel,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gauge,
  Save,
  Lock,
  Eye,
  Tag,
  ShieldAlert,
  Unlock
} from 'lucide-react';

export const NewOrderScreen: React.FC = () => {
  const {
    products,
    rateCards,
    customers,
    customerStatsMap,
    kegInventory,
    tankStockByProduct,
    pumps,
    pumpReadings,
    orders,
    settings,
    activeShift,
    shiftGateStatus,
    createNewOrder,
    recordPumpReading,
    recordShiftOpeningReadings
  } = useStore();

  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || '');
  const [productId, setProductId] = useState<string>('veg');
  const [unit, setUnit] = useState<UnitType>('keg');
  const [qty, setQty] = useState<string>('10');
  const [kegSource, setKegSource] = useState<KegSource>('company');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [note, setNote] = useState<string>('');

  // Discount & Custom Rate states
  const [isCustomRateEnabled, setIsCustomRateEnabled] = useState<boolean>(false);
  const [customRateInput, setCustomRateInput] = useState<string>('');
  const [discountReason, setDiscountReason] = useState<string>('');

  // Quick Rates Modal State
  const [isRatesGlanceOpen, setIsRatesGlanceOpen] = useState<boolean>(false);

  // Shift Opening Gate State (for inline unlocking if locked)
  const [gateReadings, setGateReadings] = useState<Record<string, string>>({});
  const [gateError, setGateError] = useState<string | null>(null);

  // Pump Assignment & Per-Order Meter Reading
  const [selectedPumpId, setSelectedPumpId] = useState<string>(() => {
    const initial = pumps.find(p => p.product_id === 'veg') || pumps[0];
    return initial?.id || '';
  });
  const [orderMeterReading, setOrderMeterReading] = useState<string>('');
  const [deliveredTons, setDeliveredTons] = useState<string>('');

  // Automatically ensure selected pump belongs to selected product type
  useEffect(() => {
    const currentPump = pumps.find(p => p.id === selectedPumpId);
    if (!currentPump || (currentPump.product_id && currentPump.product_id !== productId)) {
      const compatiblePump = pumps.find(p => p.product_id === productId);
      setSelectedPumpId(compatiblePump ? compatiblePump.id : '');
      setOrderMeterReading('');
    }
  }, [productId, pumps, selectedPumpId]);

  // Cumulative Pump Meter Logger State
  const [isPumpReadingOpen, setIsPumpReadingOpen] = useState(false);
  const [readingPumpId, setReadingPumpId] = useState<string>(pumps[0]?.id || '');
  const [newMeterReading, setNewMeterReading] = useState<string>('');
  const [readingNote, setReadingNote] = useState<string>('');
  const [pumpReadingStatus, setPumpReadingStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Overrides for soft warnings
  const [overrideKegShortage, setOverrideKegShortage] = useState<boolean>(false);
  const [overrideCreditLimit, setOverrideCreditLimit] = useState<boolean>(false);
  const [isCreditOverrideModalOpen, setIsCreditOverrideModalOpen] = useState<boolean>(false);
  const [isKegShortageModalOpen, setIsKegShortageModalOpen] = useState<boolean>(false);
  const [isPricingDetailsOpen, setIsPricingDetailsOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCustomer = customers.find(c => c.id === customerId) || customers[0];
  const selectedProduct = products.find(p => p.id === productId) || products[0];
  const customerStats = selectedCustomer ? customerStatsMap[selectedCustomer.id] : null;

  // Derive previous meter reading for selected pump
  const priorPumpReading = useMemo(() => {
    if (!selectedPumpId) return 0;
    const priorOrdersWithMeter = (orders || [])
      .filter(o => o.pump_id === selectedPumpId && o.meter_reading !== undefined && o.meter_reading !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (priorOrdersWithMeter.length > 0) {
      return Number(priorOrdersWithMeter[0].meter_reading);
    }
    const currentPump = pumps.find(p => p.id === selectedPumpId);
    return Number(currentPump?.last_meter_reading) || 0;
  }, [orders, pumps, selectedPumpId]);

  // Standard Rate from Rate Cards
  const standardRatePerLitre = useMemo(() => {
    if (!selectedCustomer || !selectedProduct) return 5000;
    return lookupRatePerLitre(rateCards, selectedProduct.id, selectedCustomer.type);
  }, [rateCards, selectedProduct, selectedCustomer]);

  // Effective Rate (custom rate if enabled, else standard rate card)
  const effectiveRatePerLitre = useMemo(() => {
    if (isCustomRateEnabled && customRateInput) {
      const parsed = parseFloat(customRateInput);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return standardRatePerLitre;
  }, [isCustomRateEnabled, customRateInput, standardRatePerLitre]);

  const isDiscountApplied = effectiveRatePerLitre < standardRatePerLitre;

  // Pricing calculation
  const pricing = useMemo(() => {
    return calculateOrderPricing(
      unit,
      parseFloat(qty) || 0,
      effectiveRatePerLitre,
      selectedProduct.litres_per_keg,
      selectedProduct.litres_per_ton || 1075,
      unit === 'keg' ? kegSource : null,
      selectedProduct.keg_sell_price || null
    );
  }, [unit, qty, effectiveRatePerLitre, selectedProduct, kegSource]);

  // Live per-order meter analysis
  const meterAnalysis = useMemo(() => {
    if (!orderMeterReading || !selectedPumpId) return null;
    const current = parseFloat(orderMeterReading);
    if (isNaN(current)) return null;
    const delta = current - priorPumpReading;
    const expected = pricing.litres;
    const variance = delta - expected;
    const isOverThreshold = Math.abs(variance) > settings.pump_variance_threshold;
    return {
      current,
      prior: priorPumpReading,
      delta: Number(delta.toFixed(2)),
      expected: Number(expected.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      isOverThreshold
    };
  }, [orderMeterReading, selectedPumpId, priorPumpReading, pricing.litres, settings.pump_variance_threshold]);

  // Combined stock and active FIFO tank
  const productStock = tankStockByProduct[productId]?.totalLitres || 0;
  const activeFifoTank = tankStockByProduct[productId]?.tanks[0] || null;

  // Credit due date calculation preview
  const creditDueDate = useMemo(() => {
    if (paymentMethod !== 'credit' || !selectedCustomer) return null;
    const d = new Date();
    d.setDate(d.getDate() + selectedCustomer.credit_term_days);
    return d.toISOString();
  }, [paymentMethod, selectedCustomer]);

  // Warnings checks
  const isCreditExceeded = useMemo(() => {
    if (paymentMethod !== 'credit' || !customerStats) return false;
    const projectedBalance = customerStats.currentBalance + pricing.amount;
    return projectedBalance > selectedCustomer.credit_limit;
  }, [paymentMethod, customerStats, pricing.amount, selectedCustomer]);

  const isKegShortage = useMemo(() => {
    if (unit !== 'keg' || (kegSource !== 'company' && kegSource !== 'purchased')) return false;
    const requestedKegs = parseFloat(qty) || 0;
    return requestedKegs > kegInventory.kegsAtDepot;
  }, [unit, kegSource, qty, kegInventory.kegsAtDepot]);

  const isStockInsufficient = pricing.litres > productStock;

  // Quick increment for quantity
  const handleQuickQtyAdd = (additional: number) => {
    const current = parseFloat(qty) || 0;
    setQty((current + additional).toString());
  };

  // Submit Shift Opening Gate Readings
  const handleUnlockShiftGate = (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);

    const missing = shiftGateStatus.missingPumps;
    const readingsToRecord: Record<string, number> = {};

    for (const p of missing) {
      const val = parseFloat(gateReadings[p.id]);
      if (isNaN(val) || val <= 0) {
        setGateError(`Please enter a valid meter reading for ${p.label}.`);
        return;
      }
      readingsToRecord[p.id] = val;
    }

    const res = recordShiftOpeningReadings(readingsToRecord);
    if (!res.success) {
      setGateError(res.error || 'Failed to record shift opening meters.');
    } else {
      setGateReadings({});
    }
  };

  // Pump Reading Submit Handler
  const handleRecordReadingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(newMeterReading);
    if (isNaN(num)) return;

    const res = recordPumpReading(readingPumpId, num, readingNote.trim() || undefined);
    if (res.success) {
      setPumpReadingStatus({
        success: true,
        msg: `Meter reading of ${num.toLocaleString()}L recorded for ${pumps.find(p => p.id === readingPumpId)?.label}.`
      });
      setNewMeterReading('');
      setReadingNote('');
      setTimeout(() => setPumpReadingStatus(null), 4500);
    } else {
      setPumpReadingStatus({
        success: false,
        msg: res.error || 'Failed to record meter reading'
      });
    }
  };

  const selectedReadingPump = pumps.find(p => p.id === readingPumpId) || pumps[0];

  const submitOrder = (allowKegOverride: boolean, allowCreditOverride: boolean) => {
    setErrorMessage(null);

    // Hard Gate Check: Active Shift Opening Meter readings
    if (!shiftGateStatus.isPassed) {
      setErrorMessage(
        'Sales are locked! Opening meter readings for all dispensing pumps must be logged before recording sales for this active shift.'
      );
      return;
    }

    const numericQty = parseFloat(qty) || 0;
    if (numericQty <= 0) {
      setErrorMessage('Quantity must be greater than zero.');
      return;
    }

    // Discount Reason Check: If below standard rate card, reason is strictly required!
    if (isDiscountApplied && !discountReason.trim()) {
      setErrorMessage(
        `Discount reason required! Entered rate (₦${effectiveRatePerLitre.toLocaleString()}/L) is below the approved standard card (₦${standardRatePerLitre.toLocaleString()}/L). Please provide an authorized discount reason.`
      );
      return;
    }

    if (isStockInsufficient) {
      setErrorMessage(
        `Insufficient depot stock! You requested ${pricing.litres.toLocaleString()}L, but only ${productStock.toLocaleString()}L is available in active tanks.`
      );
      return;
    }

    const selectedPump = pumps.find(p => p.id === selectedPumpId);
    if (selectedPump && selectedPump.product_id && selectedPump.product_id !== selectedProduct.id) {
      setErrorMessage(
        `Selected pump (${selectedPump.label}) is not configured for ${selectedProduct.name}. Please select a compatible pump line.`
      );
      return;
    }

    if (isKegShortage && !allowKegOverride) {
      setIsKegShortageModalOpen(true);
      return;
    }

    if (isCreditExceeded && !allowCreditOverride) {
      setIsCreditOverrideModalOpen(true);
      return;
    }

    const result = createNewOrder({
      customerId: selectedCustomer.id,
      productId: selectedProduct.id,
      unit,
      qty: numericQty,
      paymentMethod,
      kegSource: unit === 'keg' ? kegSource : null,
      pumpId: selectedPumpId || null,
      meterReading: orderMeterReading ? parseFloat(orderMeterReading) : null,
      deliveredQty: deliveredTons ? parseFloat(deliveredTons) : null,
      customRate: isCustomRateEnabled ? effectiveRatePerLitre : undefined,
      discountReason: isDiscountApplied ? discountReason.trim() : undefined,
      note: note.trim() || undefined
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to process sale.');
    } else {
      // Reset form fields
      setQty(unit === 'ton' ? '5' : '10');
      setOrderMeterReading('');
      setDeliveredTons('');
      setNote('');
      setIsCustomRateEnabled(false);
      setCustomRateInput('');
      setDiscountReason('');
      setOverrideKegShortage(false);
      setOverrideCreditLimit(false);
      setIsCreditOverrideModalOpen(false);
      setIsKegShortageModalOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitOrder(overrideKegShortage, overrideCreditLimit);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. SHIFT OPENING METERS HARD GATE ALERT / UNLOCK BANNER */}
      {!shiftGateStatus.isPassed && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-500 shadow-lg text-rose-900 dark:text-rose-100 animate-in fade-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200 dark:border-rose-900/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[17px] font-heading font-bold flex items-center gap-2">
                  <span>Shift-Start Meter Hard Gate: Counter Sales Locked</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                    Mandatory
                  </span>
                </h3>
                <p className="text-[12px] opacity-90">
                  {activeShift?.cashier_name || 'Active Shift'} must log opening meter readings for all 3 pumps before counter sales can be recorded.
                </p>
              </div>
            </div>
            <span className="text-[12px] font-mono font-bold px-3 py-1 rounded-lg bg-white/80 dark:bg-slate-900 text-rose-700 dark:text-rose-300 self-start sm:self-auto border border-rose-300 dark:border-rose-800">
              {shiftGateStatus.missingPumps.length} Pumps Pending
            </span>
          </div>

          {gateError && (
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{gateError}</span>
            </div>
          )}

          {/* Inline Opening Reading Form for Missing Pumps */}
          <form onSubmit={handleUnlockShiftGate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {shiftGateStatus.missingPumps.map(pump => {
                const isVeg = pump.product_id === 'veg';
                return (
                  <div
                    key={pump.id}
                    className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-300 dark:border-rose-800 space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                        />
                        {pump.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Prior: {pump.last_meter_reading.toLocaleString()}L
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min={pump.last_meter_reading}
                        required
                        placeholder={`>= ${pump.last_meter_reading}`}
                        value={gateReadings[pump.id] || ''}
                        onChange={e =>
                          setGateReadings({ ...gateReadings, [pump.id]: e.target.value })
                        }
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold text-[14px] focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <span className="absolute right-2.5 top-2.5 text-[11px] font-mono text-slate-400">
                        Litres
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-rose-800 dark:text-rose-200">
                Opening meters verify physical oil volume and ensure zero unlogged sales bypass.
              </span>
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-sans font-bold text-[13px] shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <Unlock className="w-4 h-4" />
                <span>Save Opening Meters & Unlock Sales</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2-COLUMN SALE WORKSPACE (60% / 40% Split at >=900px) */}
      <div className="grid grid-cols-1 split:grid-cols-5 gap-6 items-start">
        {/* LEFT COLUMN: SALE ENTRY FORM (60% - 3 cols) */}
        <form
          onSubmit={handleSubmit}
          className="split:col-span-3 p-6 rounded-2xl bg-rough-paper border border-stone-300/90 dark:border-slate-800 space-y-5 shadow-md"
        >
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Customer Select & Rate Glance Trigger */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Customer Account *</span>
              </label>
              <button
                type="button"
                onClick={() => setIsRatesGlanceOpen(true)}
                className="text-[11px] font-sans font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Rate Cards</span>
              </button>
            </div>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-white/95 dark:bg-slate-950 border border-stone-300/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-sans font-semibold text-[15px] focus:outline-none focus:border-brand-500 shadow-xs"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type.toUpperCase()}) — Limit: {formatNaira(c.credit_limit)}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Product Selection Chips */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Product Category *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const isSelected = productId === p.id;
                const isVeg = p.id === 'veg';
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setProductId(p.id);
                      const compatible = pumps.find(pump => pump.product_id === p.id);
                      if (compatible) {
                        setSelectedPumpId(compatible.id);
                        setOrderMeterReading('');
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all min-h-[52px] ${
                      isSelected
                        ? isVeg
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-300 font-bold shadow-sm'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-900 dark:text-rose-300 font-bold shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[15px] font-sans font-bold">{p.name}</div>
                    <div className="text-[11px] font-sans opacity-80 mt-0.5">
                      {p.supply_model === 'bulk_truck'
                        ? `Bulk Offload · ${p.litres_per_keg}L Kegs`
                        : `Pre-Kegged · ${p.litres_per_keg}L Kegs`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Dispensing Pump Selection & Live Per-Order Meter Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Dispense Pump Meter Line</span>
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  Threshold: ±{settings.pump_variance_threshold}L
                </span>
                <button
                  type="button"
                  onClick={() => setIsPumpReadingOpen(!isPumpReadingOpen)}
                  className="text-[11px] font-sans font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  <span>{isPumpReadingOpen ? 'Close Logger' : 'Log Pump Meter'}</span>
                </button>
              </div>
            </div>

            {/* Inline Cumulative Pump Meter Logger */}
            {isPumpReadingOpen && (
              <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800/80 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-sans font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4" /> Record Cumulative Pump Reading
                  </span>
                  <span className="text-[11px] font-sans text-purple-700 dark:text-purple-300">
                    Routine Calibration
                  </span>
                </div>

                {pumpReadingStatus && (
                  <div className={`p-2 rounded-lg text-[12px] font-sans ${pumpReadingStatus.success ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'}`}>
                    {pumpReadingStatus.msg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-sans uppercase font-bold text-slate-500 block mb-1">Select Pump</label>
                    <select
                      value={readingPumpId}
                      onChange={e => setReadingPumpId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {pumps.map(p => (
                        <option key={p.id} value={p.id}>{p.label} ({p.last_meter_reading}L)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-sans uppercase font-bold text-slate-500 block mb-1">New Meter (Litres)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newMeterReading}
                      onChange={e => setNewMeterReading(e.target.value)}
                      placeholder={`> ${selectedReadingPump?.last_meter_reading}`}
                      className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-sans uppercase font-bold text-slate-500 block mb-1">Note (Optional)</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={readingNote}
                        onChange={e => setReadingNote(e.target.value)}
                        placeholder="Shift check"
                        className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleRecordReadingSubmit}
                        className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex-shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {pumps.map(pump => {
                const isSelected = selectedPumpId === pump.id;
                const isCompatible = !pump.product_id || pump.product_id === productId;
                return (
                  <button
                    type="button"
                    key={pump.id}
                    disabled={!isCompatible}
                    onClick={() => {
                      if (isCompatible) {
                        setSelectedPumpId(pump.id);
                      }
                    }}
                    title={
                      !isCompatible
                        ? `Locked: Configured for ${pump.product_id === 'veg' ? 'Golden Vegetable Oil' : 'Palm Oil'} line only.`
                        : undefined
                    }
                    className={`p-2.5 rounded-xl border text-left text-[12px] transition-all relative ${
                      !isCompatible
                        ? 'opacity-40 bg-slate-100/90 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none'
                        : isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-300 font-bold shadow-sm cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-sans font-bold truncate">{pump.label}</div>
                      {!isCompatible && (
                        <span className="text-[9px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-0.5 flex-shrink-0">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                      {isCompatible ? (
                        `Meter: ${pump.last_meter_reading.toLocaleString()}L`
                      ) : (
                        <span className="text-amber-700/90 dark:text-amber-400/90 font-sans font-semibold">
                          {pump.product_id === 'veg' ? 'Golden Oil Only' : 'Palm Oil Only'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Per-Order Pump Meter Input with Live Delta & Variance */}
            {selectedPumpId && (
              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-[12px] font-sans font-semibold text-purple-950 dark:text-purple-200">
                    Pump Dispense Meter Reading
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-purple-700 dark:text-purple-300">
                    Prior Dispense Reading: <span className="font-bold">{priorPumpReading.toLocaleString()} L</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <div className="sm:col-span-8">
                    <input
                      type="number"
                      step="0.5"
                      min={priorPumpReading}
                      value={orderMeterReading}
                      onChange={e => setOrderMeterReading(e.target.value)}
                      placeholder={`Current meter (e.g. ${(priorPumpReading + pricing.litres).toFixed(0)})`}
                      className="w-full px-3.5 py-3 min-h-[48px] rounded-xl bg-white dark:bg-slate-950 border border-purple-300 dark:border-purple-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={() => setOrderMeterReading((priorPumpReading + pricing.litres).toString())}
                      className="w-full py-3 min-h-[48px] px-3 rounded-xl bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-200 text-[12px] font-sans font-bold border border-purple-300 dark:border-purple-800 transition-colors"
                    >
                      Fill Expected (+{pricing.litres}L)
                    </button>
                  </div>
                </div>

                {/* Live Variance Feedback */}
                {meterAnalysis && (
                  <div className={`p-2.5 rounded-lg text-[12px] flex items-center gap-2 ${
                    meterAnalysis.isOverThreshold
                      ? 'bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                      : 'bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                  }`}>
                    {meterAnalysis.isOverThreshold ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    )}
                    <span className="font-mono tabular-nums text-[12px]">
                      Delta: <strong>{meterAnalysis.delta}L</strong> (Expected: {meterAnalysis.expected}L)
                      {' | '}
                      Variance: <strong>{meterAnalysis.variance > 0 ? `+${meterAnalysis.variance}` : meterAnalysis.variance}L</strong>
                      {meterAnalysis.isOverThreshold && ` (Flagged > ±${settings.pump_variance_threshold}L threshold)`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Unit & Quantity (Keg, Litre, Ton) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Volume & Unit *
              </label>
              <span className="text-[13px] font-mono tabular-nums font-bold text-brand-600 dark:text-brand-400">
                = {pricing.litres.toLocaleString()} Litres
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* 3-Way Unit Toggle */}
              <div className="sm:col-span-6 grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setUnit('keg'); if (parseFloat(qty) > 100) setQty('10'); }}
                  className={`py-2.5 rounded-lg text-[12px] font-sans font-bold transition-all ${
                    unit === 'keg'
                      ? 'bg-brand-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  Keg ({selectedProduct.litres_per_keg}L)
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('litre')}
                  className={`py-2.5 rounded-lg text-[12px] font-sans font-bold transition-all ${
                    unit === 'litre'
                      ? 'bg-brand-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  Litres
                </button>
                <button
                  type="button"
                  onClick={() => { setUnit('ton'); setQty('5'); }}
                  className={`py-2.5 rounded-lg text-[12px] font-sans font-bold transition-all ${
                    unit === 'ton'
                      ? 'bg-brand-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  Tons
                </button>
              </div>

              {/* Quantity Input */}
              <div className="sm:col-span-6">
                <input
                  type="number"
                  step={unit === 'keg' ? '1' : unit === 'ton' ? '0.1' : '0.5'}
                  min="0.1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder={unit === 'ton' ? '5' : '10'}
                  inputMode="decimal"
                  className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500 text-right"
                  required
                />
              </div>
            </div>

            {/* Wholesale Tonnage Outbound Shortfall Card */}
            {unit === 'ton' && (
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[12px] space-y-2">
                <div className="flex items-center justify-between text-blue-950 dark:text-blue-200 font-semibold">
                  <span>Wholesale Bulk Tonnage Sale</span>
                  <span className="font-mono tabular-nums font-bold">1 Ton = {selectedProduct.litres_per_ton || 1075}L</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-sans text-slate-600 dark:text-slate-400 block mb-1">
                      Delivered Tons (Optional Outbound Check)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={deliveredTons}
                      onChange={e => setDeliveredTons(e.target.value)}
                      placeholder={`e.g. ${qty}`}
                      className="w-full px-3 py-2 min-h-[40px] rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[14px] font-mono tabular-nums focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    {deliveredTons && parseFloat(deliveredTons) < (parseFloat(qty) || 0) ? (
                      <div className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 font-bold p-1">
                        Shortfall: {((parseFloat(qty) || 0) - parseFloat(deliveredTons)).toFixed(2)} Tons (
                        {(((parseFloat(qty) || 0) - parseFloat(deliveredTons)) * (selectedProduct.litres_per_ton || 1075)).toFixed(1)}L)
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        Direct wholesale discharge — container allocation bypassed.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Increment Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-sans font-semibold text-slate-500 uppercase">Quick Add:</span>
              {(unit === 'ton' ? [1, 2, 5, 10] : [1, 5, 10, 20, 50]).map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleQuickQtyAdd(val)}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-white transition-colors"
                >
                  +{val} {unit}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Container Source (Only if unit === 'keg') — Extended with Outright Purchase */}
          {unit === 'keg' && (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span>Container / Jerrycan Source *</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Depot Stock: <strong>{kegInventory.kegsAtDepot}</strong> kegs
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
                {/* Company Keg */}
                <button
                  type="button"
                  onClick={() => setKegSource('company')}
                  className={`p-3 rounded-xl border text-left transition-all min-h-[52px] ${
                    kegSource === 'company'
                      ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-900 dark:text-brand-300 font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-sans font-bold text-[13px]">Company Keg</div>
                  <div className="text-[11px] font-sans text-slate-500 mt-0.5">Returnable Debt Logged</div>
                </button>

                {/* Customer Keg */}
                <button
                  type="button"
                  onClick={() => setKegSource('own')}
                  className={`p-3 rounded-xl border text-left transition-all min-h-[52px] ${
                    kegSource === 'own'
                      ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-900 dark:text-brand-300 font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-sans font-bold text-[13px]">Customer's Own Keg</div>
                  <div className="text-[11px] font-sans text-slate-500 mt-0.5">No Container Charge</div>
                </button>

                {/* Outright Keg Purchase */}
                <button
                  type="button"
                  onClick={() => setKegSource('purchased')}
                  className={`p-3 rounded-xl border text-left transition-all min-h-[52px] ${
                    kegSource === 'purchased'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-300 font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-sans font-bold text-[13px] flex items-center justify-between">
                    <span>Buy Keg Outright</span>
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                      +₦{(selectedProduct.keg_sell_price || 3500).toLocaleString()}/keg
                    </span>
                  </div>
                  <div className="text-[11px] font-sans text-slate-500 mt-0.5">Permanent Sale (No Debt)</div>
                </button>
              </div>

              {kegSource === 'purchased' && (
                <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-[11px] font-sans text-amber-900 dark:text-amber-200 flex items-center justify-between">
                  <span>
                    Container line item: <strong>{qty} kegs × ₦{(selectedProduct.keg_sell_price || 3500).toLocaleString()}</strong>
                  </span>
                  <span className="font-mono font-bold text-amber-800 dark:text-amber-300 text-[13px]">
                    +{formatNaira(pricing.kegAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 6. Pricing & Discount Controls */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Rate Card & Discount Authorization
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomRateEnabled(!isCustomRateEnabled)}
                className="text-[11px] font-sans font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                {isCustomRateEnabled ? 'Reset to Standard Card' : 'Apply Custom Rate'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Standard Approved Rate:</span>
                  <span className="font-mono font-bold text-[14px] text-slate-900 dark:text-white">
                    ₦{standardRatePerLitre.toLocaleString()}/L
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {selectedCustomer.type} Tier
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Effective Per-Keg Rate:</span>
                  <span className="font-mono font-bold text-[14px] text-brand-600 dark:text-brand-400">
                    {formatNaira(pricing.ratePerKeg)}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {selectedProduct.litres_per_keg}L Keg
                </span>
              </div>
            </div>

            {/* Custom Rate Input & Discount Reason */}
            {isCustomRateEnabled && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-sans uppercase font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Custom Rate per Litre (₦/L)
                    </label>
                    <input
                      type="number"
                      step="50"
                      min="100"
                      placeholder={`e.g. ${standardRatePerLitre}`}
                      value={customRateInput}
                      onChange={e => setCustomRateInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 bg-white dark:bg-slate-900 text-[14px] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-sans uppercase font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Equivalent Rate per {selectedProduct.litres_per_keg}L Keg
                    </label>
                    <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[14px] text-emerald-600 dark:text-emerald-400">
                      {formatNaira(pricing.ratePerKeg)}
                    </div>
                  </div>
                </div>

                {/* MANDATORY DISCOUNT REASON INPUT IF RATE < STANDARD RATE */}
                {isDiscountApplied && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 space-y-2">
                    <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Discount Alert: Rate is below standard card</span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      Entered rate (₦{effectiveRatePerLitre.toLocaleString()}/L) is below standard tier rate (₦{standardRatePerLitre.toLocaleString()}/L). An authorized discount reason is strictly mandatory.
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Approved bulk loyalty discount by Alhaji / MD concession"
                      value={discountReason}
                      onChange={e => setDiscountReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[13px] font-sans text-slate-900 dark:text-white placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. Payment Method */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Payment Terms / Method *</span>
            </label>
            <div className="grid grid-cols-3 gap-2 text-[13px] font-sans font-semibold">
              {(['credit', 'cash', 'transfer'] as PaymentMethod[]).map(method => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3.5 min-h-[48px] rounded-xl border capitalize transition-all ${
                    paymentMethod === method
                      ? 'bg-brand-500 text-slate-950 font-bold border-brand-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* 8. Soft Warnings & Overrides (Interactive Decision Prompts) */}
          {isKegShortage && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-[12px] font-sans text-amber-900 dark:text-amber-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>Depot Keg Shortage Warning</span>
                </div>
                {overrideKegShortage && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                    Override Authorized
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                You requested {qty} kegs, but depot yard only has {kegInventory.kegsAtDepot} available (safety threshold: {settings.kegs_at_depot_low_threshold}).
              </p>
              {!overrideKegShortage ? (
                <button
                  type="button"
                  onClick={() => setIsKegShortageModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-semibold text-[11px] transition-colors"
                >
                  Review & Authorize Keg Override →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOverrideKegShortage(false)}
                  className="text-[11px] text-slate-500 hover:underline block"
                >
                  Revoke authorization
                </button>
              )}
            </div>
          )}

          {isCreditExceeded && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/80 text-[12px] font-sans text-rose-900 dark:text-rose-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  <span>Credit Limit Breach Warning</span>
                </div>
                {overrideCreditLimit && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                    Override Authorized
                  </span>
                )}
              </div>
              <p className="text-[11px] text-rose-800 dark:text-rose-200 font-mono tabular-nums">
                Projected balance ({formatNaira(customerStats ? customerStats.currentBalance + pricing.amount : 0)})
                exceeds approved limit ({formatNaira(selectedCustomer.credit_limit)}) by +{formatNaira(Math.max(0, (customerStats ? customerStats.currentBalance + pricing.amount : 0) - selectedCustomer.credit_limit))}.
              </p>
              {!overrideCreditLimit ? (
                <button
                  type="button"
                  onClick={() => setIsCreditOverrideModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-200/80 dark:bg-rose-900/60 hover:bg-rose-300 dark:hover:bg-rose-800 text-rose-950 dark:text-rose-100 font-semibold text-[11px] transition-colors"
                >
                  Review & Authorize Credit Override →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOverrideCreditLimit(false)}
                  className="text-[11px] text-slate-500 hover:underline block"
                >
                  Revoke authorization
                </button>
              )}
            </div>
          )}

          {/* 9. Optional Note */}
          <div className="space-y-1">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Sale Note / Dispatch Slip (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Dispensed into customer white cans, gate dispatch slip #890"
              className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[15px] font-sans focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* 10. Submit Button */}
          <button
            type="submit"
            disabled={!shiftGateStatus.isPassed}
            className={`w-full py-4 min-h-[52px] rounded-xl font-sans font-bold text-[14px] uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 ${
              shiftGateStatus.isPassed
                ? 'bg-brand-500 hover:bg-brand-400 text-slate-950 shadow-brand-500/25'
                : 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
            }`}
          >
            <Receipt className="w-[18px] h-[18px]" />
            <span>
              {shiftGateStatus.isPassed
                ? 'Complete Sale & Issue Official Receipt'
                : 'Locked: Record Opening Meters Above'}
            </span>
          </button>
        </form>

        {/* RIGHT COLUMN: FIXED CUSTOMER SALE CONTAINER (40% - 2 COLS AT >=900px) */}
        <div className="split:col-span-2 split:sticky split:top-4 split:self-start space-y-4">
          {/* Mobile Accordion Toggle (<900px only) */}
          <div className="split:hidden p-4 rounded-2xl bg-rough-paper border border-stone-300/90 dark:border-slate-800 shadow-md flex items-center justify-between">
            <div>
              <div className="text-[11px] font-sans text-slate-500 uppercase tracking-wider font-semibold">
                Customer Sale Total
              </div>
              <div className="text-[24px] font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                {formatNaira(pricing.amount)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPricingDetailsOpen(!isPricingDetailsOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[12px] font-sans font-bold border border-stone-300 dark:border-slate-700 active:scale-95 transition-all shadow-xs"
            >
              <span>{isPricingDetailsOpen ? 'Hide Sale Details' : 'View Sale Details'}</span>
              {isPricingDetailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Fixed Sale Container on Desktop, toggled on mobile */}
          <div className={`${isPricingDetailsOpen ? 'space-y-4' : 'hidden split:block split:space-y-4'} split:max-h-[calc(100vh-5rem)] split:overflow-y-auto split:pr-1`}>
            {/* Customer Sale Ticket Card */}
            <div className="p-5 rounded-2xl bg-rough-paper border border-stone-300/90 dark:border-slate-800 shadow-md space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-300/70 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-[15px] text-slate-900 dark:text-white leading-tight">
                      Customer Sale
                    </h3>
                    <p className="text-[11px] font-sans text-slate-500">Live Dispense & Sale Invoice</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-sans font-bold uppercase tracking-wider bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-stone-300 dark:border-slate-700">
                  {selectedCustomer.type}
                </span>
              </div>

              {/* Customer Info Row */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-950 border border-stone-200/90 dark:border-slate-800 flex items-center justify-between shadow-xs">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-sans text-slate-500 uppercase tracking-wider">Customer</div>
                  <div className="text-[14px] font-sans font-bold text-slate-900 dark:text-white truncate">
                    {selectedCustomer.name}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <div className="text-[11px] font-sans text-slate-500 uppercase tracking-wider">Payment</div>
                  <div className="text-[12px] font-sans font-bold text-slate-800 dark:text-slate-200 capitalize">
                    {paymentMethod === 'credit' ? `Credit (${selectedCustomer.credit_term_days}d)` : paymentMethod}
                  </div>
                </div>
              </div>

              {/* Sale Line Breakdown */}
              <div className="space-y-2 text-[12px] font-mono tabular-nums">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Product</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {selectedProduct.name}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Volume Dispensed</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {pricing.litres.toLocaleString()} L <span className="font-normal text-slate-500">({qty} {unit}{parseFloat(qty) !== 1 ? 's' : ''})</span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Effective Rate/Litre</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    ₦{effectiveRatePerLitre.toLocaleString()}/L
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Rate per {selectedProduct.litres_per_keg}L Keg</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    {formatNaira(pricing.ratePerKeg)}
                  </span>
                </div>

                {/* Packaging Specification Line */}
                {unit === 'keg' && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="font-sans">Keg Packaging</span>
                    <span className="font-bold text-slate-900 dark:text-slate-200">
                      {kegSource === 'company'
                        ? 'Depot Yellow Keg (Returnable)'
                        : kegSource === 'purchased'
                        ? 'Bought Outright (+₦3,500)'
                        : 'Customer-Owned Keg'}
                    </span>
                  </div>
                )}

                {/* Subtotals if purchased outright */}
                {pricing.kegAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-sans">Oil Subtotal:</span>
                      <span className="font-mono">{formatNaira(pricing.oilAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-700 dark:text-amber-400">
                      <span className="font-sans">Container Purchase ({qty} kegs):</span>
                      <span className="font-mono font-bold">+{formatNaira(pricing.kegAmount)}</span>
                    </div>
                  </>
                )}

                {selectedPumpId && (
                  <div className="flex justify-between items-center text-purple-700 dark:text-purple-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-sans flex items-center gap-1">
                      <Fuel className="w-3.5 h-3.5" /> Pump Line
                    </span>
                    <span className="font-bold">
                      {pumps.find(p => p.id === selectedPumpId)?.label || 'Selected'}
                    </span>
                  </div>
                )}

                {creditDueDate && (
                  <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-sans flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Due Date ({selectedCustomer.credit_term_days}d):
                    </span>
                    <span className="font-bold">{formatDepotDate(creditDueDate)}</span>
                  </div>
                )}

                {/* Prominent Total Sale Value Callout */}
                <div className="pt-3 pb-1 border-t-2 border-dashed border-stone-300/80 dark:border-slate-800">
                  <div className="p-3.5 rounded-xl bg-white/95 dark:bg-slate-950 border border-stone-200/90 dark:border-slate-800 flex items-center justify-between shadow-xs">
                    <div>
                      <div className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                        Total Sale Value
                      </div>
                      <div className="text-[28px] font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">
                        {formatNaira(pricing.amount)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button inside the Fixed Right Panel */}
                <button
                  type="button"
                  disabled={!shiftGateStatus.isPassed}
                  onClick={() => submitOrder(overrideKegShortage, overrideCreditLimit)}
                  className={`w-full py-3.5 px-4 rounded-xl font-sans font-bold text-[13px] uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 ${
                    shiftGateStatus.isPassed
                      ? 'bg-brand-500 hover:bg-brand-400 text-slate-950 shadow-brand-500/20'
                      : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>
                    {shiftGateStatus.isPassed ? 'Complete Sale & Issue Receipt' : 'Shift Locked'}
                  </span>
                </button>
              </div>
            </div>

            {/* Customer Ledger Position Card */}
            {customerStats && (
              <div className="p-4 rounded-2xl bg-rough-paper border border-stone-300/90 dark:border-slate-800 space-y-2.5 shadow-md">
                <div className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Customer Ledger Position
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-[12px]">
                  <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950 border border-stone-200/90 dark:border-slate-800 shadow-xs">
                    <div className="text-[11px] font-sans text-slate-500">Current Balance</div>
                    <div className="text-[15px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatNaira(customerStats.currentBalance)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-950 border border-stone-200/90 dark:border-slate-800 shadow-xs">
                    <div className="text-[11px] font-sans text-slate-500">Credit Limit</div>
                    <div className="text-[15px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                      {formatNaira(selectedCustomer.credit_limit)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active FIFO Tank Depletion Preview */}
            {activeFifoTank && (
              <div className="p-4 rounded-2xl bg-rough-paper border border-stone-300/90 dark:border-slate-800 space-y-2.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Target Tank (FIFO Sequence)
                  </span>
                  <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-stone-200 dark:border-slate-700">
                    Oldest Active
                  </span>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-stone-200/80 dark:border-slate-800/80">
                  <TankGauge
                    productId={productId}
                    remainingLitres={activeFifoTank.remaining_litres}
                    totalCapacityLitres={15000}
                    size="sm"
                    showLabels={false}
                  />
                  <div className="space-y-0.5 text-[12px] font-sans">
                    <div className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                      {activeFifoTank.truck_label}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Stock in Tank: <span className="font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">{activeFifoTank.remaining_litres.toLocaleString()}L</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      After Draw: <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {Math.max(0, activeFifoTank.remaining_litres - pricing.litres).toLocaleString()}L
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: QUICK RATES GLANCE MODAL */}
      {isRatesGlanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                    Current Depot Rate Cards
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500">
                    Live rates per litre & per keg across customer tiers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRatesGlanceOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-950 uppercase font-semibold text-slate-600 dark:text-slate-400 font-sans">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Customer Tier</th>
                      <th className="px-4 py-3">Rate / Litre</th>
                      <th className="px-4 py-3 text-right">Per-Keg Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                    {products.map(p =>
                      (['retail', 'agent', 'corporate'] as const).map(tier => {
                        const rate = lookupRatePerLitre(rateCards, p.id, tier);
                        const kegRate = rate * p.litres_per_keg;
                        const isVeg = p.id === 'veg';

                        return (
                          <tr key={`${p.id}_${tier}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-sans font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                              />
                              <span>{p.name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded font-sans uppercase font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {tier}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                              ₦{rate.toLocaleString()}/L
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {formatNaira(kegRate)} ({p.litres_per_keg}L)
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-sans text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Outright empty keg container price:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  ₦{(selectedProduct.keg_sell_price || 3500).toLocaleString()} per container
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsRatesGlanceOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-sans font-semibold text-xs"
              >
                Close Rates Glance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BLOCKING KEG SHORTAGE DECISION MODAL */}
      {isKegShortageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between bg-amber-50/60 dark:bg-amber-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                    Authorize Keg Shortage Dispatch
                  </h3>
                  <p className="text-[12px] font-sans text-amber-800 dark:text-amber-300">
                    Yard inventory below safety threshold
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKegShortageModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-[13px] font-sans">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="font-sans text-slate-600 dark:text-slate-400">Requested Kegs:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{qty} kegs</span>
                </div>
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="font-sans text-slate-600 dark:text-slate-400">Available at Depot Yard:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{kegInventory.kegsAtDepot} kegs</span>
                </div>
                <div className="flex justify-between font-mono tabular-nums border-t border-amber-200 dark:border-amber-900/60 pt-1.5">
                  <span className="font-sans text-slate-600 dark:text-slate-400">Depot Safety Threshold:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{settings.kegs_at_depot_low_threshold} kegs</span>
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[12px]">
                Discharging this sale will exhaust yard safety reserves. Are you authorized by management to release these returnable containers?
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setIsKegShortageModalOpen(false)}
                  className="w-full sm:w-1/2 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-medium text-[13px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel / Adjust Qty
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverrideKegShortage(true);
                    setIsKegShortageModalOpen(false);
                    submitOrder(true, overrideCreditLimit);
                  }}
                  className="w-full sm:w-1/2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-[13px] shadow-sm transition-all"
                >
                  Authorize & Dispense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BLOCKING CREDIT LIMIT OVERRIDE DECISION MODAL */}
      {isCreditOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between bg-rose-50/60 dark:bg-rose-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                    Authorize Credit Cap Breach
                  </h3>
                  <p className="text-[12px] font-sans text-rose-800 dark:text-rose-300">
                    Customer exceeds authorized ceiling
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreditOverrideModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-[13px] font-sans">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2">
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="font-sans text-slate-600 dark:text-slate-400">Customer:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</span>
                </div>
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="font-sans text-slate-600 dark:text-slate-400">Current Outstanding:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatNaira(customerStats?.currentBalance || 0)}
                  </span>
                </div>
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="font-sans text-slate-600 dark:text-slate-400">This Sale Value:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">+{formatNaira(pricing.amount)}</span>
                </div>
                <div className="flex justify-between font-mono tabular-nums border-t border-rose-200 dark:border-rose-900/60 pt-1.5">
                  <span className="font-sans text-slate-600 dark:text-slate-400">Projected Balance:</span>
                  <span className="font-bold text-rose-700 dark:text-rose-400">
                    {formatNaira((customerStats?.currentBalance || 0) + pricing.amount)}
                  </span>
                </div>
                <div className="flex justify-between font-mono tabular-nums">
                  <span className="font-sans text-slate-600 dark:text-slate-400">Approved Credit Limit:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {formatNaira(selectedCustomer.credit_limit)}
                  </span>
                </div>
                <div className="flex justify-between font-mono tabular-nums text-rose-700 dark:text-rose-400 font-bold border-t border-rose-200 dark:border-rose-900/60 pt-1.5">
                  <span className="font-sans">Excess Over Limit:</span>
                  <span>
                    +{formatNaira(Math.max(0, (customerStats?.currentBalance || 0) + pricing.amount - selectedCustomer.credit_limit))}
                  </span>
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[12px]">
                Dispensing this credit sale requires management authorization. Authorize override and register invoice to accounts receivable?
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreditOverrideModalOpen(false)}
                  className="w-full sm:w-1/2 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-sans font-medium text-[13px] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Switch to Cash / Transfer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverrideCreditLimit(true);
                    setIsCreditOverrideModalOpen(false);
                    submitOrder(overrideKegShortage, true);
                  }}
                  className="w-full sm:w-1/2 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-sans font-bold text-[13px] shadow-sm transition-all"
                >
                  Authorize Manager Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
