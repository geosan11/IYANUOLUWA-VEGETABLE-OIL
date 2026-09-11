import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { TruckTankIllustration } from '../components/common/TruckTankIllustration';
import { BottomSheet } from '../components/common/BottomSheet';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { Modal } from '../components/common/Modal';
import { useIsDesktopSplit } from '../hooks/useBreakpoint';
import {
  calculateIntakeMetrics,
  calculatePreKeggedIntakeMetrics,
  calculateDipstickVariance,
  formatDepotDate,
  formatDepotTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue
} from '../services/businessLogic';
import {
  CheckCircle2,
  Scale,
  ArrowDownToLine,
  Info,
  AlertTriangle,
  History,
  Ruler,
  AlertCircle,
  ChevronRight,
  ShoppingCart,
  Building2,
  Warehouse,
  FileText
} from 'lucide-react';

export const TruckIntakeScreen: React.FC = () => {
  const {
    products,
    tanks,
    suppliers,
    physicalTanks,
    kegInventory,
    settings,
    pumps,
    dipstickReadings,
    orders,
    customers,
    logTruckIntake,
    logPreKeggedIntake,
    recordDipstickReading
  } = useStore();

  const isDesktop = useIsDesktopSplit();

  const [productId, setProductId] = useState<string>('veg');
  const [supplierId, setSupplierId] = useState<string>(() => suppliers[0]?.id || '');
  const [physicalTankId, setPhysicalTankId] = useState<string>('');
  const [truckLabel, setTruckLabel] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [spaceNote, setSpaceNote] = useState<string>('');
  const [intakeDateInput, setIntakeDateInput] = useState<string>(() => toDatetimeLocalValue());

  // Bulk truck state
  const [tons, setTons] = useState<string>('');
  const [actualKegs, setActualKegs] = useState<string>('');
  const [leftoverLitres, setLeftoverLitres] = useState<string>('');

  // Pre-kegged palm state
  const [kegsReceived, setKegsReceived] = useState<string>('');

  const [newlyAddedTankId, setNewlyAddedTankId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Progressive Disclosure State for Tank Detail
  const [selectedTankForDetail, setSelectedTankForDetail] = useState<string | null>(null);

  // Tank Dipstick Verification Modal State
  const [dipstickTankId, setDipstickTankId] = useState<string | null>(null);
  const [dipstickReadingInput, setDipstickReadingInput] = useState<string>('');
  const [dipstickNotes, setDipstickNotes] = useState<string>('');
  const [dipstickError, setDipstickError] = useState<string | null>(null);

  const selectedDipstickTank = tanks.find(t => t.id === dipstickTankId);

  const liveDipstickVariance = useMemo(() => {
    if (!selectedDipstickTank || !dipstickReadingInput) return null;
    const num = parseFloat(dipstickReadingInput);
    if (isNaN(num)) return null;
    return calculateDipstickVariance(
      num,
      selectedDipstickTank.remaining_litres,
      settings.dipstick_variance_threshold
    );
  }, [selectedDipstickTank, dipstickReadingInput, settings.dipstick_variance_threshold]);

  const handleOpenDipstick = (tankId: string) => {
    setDipstickTankId(tankId);
    const t = tanks.find(tank => tank.id === tankId);
    setDipstickReadingInput(t ? t.remaining_litres.toString() : '');
    setDipstickNotes('');
    setDipstickError(null);
  };

  const handleRecordDipstickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dipstickTankId) return;
    const num = parseFloat(dipstickReadingInput);
    if (isNaN(num) || num <= 0) {
      setDipstickError('Please enter a valid positive physical dipstick reading.');
      return;
    }

    const res = recordDipstickReading({
      tankId: dipstickTankId,
      readingLitres: num,
      notes: dipstickNotes.trim() || undefined
    });

    if (res.success) {
      setDipstickTankId(null);
      setSuccessMessage(`Dipstick reading for ${selectedDipstickTank?.truck_label} recorded successfully.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } else {
      setDipstickError(res.error || 'Failed to record dipstick reading.');
    }
  };

  const selectedProduct = products.find(p => p.id === productId) || products[0];
  const isBulkTruck = selectedProduct.supply_model === 'bulk_truck';

  // Live calculation metrics for bulk truck
  const bulkMetrics = useMemo(() => {
    return calculateIntakeMetrics(
      parseFloat(tons) || 0,
      selectedProduct.litres_per_ton || 1075,
      parseFloat(actualKegs) || 0,
      parseFloat(leftoverLitres) || 0,
      kegInventory.kegsAtDepot,
      selectedProduct.litres_per_keg,
      settings.truck_shortfall_threshold
    );
  }, [tons, selectedProduct, actualKegs, leftoverLitres, kegInventory.kegsAtDepot, settings.truck_shortfall_threshold]);

  // Live calculation metrics for pre-kegged
  const preKeggedMetrics = useMemo(() => {
    return calculatePreKeggedIntakeMetrics(
      parseFloat(kegsReceived) || 0,
      selectedProduct.litres_per_keg
    );
  }, [kegsReceived, selectedProduct]);

  const isShortfallTriggered = isBulkTruck && bulkMetrics.shortfall > settings.truck_shortfall_threshold;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierId) {
      setErrorMessage('Please select a supplier for this delivery intake.');
      return;
    }

    const fullTruckLabel = driverName.trim()
      ? `${truckLabel.trim() || `TRK-${selectedProduct.name.split(' ')[0].toUpperCase()}-${Date.now().toString().slice(-4)}`} (${driverName.trim()})`
      : truckLabel.trim() || `TRK-${selectedProduct.name.split(' ')[0].toUpperCase()}-${Date.now().toString().slice(-4)}`;

    if (isBulkTruck) {
      if (!tons || parseFloat(tons) <= 0) {
        setErrorMessage('Please enter a valid tonnage for bulk offload.');
        return;
      }

      const result = logTruckIntake({
        productId,
        truckLabel: fullTruckLabel,
        supplierId,
        physicalTankId: physicalTankId || undefined,
        spaceNote: spaceNote.trim() || undefined,
        tons: parseFloat(tons) || 0,
        actualKegs: parseFloat(actualKegs) || 0,
        leftoverLitres: parseFloat(leftoverLitres) || 0,
        date: fromDatetimeLocalValue(intakeDateInput)
      });

      if (result.success && result.tank) {
        setNewlyAddedTankId(result.tank.id);
        setSuccessMessage(`Bulk offload recorded! Received ${result.tank.received_litres.toLocaleString()}L from ${suppliers.find(s => s.id === supplierId)?.name || 'Supplier'}.`);
        setTruckLabel('');
        setDriverName('');
        setTons('');
        setActualKegs('');
        setLeftoverLitres('');
        setSpaceNote('');
        setIntakeDateInput(toDatetimeLocalValue());
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(result.error || 'Failed to record truck intake.');
      }
    } else {
      // Pre-kegged flow
      const numKegs = parseFloat(kegsReceived) || 0;
      if (numKegs <= 0) {
        setErrorMessage('Please enter a valid count of kegs received.');
        return;
      }

      const result = logPreKeggedIntake({
        productId,
        truckLabel: fullTruckLabel,
        supplierId,
        physicalTankId: physicalTankId || undefined,
        spaceNote: spaceNote.trim() || undefined,
        kegsReceived: numKegs,
        date: fromDatetimeLocalValue(intakeDateInput)
      });

      if (result.success && result.tank) {
        setNewlyAddedTankId(result.tank.id);
        setSuccessMessage(`Pre-kegged delivery recorded! Received ${numKegs} kegs (${result.tank.received_litres.toLocaleString()}L) from ${suppliers.find(s => s.id === supplierId)?.name || 'Supplier'}.`);
        setTruckLabel('');
        setDriverName('');
        setKegsReceived('');
        setSpaceNote('');
        setIntakeDateInput(toDatetimeLocalValue());
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(result.error || 'Failed to record pre-kegged delivery.');
      }
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {successMessage && (
        <div role="status" aria-live="polite" className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[13px] font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div role="alert" aria-live="assertive" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 text-[13px] font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main 2-Column Counter Form & Live Preview Layout (Desktop-First) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Data Entry Form (lg:col-span-7) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Scale className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>{isBulkTruck ? 'Bulk Truck Intake Parameters' : 'Pre-Kegged Delivery Parameters'}</span>
            </h3>
            <span className="text-[12px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              1 Keg = {selectedProduct.litres_per_keg}L ({selectedProduct.name})
            </span>
          </div>

          {/* Product Select */}
          <div className="space-y-2">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Select Product Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const isSelected = p.id === productId;
                const isVeg = p.id === 'veg';
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all min-h-[52px] ${
                      isSelected
                        ? isVeg
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-300 font-bold shadow-sm'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-300 font-bold shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-[14px] font-sans font-bold">{p.name}</div>
                      <div className="text-[11px] opacity-75 font-mono tabular-nums mt-0.5">
                        {p.supply_model === 'bulk_truck'
                          ? `Bulk Truck (~${p.litres_per_ton || 1075} L/Ton)`
                          : `Pre-Kegged (${p.litres_per_keg}L/keg)`}
                      </div>
                    </div>
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Supply Model Guidance Banner */}
          <div className={`p-3.5 rounded-xl border text-[12px] flex items-start gap-2.5 ${
            isBulkTruck
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
              : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200'
          }`}>
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                {isBulkTruck ? 'Bulk Truck Model (Vegetable Oil)' : 'Pre-Kegged Model (Palm Oil)'}
              </span>
              <span className="text-[11px] opacity-90 leading-relaxed">
                {isBulkTruck
                  ? 'Delivery arrives in metric tons. We compute expected litres, offload recovered kegs + leftover, and evaluate delivery shortfall against supplier bill.'
                  : 'Delivered in physical sealed kegs from suppliers. Exact volume = Kegs × Litres/Keg. Kept in separate tank batches per supplier to avoid commingling.'}
              </span>
            </div>
          </div>

          {/* Required Supplier Selector */}
          <div className="space-y-1.5">
            <label htmlFor="intake-supplier" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Supplier Account *</span>
            </label>
            <select
              id="intake-supplier"
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[15px] font-sans font-semibold focus:outline-none focus:border-brand-500"
              required
            >
              <option value="" disabled>-- Select Supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Truck Plate and Driver Name 2-Column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="intake-truck-label" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                {isBulkTruck ? 'Truck License / Plate No. *' : 'Delivery Batch Ref / Truck Plate *'}
              </label>
              <input
                id="intake-truck-label"
                type="text"
                placeholder={isBulkTruck ? 'e.g. Truck 3 · KJA-492-XA' : 'e.g. Batch #24 · Palm Delivery'}
                value={truckLabel}
                onChange={e => setTruckLabel(e.target.value)}
                className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[15px] font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="intake-driver-name" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Driver Name / Delivery Contact
              </label>
              <input
                id="intake-driver-name"
                type="text"
                placeholder="e.g. Alhaji Musa"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[15px] font-sans font-medium focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Delivery date & time — defaults to now, editable to catch up a late entry */}
          <div className="space-y-1">
            <label htmlFor="intake-datetime" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Delivery Date &amp; Time
            </label>
            <input
              id="intake-datetime"
              type="datetime-local"
              value={intakeDateInput}
              onChange={e => setIntakeDateInput(e.target.value)}
              className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-mono focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* DUAL FLOW CONDITIONAL SECTIONS */}
          {isBulkTruck ? (
            /* BULK TRUCK TONNAGE & OFFLOAD INPUTS */
            <>
              {/* Scale Weight in Tons */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="intake-tons" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Delivery Weight (Metric Tons) *
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Density: {selectedProduct.litres_per_ton || 1075} L/Ton
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="intake-tons"
                    type="number"
                    step="0.01"
                    min="0.1"
                    placeholder="10.00"
                    value={tons}
                    inputMode="decimal"
                    onChange={e => setTons(e.target.value)}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-mono font-bold text-slate-400">
                    TONS
                  </span>
                </div>
              </div>

              {/* Physical Recovered Offload Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Actual Kegs Filled */}
                <div className="space-y-1">
                  <label htmlFor="intake-actual-kegs" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Actual Kegs Filled ({selectedProduct.litres_per_keg}L) *
                  </label>
                  <input
                    id="intake-actual-kegs"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="360"
                    value={actualKegs}
                    inputMode="numeric"
                    onChange={e => setActualKegs(e.target.value)}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>

                {/* Leftover Bulk Litres */}
                <div className="space-y-1">
                  <label htmlFor="intake-leftover-litres" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Leftover Recovered (Litres)
                  </label>
                  <input
                    id="intake-leftover-litres"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="20"
                    value={leftoverLitres}
                    inputMode="decimal"
                    onChange={e => setLeftoverLitres(e.target.value)}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[15px] focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Depot Capacity Warning Banner */}
              {bulkMetrics.exceedsDepotKegCapacity && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-[12px] font-sans text-amber-900 dark:text-amber-300 flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Depot Keg Capacity Warning</span>
                    <span>
                      Expected offload requires ~{bulkMetrics.expectedKegs.toFixed(0)} kegs, but depot only has {kegInventory.kegsAtDepot} empty kegs available.
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* PRE-KEGGED PALM DELIVERY INPUTS */
            <>
              {/* Kegs Received Count */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="intake-kegs-received" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Physical Kegs Received ({selectedProduct.litres_per_keg}L/keg) *
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums font-bold">
                    Per-Keg Standard: {selectedProduct.litres_per_keg} Litres
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="intake-kegs-received"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="100"
                    value={kegsReceived}
                    inputMode="numeric"
                    onChange={e => setKegsReceived(e.target.value)}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-mono font-bold text-slate-400">
                    KEGS
                  </span>
                </div>
              </div>

              {/* Exact Calculated Volume Callout */}
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-[13px] font-sans text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Exact Inventory Volume:
                  </span>
                  <span className="text-[18px] font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                    {preKeggedMetrics.exactLitres.toLocaleString()} Litres
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 font-mono">
                  Calculated as: {preKeggedMetrics.kegsReceived} kegs × {selectedProduct.litres_per_keg}L/keg. Direct pre-kegged offload bypasses metric ton conversion and delivery shortfall checks.
                </p>
              </div>
            </>
          )}

          {/* Physical Tank Infrastructure Link & Space Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label htmlFor="intake-physical-tank" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                <span>Physical Yard Tank Storage</span>
              </label>
              <select
                id="intake-physical-tank"
                value={physicalTankId}
                onChange={e => setPhysicalTankId(e.target.value)}
                className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans focus:outline-none focus:border-brand-500"
              >
                <option value="">-- Optional: Link Permanent Tank --</option>
                {physicalTanks
                  .filter(pt => !pt.product_id || pt.product_id === productId)
                  .map(pt => (
                    <option key={pt.id} value={pt.id}>
                      {pt.label} (Cap: {pt.capacity_litres.toLocaleString()}L)
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="intake-space-note" className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Space Note (Informational)</span>
              </label>
              <input
                id="intake-space-note"
                type="text"
                value={spaceNote}
                onChange={e => setSpaceNote(e.target.value)}
                placeholder="e.g. Filled 1.5 yard tanks, offloaded to bay 3"
                className="w-full px-4 py-3.5 min-h-[48px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[14px] font-sans placeholder-slate-400 focus:outline-none focus:border-brand-500"
              />
              <span className="text-[10px] text-slate-500 font-sans block">
                Planning note only. Does not alter exact ledger litres.
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <ArrowDownToLine className="w-[18px] h-[18px] text-slate-950" />
            <span>
              {isBulkTruck ? 'Save this tanker delivery' : 'Save this keg delivery'}
            </span>
          </button>
        </form>

        {/* Right Column: Live Reconciliation Preview & Simulation (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Volumetric Conversion Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {isBulkTruck ? 'Live delivery check' : 'Live keg count'}
              </span>
              <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold">
                {isBulkTruck ? 'Formula Verified' : 'Direct Volume'}
              </span>
            </div>

            {isBulkTruck ? (
              <div className="space-y-3 text-[12px] font-mono tabular-nums">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Expected Litres ({tons || 0}T):</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{bulkMetrics.expectedLitres.toLocaleString()} L</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Expected {selectedProduct.litres_per_keg}L Kegs:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">~{bulkMetrics.expectedKegs} kegs</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-sans">Recovered Volume:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{bulkMetrics.recoveredLitres.toLocaleString()} L</span>
                </div>

                {/* Live Shortfall Gauge / Alert */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-sans font-bold text-slate-700 dark:text-slate-300 text-[12px]">Delivery Variance:</span>
                    <span
                      className={`font-mono tabular-nums font-bold text-[14px] px-2 py-0.5 rounded-md ${
                        isShortfallTriggered
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30'
                          : bulkMetrics.shortfall > 0
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {bulkMetrics.shortfall > 0 ? `-${bulkMetrics.shortfall} L` : `${bulkMetrics.shortfall} L (Clean)`}
                    </span>
                  </div>

                  {isShortfallTriggered && (
                    <div className="mt-2 text-[11px] font-sans text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-600" />
                      <span>
                        High delivery shortfall exceeding {settings.truck_shortfall_threshold}L threshold. This will trigger an operational alert.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-[12px] font-mono tabular-nums">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Kegs received:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{preKeggedMetrics.kegsReceived} kegs</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-sans">Container Standard:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{selectedProduct.litres_per_keg} L/keg</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-sans">Batch Exact Litres:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[14px]">
                    {preKeggedMetrics.exactLitres.toLocaleString()} L
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-sans text-slate-500">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">Supplier Batch Isolation:</span>
                  <span>Palm deliveries are logged into isolated depot tank batches linked to {suppliers.find(s => s.id === supplierId)?.name || 'the selected supplier'}.</span>
                </div>
              </div>
            )}
          </div>

          {/* Live Tanker Simulation Preview */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Live Reception Simulation
              </span>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                Previewing Live Form
              </span>
            </div>
            <TruckTankIllustration
              tank={{
                id: 'sim-preview',
                product_id: productId,
                truck_label: driverName.trim()
                  ? `${truckLabel.trim() || 'RECEPTION'} (${driverName.trim()})`
                  : truckLabel.trim() || 'RECEPTION',
                tons: isBulkTruck ? parseFloat(tons) || 10 : (preKeggedMetrics.exactLitres / 1000),
                received_litres: isBulkTruck ? (bulkMetrics.recoveredLitres || 1) : (preKeggedMetrics.exactLitres || 1),
                remaining_litres: isBulkTruck ? (bulkMetrics.recoveredLitres || 1) : (preKeggedMetrics.exactLitres || 1),
                shortfall: isBulkTruck ? bulkMetrics.shortfall : 0,
                date: new Date().toISOString()
              }}
              product={selectedProduct}
              connectedPumpLabel={pumps.find(p => p.product_id === productId)?.label}
              animateOnMount={false}
            />
          </div>
        </div>
      </div>

      {/* Historical Storage Tanks & Offload Fleet */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>Depot Storage Tanks & Reception Batches</span>
            </h3>
            <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
              Active physical tank batches with supplier provenance, volume remaining, and dipstick verification status.
            </p>
          </div>
          <span className="text-[12px] font-mono tabular-nums font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
            {tanks.length} Active Storage Batches
          </span>
        </div>

        {/* Mobile Compact Tank Rows (<900px) */}
        <div className="split:hidden space-y-2.5">
          {tanks.map(t => {
            const supp = suppliers.find(s => s.id === t.supplier_id);
            const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
            const tankReadings = dipstickReadings
              .filter(d => d.tank_id === t.id)
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
            const latestReading = tankReadings[0];
            const isVeg = t.product_id === 'veg';

            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`${t.truck_label}, ${pct.toFixed(0)} percent full`}
                onClick={() => setSelectedTankForDetail(t.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTankForDetail(t.id);
                  }
                }}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 active:scale-98 transition-all cursor-pointer flex flex-col gap-2.5 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                    />
                    <span className="font-sans font-bold text-[14px] text-slate-900 dark:text-white truncate">
                      {t.truck_label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {latestReading ? (
                      latestReading.is_flagged ? (
                        <span className="flex items-center gap-1 text-[10px] font-sans font-bold text-rose-600 dark:text-rose-400">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          Variance
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-sans font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Verified
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-sans font-bold text-slate-500 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        Awaiting stick
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-sans text-slate-500">
                  {supp && (
                    <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {supp.name}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium">
                    {t.supply_model === 'pre_kegged' ? 'In kegs' : 'By tanker'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[12px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  <span>{t.remaining_litres.toLocaleString()}L / {t.received_litres.toLocaleString()}L</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">{pct.toFixed(0)}% full</span>
                </div>

                {/* Horizontal Mini Gauge */}
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isVeg ? '#F59E0B' : '#EF4444'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual Tanker Fleet Grid (Desktop ≥900px 2-Col) */}
        <div className="hidden split:grid grid-cols-1 xl:grid-cols-2 gap-5">
          {tanks.map(t => {
            const prod = products.find(p => p.id === t.product_id);
            const supp = suppliers.find(s => s.id === t.supplier_id);
            const physTank = physicalTanks.find(pt => pt.id === t.physical_tank_id);
            const connectedPump = pumps.find(p => p.product_id === t.product_id);
            const tankReadings = dipstickReadings
              .filter(d => d.tank_id === t.id)
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
            const latestReading = tankReadings[0];

            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`${prod?.name || 'Tank'}, inspect audit history`}
                onClick={() => setSelectedTankForDetail(t.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTankForDetail(t.id);
                  }
                }}
                className="flex flex-col space-y-2 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-brand-400 dark:hover:border-brand-600/70 hover:shadow-md transition-all cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                title="Click to inspect tank audit history & orders drawn in side drawer"
              >
                <div className="flex items-center justify-between text-[11px] px-1 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {prod?.name}
                    </span>
                    {supp && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-sans font-medium">
                        {supp.name}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-sans font-bold">
                      {t.supply_model === 'pre_kegged' ? 'In kegs' : `${t.tons}T tanker`}
                    </span>
                  </div>
                  <span className="text-brand-600 dark:text-brand-400 font-bold group-hover:underline flex items-center gap-1">
                    Inspect Drawer <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <TruckTankIllustration
                  tank={t}
                  product={prod}
                  connectedPumpLabel={connectedPump ? connectedPump.label : undefined}
                  animateOnMount={t.id === newlyAddedTankId}
                />

                {/* Storage & Space Note Metadata */}
                {(physTank || t.space_note) && (
                  <div className="px-2 py-1 text-[11px] font-sans text-slate-500 flex items-center gap-3">
                    {physTank && (
                      <span className="flex items-center gap-1">
                        <Warehouse className="w-3 h-3 text-slate-400" />
                        Storage: <strong className="text-slate-700 dark:text-slate-300">{physTank.label}</strong>
                      </span>
                    )}
                    {t.space_note && (
                      <span className="truncate italic">
                        &ldquo;{t.space_note}&rdquo;
                      </span>
                    )}
                  </div>
                )}

                {/* Physical Dipstick Verification Strip */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800/80 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                      <Ruler className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[12px] font-sans font-semibold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>Physical Dipstick Audit</span>
                        {latestReading ? (
                          latestReading.is_flagged ? (
                            <span className="text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                              VARIANCE {(latestReading.variance ?? 0) > 0 ? `+${latestReading.variance}` : (latestReading.variance ?? 0)}L
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                              VERIFIED ({(latestReading.variance ?? 0) > 0 ? `+${latestReading.variance}` : (latestReading.variance ?? 0)}L)
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            Awaiting First Stick
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {latestReading
                          ? `Stick: ${latestReading.reading_litres.toLocaleString()} L · System: ${(latestReading.system_litres ?? t.remaining_litres).toLocaleString()} L · ${formatDepotDate(latestReading.recorded_at)} ${formatDepotTime(latestReading.recorded_at)}`
                          : `System volume: ${t.remaining_litres.toLocaleString()} L`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDipstick(t.id);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-sans font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-slate-700/80 transition-all text-slate-700 dark:text-slate-200 shadow-sm shrink-0"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    Record Dipstick
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Record Physical Tank Dipstick Verification */}
      {dipstickTankId && selectedDipstickTank && (
        <Modal
          isOpen
          onClose={() => setDipstickTankId(null)}
          size="lg"
          title={
            <span className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                <Ruler className="w-5 h-5" />
              </span>
              <span>Physical Tank Dipstick Audit</span>
            </span>
          }
          subtitle={selectedDipstickTank.truck_label}
        >
            <form onSubmit={handleRecordDipstickSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-[12px] font-sans text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  Physical Stick vs Depot Ledger
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Dipstick measurement verifies the actual physical liquid level inside the storage tank against the cumulative ledger volume. Variances exceeding {settings.dipstick_variance_threshold}L trigger a supervisor alert.
                </p>
              </div>

              {dipstickError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[12px] font-sans text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{dipstickError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Ledger Balance
                  </span>
                  <span className="text-[16px] font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {selectedDipstickTank.remaining_litres.toLocaleString()} L
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Product
                  </span>
                  <span className="text-[14px] font-sans font-semibold text-brand-600 dark:text-brand-400">
                    {selectedDipstickTank.product_id === 'veg' ? 'Golden Vegetable Oil' : 'Industrial Palm Oil'}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="dipstick-reading" className="block text-[12px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Dipstick Reading (Litres) *
                </label>
                <div className="relative">
                  <input
                    id="dipstick-reading"
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={dipstickReadingInput}
                    onChange={e => setDipstickReadingInput(e.target.value)}
                    placeholder="e.g. 3250"
                    className="w-full px-3.5 py-3 min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-3 text-[12px] font-mono text-slate-400">
                    Litres
                  </span>
                </div>
              </div>

              {/* Live Variance Calculation Preview */}
              {liveDipstickVariance && (
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    liveDipstickVariance.isOverThreshold
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[12px] font-sans">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Measurement Variance:
                    </span>
                    <span
                      className={`font-mono tabular-nums font-bold text-[14px] ${
                        liveDipstickVariance.isOverThreshold
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {liveDipstickVariance.variance > 0
                        ? `+${liveDipstickVariance.variance.toLocaleString()} L`
                        : `${liveDipstickVariance.variance.toLocaleString()} L`}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-sans flex items-center gap-1.5">
                    {liveDipstickVariance.isOverThreshold ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="text-rose-700 dark:text-rose-300">
                          Variance exceeds ±{settings.dipstick_variance_threshold}L threshold. Will be flagged for supervisor check.
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-300">
                          Variance within normal tolerance (±{settings.dipstick_variance_threshold}L).
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="dipstick-notes" className="block text-[12px] font-sans font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Dip Notes / Stick Condition (Optional)
                </label>
                <input
                  id="dipstick-notes"
                  type="text"
                  value={dipstickNotes}
                  onChange={e => setDipstickNotes(e.target.value)}
                  placeholder="e.g., Morning dip, cold temperature, calibrated brass tape"
                  className="w-full px-3.5 py-3 min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDipstickTankId(null)}
                  className="px-4 py-2.5 text-[13px] font-sans font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-[13px] font-sans font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save Physical Dipstick Reading
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* Tank Detail Progressive Disclosure */}
      {(() => {
        const selectedTank = tanks.find(t => t.id === selectedTankForDetail);
        const selectedProduct = products.find(p => p.id === selectedTank?.product_id);
        const selectedSupplier = suppliers.find(s => s.id === selectedTank?.supplier_id);
        const selectedPump = pumps.find(p => p.product_id === selectedTank?.product_id);
        const tankDipsticks = selectedTank
          ? dipstickReadings
              .filter(d => d.tank_id === selectedTank.id)
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
          : [];
        const latestDipstick = tankDipsticks[0];

        const drawnOrders = selectedTank
          ? orders
              .filter(o => o.product_id === selectedTank.product_id)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 8)
          : [];

        const TankContainer = isDesktop ? SlideOverDrawer : BottomSheet;

        return (
          <TankContainer
            isOpen={!!selectedTankForDetail}
            onClose={() => setSelectedTankForDetail(null)}
            title={selectedTank?.truck_label || 'Tank Storage Details'}
            subtitle={
              selectedProduct
                ? `${selectedProduct.name} · ${selectedSupplier ? `${selectedSupplier.name} · ` : ''}${selectedTank?.remaining_litres.toLocaleString()}L Remaining`
                : ''
            }
          >
            {selectedTank && selectedProduct && (
              <div className="space-y-6">
                {/* Tank Illustration Preview */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                  <TruckTankIllustration
                    tank={selectedTank}
                    product={selectedProduct}
                    connectedPumpLabel={selectedPump?.label}
                    animateOnMount={false}
                  />
                </div>

                {/* Provenance & Supply Model strip */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[11px] font-sans text-slate-500 block uppercase">Supplier</span>
                    <span className="font-bold text-slate-900 dark:text-white text-[13px]">
                      {selectedSupplier?.name || 'Direct Depot Intake'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-sans text-slate-500 block uppercase">Intake Model</span>
                    <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                      {selectedTank.supply_model === 'pre_kegged' ? 'In kegs' : 'By tanker'}
                    </span>
                  </div>
                </div>

                {/* Storage Metrics Row */}
                <div className="grid grid-cols-2 gap-3 font-mono tabular-nums text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-sans text-slate-500 block uppercase">Received Capacity</span>
                    <span className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                      {selectedTank.received_litres.toLocaleString()} L
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-sans text-slate-500 block uppercase">Available Stock</span>
                    <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedTank.remaining_litres.toLocaleString()} L
                    </span>
                  </div>
                </div>

                {selectedTank.space_note && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-[11px] font-sans text-slate-500 uppercase block mb-0.5">Yard Space Note:</span>
                    <span className="font-sans text-slate-800 dark:text-slate-200 italic">
                      &ldquo;{selectedTank.space_note}&rdquo;
                    </span>
                  </div>
                )}

                {/* Physical Dipstick Verification Strip & Quick Action */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-sans font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Ruler className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <span>Physical Dipstick Status</span>
                    </span>
                    {latestDipstick ? (
                      latestDipstick.is_flagged ? (
                        <span className="text-[10px] font-mono tabular-nums font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                          VARIANCE {(latestDipstick.variance ?? 0) > 0 ? `+${latestDipstick.variance}` : (latestDipstick.variance ?? 0)}L
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono tabular-nums font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          VERIFIED ({(latestDipstick.variance ?? 0) > 0 ? `+${latestDipstick.variance}` : (latestDipstick.variance ?? 0)}L)
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded">
                        Awaiting First Stick
                      </span>
                    )}
                  </div>

                  <div className="text-[12px] font-mono tabular-nums text-slate-600 dark:text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Current System Ledger:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedTank.remaining_litres.toLocaleString()} L
                      </span>
                    </div>
                    {latestDipstick && (
                      <div className="flex justify-between">
                        <span>Last Physical Stick:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {latestDipstick.reading_litres.toLocaleString()} L ({formatDepotDate(latestDipstick.recorded_at)} {formatDepotTime(latestDipstick.recorded_at)})
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedTank.id;
                      setSelectedTankForDetail(null);
                      handleOpenDipstick(id);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[13px] font-sans font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                  >
                    <Ruler className="w-4 h-4" />
                    <span>Record Physical Dipstick Audit</span>
                  </button>
                </div>

                {/* Orders Drawn from this Tank / Product Batch */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-semibold text-[14px] text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Recent Orders Drawn</span>
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      {drawnOrders.length} recent
                    </span>
                  </div>

                  {drawnOrders.length > 0 ? (
                    <div className="space-y-2">
                      {drawnOrders.map(order => {
                        const cust = customers.find(c => c.id === order.customer_id);
                        return (
                          <div
                            key={order.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="font-sans font-semibold text-slate-900 dark:text-slate-200">
                                {cust?.name || 'Customer'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {formatDepotDate(order.date)} {formatDepotTime(order.date)} · {order.qty} pack{order.qty === 1 ? '' : 's'} · {order.payment_method}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                -{(order.litres || 0).toLocaleString()} L
                              </span>
                              <span className="text-[10px] text-slate-500 uppercase font-sans">Dispensed</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs font-sans">
                      No customer orders drawn from this product batch yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </TankContainer>
        );
      })()}
    </div>
  );
};
