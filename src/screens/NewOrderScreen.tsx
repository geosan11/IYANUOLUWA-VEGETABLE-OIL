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
  Save
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
    createNewOrder,
    recordPumpReading
  } = useStore();

  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || '');
  const [productId, setProductId] = useState<string>('veg');
  const [unit, setUnit] = useState<UnitType>('keg');
  const [qty, setQty] = useState<string>('10');
  const [kegSource, setKegSource] = useState<KegSource>('company');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [note, setNote] = useState<string>('');

  // Pump Assignment & Per-Order Meter Reading
  const [selectedPumpId, setSelectedPumpId] = useState<string>('');
  const [orderMeterReading, setOrderMeterReading] = useState<string>('');
  const [deliveredTons, setDeliveredTons] = useState<string>('');

  // Lightweight "Record Pump Reading" Action state
  const [isPumpReadingOpen, setIsPumpReadingOpen] = useState(false);
  const [readingPumpId, setReadingPumpId] = useState<string>(pumps[0]?.id || '');
  const [newMeterReading, setNewMeterReading] = useState<string>('');
  const [readingNote, setReadingNote] = useState<string>('');
  const [pumpReadingStatus, setPumpReadingStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Overrides for soft warnings
  const [overrideKegShortage, setOverrideKegShortage] = useState<boolean>(false);
  const [overrideCreditLimit, setOverrideCreditLimit] = useState<boolean>(false);
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

  // Rate & Pricing Calculations
  const ratePerLitre = useMemo(() => {
    if (!selectedCustomer || !selectedProduct) return 5000;
    return lookupRatePerLitre(rateCards, selectedProduct.id, selectedCustomer.type);
  }, [rateCards, selectedProduct, selectedCustomer]);

  const pricing = useMemo(() => {
    return calculateOrderPricing(
      unit,
      parseFloat(qty) || 0,
      ratePerLitre,
      settings.litres_per_keg,
      selectedProduct.litres_per_ton
    );
  }, [unit, qty, ratePerLitre, settings.litres_per_keg, selectedProduct.litres_per_ton]);

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

  // Soft Warnings checks
  const isCreditExceeded = useMemo(() => {
    if (paymentMethod !== 'credit' || !customerStats) return false;
    const projectedBalance = customerStats.currentBalance + pricing.amount;
    return projectedBalance > selectedCustomer.credit_limit;
  }, [paymentMethod, customerStats, pricing.amount, selectedCustomer]);

  const isKegShortage = useMemo(() => {
    if (unit !== 'keg' || kegSource !== 'company') return false;
    const requestedKegs = parseFloat(qty) || 0;
    return requestedKegs > kegInventory.kegsAtDepot;
  }, [unit, kegSource, qty, kegInventory.kegsAtDepot]);

  const isStockInsufficient = pricing.litres > productStock;

  // Quick increment for quantity
  const handleQuickQtyAdd = (additional: number) => {
    const current = parseFloat(qty) || 0;
    setQty((current + additional).toString());
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericQty = parseFloat(qty) || 0;
    if (numericQty <= 0) {
      setErrorMessage('Quantity must be greater than zero.');
      return;
    }

    if (isStockInsufficient) {
      setErrorMessage(
        `Insufficient depot stock! You requested ${pricing.litres.toLocaleString()}L, but only ${productStock.toLocaleString()}L is available in active tanks.`
      );
      return;
    }

    if (isKegShortage && !overrideKegShortage) {
      setErrorMessage('Depot company keg shortage! Please check the explicit override box to proceed.');
      return;
    }

    if (isCreditExceeded && !overrideCreditLimit) {
      setErrorMessage('Customer credit limit breach! Please check the explicit override box to proceed.');
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
      note: note.trim() || undefined
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to process order.');
    } else {
      // Reset form fields
      setQty(unit === 'ton' ? '5' : '10');
      setOrderMeterReading('');
      setDeliveredTons('');
      setNote('');
      setOverrideKegShortage(false);
      setOverrideCreditLimit(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Title & Context Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <span>Counter Dispense & New Order</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Automated FIFO tank draw, per-order pump meter tracking, customer credit validation, and instant receipt generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums text-slate-700 dark:text-slate-300">
            <span className="font-sans">Available {selectedProduct.name}:</span>{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">{productStock.toLocaleString()} L</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums text-slate-700 dark:text-slate-300">
            <span className="font-sans">Depot Kegs:</span>{' '}
            <span className={`font-bold ${kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {kegInventory.kegsAtDepot}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsPumpReadingOpen(!isPumpReadingOpen)}
            className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/80 text-[12px] font-sans font-bold flex items-center gap-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all active:scale-95"
          >
            <Gauge className="w-4 h-4" />
            <span>{isPumpReadingOpen ? 'Hide Pump Logger' : 'Record Pump Reading'}</span>
            {isPumpReadingOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* LIGHTWEIGHT PUMP READING RECORDER (COLLAPSIBLE ACTION SECTION) */}
      {isPumpReadingOpen && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50/80 via-white to-purple-50/50 dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 border-2 border-purple-300 dark:border-purple-800/80 shadow-md animate-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200 dark:border-purple-900/60 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[18px] font-heading font-semibold text-purple-950 dark:text-purple-200">
                  Periodic Pump Meter Audit Entry
                </h3>
                <p className="text-[12px] font-sans text-purple-700/80 dark:text-purple-300/70">
                  Record cumulative pump odometer reading to audit against logged dispense orders.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 font-bold self-start sm:self-auto">
              Variance Threshold: {settings.pump_variance_threshold}L
            </span>
          </div>

          {pumpReadingStatus && (
            <div className={`p-3 rounded-xl mb-4 text-[12px] font-sans font-medium flex items-center gap-2 ${
              pumpReadingStatus.success
                ? 'bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                : 'bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300'
            }`}>
              {pumpReadingStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
              <span>{pumpReadingStatus.msg}</span>
            </div>
          )}

          <form onSubmit={handleRecordReadingSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 text-[12px]">
            {/* Select Pump */}
            <div className="lg:col-span-4 space-y-1">
              <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Select Depot Pump</label>
              <select
                value={readingPumpId}
                onChange={e => setReadingPumpId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-sans font-semibold text-[14px] focus:outline-none focus:border-purple-500"
              >
                {pumps.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} (Current: {p.last_meter_reading.toLocaleString()}L)
                  </option>
                ))}
              </select>
            </div>

            {/* New Meter Reading Input */}
            <div className="lg:col-span-3 space-y-1">
              <div className="flex justify-between">
                <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Cumulative Reading (L)</label>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">Min: {selectedReadingPump?.last_meter_reading.toLocaleString()}L</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min={selectedReadingPump?.last_meter_reading || 0}
                  value={newMeterReading}
                  onChange={e => setNewMeterReading(e.target.value)}
                  placeholder={selectedReadingPump ? selectedReadingPump.last_meter_reading.toString() : '10000'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums text-[14px] font-bold focus:outline-none focus:border-purple-500"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">Litres</span>
              </div>
            </div>

            {/* Note */}
            <div className="lg:col-span-3 space-y-1">
              <label className="font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Audit Note (Optional)</label>
              <input
                type="text"
                value={readingNote}
                onChange={e => setReadingNote(e.target.value)}
                placeholder="e.g. End of morning shift audit"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-sans text-[14px] focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Submit Action */}
            <div className="lg:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-sans font-bold text-[14px] shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Log Reading</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Form Left (7 cols) & Contextual Preview Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ORDER ENTRY FORM (7 COLS) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm"
        >
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Customer Select */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Customer Account</span>
            </label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-sans font-semibold text-[14px] focus:outline-none focus:border-brand-500"
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
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Product Type</label>
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const isSelected = productId === p.id;
                const isVeg = p.id === 'veg';
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all min-h-[52px] ${
                      isSelected
                        ? isVeg
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-300 font-bold shadow-sm'
                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-900 dark:text-rose-300 font-bold shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[14px] font-sans font-bold">{p.name}</div>
                    <div className="text-[11px] font-sans opacity-80 mt-0.5">
                      {isVeg ? 'Golden Veg Oil' : 'Palm Oil / Epo Pupa'}
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
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                Threshold: ±{settings.pump_variance_threshold}L
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {pumps.map(pump => {
                const isSelected = selectedPumpId === pump.id;
                return (
                  <button
                    type="button"
                    key={pump.id}
                    onClick={() => setSelectedPumpId(pump.id)}
                    className={`p-2.5 rounded-xl border text-left text-[12px] transition-all ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-300 font-bold shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="font-sans font-bold truncate">{pump.label}</div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                      Meter: {pump.last_meter_reading.toLocaleString()}L
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
                    Prior Order Reading: <span className="font-bold">{priorPumpReading.toLocaleString()} L</span>
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
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-purple-300 dark:border-purple-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={() => setOrderMeterReading((priorPumpReading + pricing.litres).toString())}
                      className="w-full py-2 px-3 rounded-xl bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-200 text-[11px] font-sans font-bold border border-purple-300 dark:border-purple-800 transition-colors"
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
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Volume & Unit</label>
              <span className="text-[12px] font-mono tabular-nums font-bold text-brand-600 dark:text-brand-400">
                = {pricing.litres.toLocaleString()} Litres
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* 3-Way Unit Toggle */}
              <div className="sm:col-span-6 grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setUnit('keg'); if (parseFloat(qty) > 100) setQty('10'); }}
                  className={`py-2 rounded-lg text-[11px] font-sans font-bold transition-all ${
                    unit === 'keg'
                      ? 'bg-brand-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  Keg ({settings.litres_per_keg}L)
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('litre')}
                  className={`py-2 rounded-lg text-[11px] font-sans font-bold transition-all ${
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
                  className={`py-2 rounded-lg text-[11px] font-sans font-bold transition-all ${
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
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500 text-right"
                  required
                />
              </div>
            </div>

            {/* Wholesale Tonnage Outbound Shortfall Card */}
            {unit === 'ton' && (
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[12px] space-y-2">
                <div className="flex items-center justify-between text-blue-950 dark:text-blue-200 font-semibold">
                  <span>Wholesale Bulk Tonnage Sale</span>
                  <span className="font-mono tabular-nums font-bold">1 Ton = {selectedProduct.litres_per_ton}L</span>
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
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-[13px] font-mono tabular-nums focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-end">
                    {deliveredTons && parseFloat(deliveredTons) < (parseFloat(qty) || 0) ? (
                      <div className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 font-bold p-1">
                        Shortfall: {((parseFloat(qty) || 0) - parseFloat(deliveredTons)).toFixed(2)} Tons (
                        {(((parseFloat(qty) || 0) - parseFloat(deliveredTons)) * selectedProduct.litres_per_ton).toFixed(1)}L)
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
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-white transition-colors"
                >
                  +{val} {unit}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Keg Source (Only if unit === 'keg') */}
          {unit === 'keg' && (
            <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>Container / Jerrycan Source</span>
              </label>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => setKegSource('company')}
                  className={`p-3 rounded-lg border text-left transition-all min-h-[44px] ${
                    kegSource === 'company'
                      ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-900 dark:text-brand-300 font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-sans font-bold">Company-Owned Keg</div>
                  <div className="text-[11px] font-sans text-slate-500">Returnable obligation logged</div>
                </button>

                <button
                  type="button"
                  onClick={() => setKegSource('own')}
                  className={`p-3 rounded-lg border text-left transition-all min-h-[44px] ${
                    kegSource === 'own'
                      ? 'bg-brand-50 dark:bg-brand-500/15 border-brand-500 text-brand-900 dark:text-brand-300 font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="font-sans font-bold">Customer-Owned Keg</div>
                  <div className="text-[11px] font-sans text-slate-500">Bypasses keg return ledger</div>
                </button>
              </div>
            </div>
          )}

          {/* 6. Payment Method */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Payment Terms / Method</span>
            </label>
            <div className="grid grid-cols-3 gap-2 text-[12px] font-sans font-semibold">
              {(['credit', 'cash', 'transfer'] as PaymentMethod[]).map(method => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2.5 rounded-xl border capitalize transition-all min-h-[44px] ${
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

          {/* 7. Soft Warnings & Overrides */}
          {isKegShortage && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-[12px] font-sans text-amber-900 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>Depot Keg Shortage Warning</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                You requested {qty} kegs, but depot only has {kegInventory.kegsAtDepot} available.
              </p>
              <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold">
                <input
                  type="checkbox"
                  checked={overrideKegShortage}
                  onChange={e => setOverrideKegShortage(e.target.checked)}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span>Authorize Keg Dispatch Override</span>
              </label>
            </div>
          )}

          {isCreditExceeded && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/80 text-[12px] font-sans text-rose-900 dark:text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>Credit Limit Breach Warning</span>
              </div>
              <p className="text-[11px] text-rose-800 dark:text-rose-200 font-mono tabular-nums">
                Projected balance ({formatNaira(customerStats ? customerStats.currentBalance + pricing.amount : 0)})
                exceeds credit limit ({formatNaira(selectedCustomer.credit_limit)}).
              </p>
              <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold">
                <input
                  type="checkbox"
                  checked={overrideCreditLimit}
                  onChange={e => setOverrideCreditLimit(e.target.checked)}
                  className="rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                />
                <span>Authorize Credit Limit Override</span>
              </label>
            </div>
          )}

          {/* 8. Optional Note */}
          <div className="space-y-1">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">Order Note / Reference (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Dispensed into customer white cans, gate dispatch slip #890"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-sans focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* 9. Submit Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] uppercase tracking-wider shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Receipt className="w-[18px] h-[18px] text-slate-950" />
            <span>Record Dispense & Issue Official Receipt</span>
          </button>
        </form>

        {/* RIGHT COLUMN: REAL-TIME CONTEXTUAL PREVIEW (5 COLS) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Order Financial Calculation Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Order Billing Summary
              </span>
              <span className="text-[12px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                ₦{ratePerLitre.toLocaleString()}/L
              </span>
            </div>

            <div className="space-y-2 text-[12px] font-mono tabular-nums">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span className="font-sans">Customer Tier:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200 capitalize">{selectedCustomer.type}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span className="font-sans">Dispensed Volume:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{pricing.litres.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span className="font-sans">Price per {settings.litres_per_keg}L Keg:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{formatNaira(pricing.ratePerKeg)}</span>
              </div>

              {creditDueDate && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1 font-sans">
                    <Calendar className="w-3.5 h-3.5" /> Due Date ({selectedCustomer.credit_term_days}d):
                  </span>
                  <span className="font-bold">{formatDepotDate(creditDueDate)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline font-sans">
                <span className="text-[14px] font-bold text-slate-900 dark:text-white">Total Order Value:</span>
                <span className="text-[32px] font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNaira(pricing.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Credit Position Card */}
          {customerStats && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Customer Ledger Position
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-sans text-slate-500">Current Balance</div>
                  <div className="text-[16px] font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatNaira(customerStats.currentBalance)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-sans text-slate-500">Credit Limit</div>
                  <div className="text-[16px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {formatNaira(selectedCustomer.credit_limit)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active FIFO Tank Depletion Preview */}
          {activeFifoTank && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Target Tank (FIFO Sequence)
                </span>
                <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  Oldest Active
                </span>
              </div>

              <div className="flex items-center gap-4">
                <TankGauge
                  productId={productId}
                  remainingLitres={activeFifoTank.remaining_litres}
                  totalCapacityLitres={15000}
                  size="sm"
                  showLabels={false}
                />
                <div className="space-y-1 text-[12px] font-sans">
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
  );
};
