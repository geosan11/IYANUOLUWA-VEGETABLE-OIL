import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import {
  lookupRatePerLitre,
  calculateOrderPricing,
  formatNaira,
  formatDepotDate
} from '../services/businessLogic';
import { UnitType, PaymentMethod, KegSource } from '../types';
import { LITRES_PER_KEG } from '../constants/config';
import {
  ShoppingCart,
  User,
  Package,
  CreditCard,
  AlertTriangle,
  Calendar,
  AlertCircle,
  Receipt
} from 'lucide-react';

export const NewOrderScreen: React.FC = () => {
  const {
    products,
    rateCards,
    customers,
    customerStatsMap,
    kegInventory,
    tankStockByProduct,
    createNewOrder
  } = useStore();

  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || '');
  const [productId, setProductId] = useState<string>('veg');
  const [unit, setUnit] = useState<UnitType>('keg');
  const [qty, setQty] = useState<string>('10');
  const [kegSource, setKegSource] = useState<KegSource>('company');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [note, setNote] = useState<string>('');

  // Overrides for soft warnings
  const [overrideKegShortage, setOverrideKegShortage] = useState<boolean>(false);
  const [overrideCreditLimit, setOverrideCreditLimit] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCustomer = customers.find(c => c.id === customerId) || customers[0];
  const selectedProduct = products.find(p => p.id === productId) || products[0];
  const customerStats = selectedCustomer ? customerStatsMap[selectedCustomer.id] : null;

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
      LITRES_PER_KEG
    );
  }, [unit, qty, ratePerLitre]);

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
      note: note.trim() || undefined
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to process order.');
    } else {
      // Reset form fields
      setQty('10');
      setNote('');
      setOverrideKegShortage(false);
      setOverrideCreditLimit(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Context Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-400" />
            <span>Counter Dispense & New Order</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated FIFO tank draw, customer credit validation, and instant receipt generation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
            <span>Available {selectedProduct.name}:</span>{' '}
            <span className="font-bold text-amber-400">{productStock.toLocaleString()} L</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div className="font-semibold">{errorMessage}</div>
        </div>
      )}

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Order Input Parameters (lg:col-span-7) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5"
        >
          {/* Customer Selection with Inline Credit & Aging Info */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-400" />
                <span>Select Customer Account</span>
              </span>
              <span className="text-[10px] text-slate-400">
                Tier: <strong className="capitalize text-brand-400">{selectedCustomer?.type}</strong>
              </span>
            </label>

            <select
              value={customerId}
              onChange={e => {
                setCustomerId(e.target.value);
                setOverrideCreditLimit(false);
              }}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-semibold focus:outline-none focus:border-brand-500"
            >
              {customers.map(c => {
                const stats = customerStatsMap[c.id];
                const bal = stats ? stats.currentBalance : 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type}) — Bal: ₦{bal.toLocaleString()} / Limit: ₦{c.credit_limit.toLocaleString()}
                  </option>
                );
              })}
            </select>

            {/* Inline Customer Account Overview Card */}
            {selectedCustomer && customerStats && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Current Balance:</span>
                  <span className={`font-bold ${customerStats.currentBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatNaira(customerStats.currentBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Credit Limit:</span>
                  <span className="font-bold text-slate-200">
                    {formatNaira(selectedCustomer.credit_limit)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Credit Terms:</span>
                  <span className="font-bold text-slate-200">
                    {selectedCustomer.credit_term_days} Days
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Aging Status:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${customerStats.agingBadge.colorClass}`}>
                    {customerStats.agingBadge.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Select Product</label>
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const isSelected = p.id === productId;
                const stock = tankStockByProduct[p.id]?.totalLitres || 0;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? p.id === 'veg'
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm'
                          : 'bg-rose-500/15 border-rose-500/60 text-rose-300 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-100">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Stock: {stock.toLocaleString()} L
                      </div>
                    </div>
                    <div
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: p.id === 'veg' ? '#F59E0B' : '#EF4444' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity and Unit Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unit Toggle (Keg vs Litre) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Unit Type</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setUnit('keg')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    unit === 'keg'
                      ? 'bg-brand-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Keg (30L)
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('litre')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    unit === 'litre'
                      ? 'bg-brand-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Litre (Bulk)
                </button>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Dispense Quantity</span>
                <span className="text-[10px] text-brand-400 font-mono">
                  = {pricing.litres.toLocaleString()} Litres
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={unit === 'keg' ? '1' : '0.5'}
                  min="0.1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full pl-4 pr-16 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono font-bold focus:outline-none focus:border-brand-500"
                  placeholder="10"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 uppercase">
                  {unit}S
                </span>
              </div>
            </div>
          </div>

          {/* Keg Source Toggle (Only shown when unit is 'keg') */}
          {unit === 'keg' && (
            <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-brand-400" />
                  <span>Keg Container Source</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  Depot Available: <strong className="text-brand-400">{kegInventory.kegsAtDepot}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setKegSource('company')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    kegSource === 'company'
                      ? 'bg-brand-500/15 border-brand-500/60 text-brand-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-100">Company Kegs</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Return obligation added to customer ledger
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setKegSource('own')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    kegSource === 'own'
                      ? 'bg-purple-500/15 border-purple-500/60 text-purple-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-100">Customer's Own Kegs</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Bypasses keg ledger (oil volume only)
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Payment Method Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-brand-400" />
              <span>Payment Terms / Settlement Method</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['credit', 'transfer', 'cash'] as PaymentMethod[]).map(method => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    type="button"
                    key={method}
                    onClick={() => {
                      setPaymentMethod(method);
                      setOverrideCreditLimit(false);
                    }}
                    className={`py-3 px-2 rounded-xl border text-center capitalize text-xs font-bold transition-all ${
                      isSelected
                        ? method === 'credit'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>

            {/* Credit Due Date Live Preview */}
            {paymentMethod === 'credit' && creditDueDate && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs flex items-center justify-between font-mono">
                <div className="flex items-center gap-2 text-amber-300">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>Invoice Due Date ({selectedCustomer.credit_term_days} Days):</span>
                </div>
                <span className="font-bold text-amber-200">
                  {formatDepotDate(creditDueDate)}
                </span>
              </div>
            )}
          </div>

          {/* Soft Warning Banner: Keg Shortage Override */}
          {isKegShortage && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Company Keg Shortage Warning:</span>
                  Order requires {qty} kegs, but depot currently has only {kegInventory.kegsAtDepot} empty company kegs.
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-xs font-semibold text-amber-200">
                <input
                  type="checkbox"
                  checked={overrideKegShortage}
                  onChange={e => setOverrideKegShortage(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-400 bg-slate-900 border-amber-500"
                />
                <span>Owner Override: Authorize dispensation despite keg deficit</span>
              </label>
            </div>
          )}

          {/* Soft Warning Banner: Credit Limit Breach Override */}
          {isCreditExceeded && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Credit Limit Breach Warning:</span>
                  This order of {formatNaira(pricing.amount)} will push {selectedCustomer.name}'s balance to {formatNaira((customerStats?.currentBalance || 0) + pricing.amount)}, exceeding their {formatNaira(selectedCustomer.credit_limit)} limit by {formatNaira((customerStats?.currentBalance || 0) + pricing.amount - selectedCustomer.credit_limit)}.
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-xs font-semibold text-rose-200">
                <input
                  type="checkbox"
                  checked={overrideCreditLimit}
                  onChange={e => setOverrideCreditLimit(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-400 bg-slate-900 border-rose-500"
                />
                <span>Owner Override: Authorize credit extension beyond approved limit</span>
              </label>
            </div>
          )}

          {/* Optional Order Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Order Note / Reference</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Counter pickup, payment promised Friday"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Confirm & Dispense Action Button */}
          <button
            type="submit"
            disabled={isStockInsufficient}
            className={`w-full py-4 rounded-xl text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
              isStockInsufficient
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-brand-500 hover:bg-brand-400 active:scale-[0.99] shadow-brand-500/25'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>
              {isStockInsufficient
                ? 'Cannot Sell Oil (Insufficient Stock)'
                : `Confirm Dispense & Print Receipt (${formatNaira(pricing.amount)})`}
            </span>
          </button>
        </form>

        {/* Right Column: Real-time FIFO Tank Draw Visualizer & Invoice Summary (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active FIFO Tank Gauge Card */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    FIFO Tank Draw Target
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    Oldest Tank First
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {activeFifoTank
                    ? `Drawing first from: ${activeFifoTank.truck_label} (${activeFifoTank.remaining_litres.toLocaleString()}L available)`
                    : 'No active stock available for this product.'}
                </p>
              </div>

              {/* Animated liquid gauge */}
              <div className="py-2 flex justify-center">
                <TankGauge
                  productId={productId}
                  productName={selectedProduct.name}
                  remainingLitres={Math.max(0, productStock - pricing.litres)}
                  totalCapacityLitres={30000}
                  size="md"
                />
              </div>

              {/* Price Breakdown Summary */}
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Unit Rate ({selectedCustomer.type}):</span>
                  <span className="font-bold text-slate-200">
                    ₦{ratePerLitre.toLocaleString()}/L (₦{pricing.ratePerKeg.toLocaleString()}/keg)
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Volume:</span>
                  <span className="font-bold text-slate-200">{pricing.litres.toLocaleString()} L</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Payment Terms:</span>
                  <span className="uppercase font-bold text-slate-200">{paymentMethod}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                  <span>Order Total:</span>
                  <span className="text-brand-400 font-black text-lg">
                    {formatNaira(pricing.amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
