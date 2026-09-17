import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { BottomSheet } from '../components/common/BottomSheet';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { useIsDesktopSplit } from '../hooks/useBreakpoint';
import {
  calculateIntakeMetrics,
  calculatePreKeggedIntakeMetrics,
  formatDepotDate,
  formatDepotTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  formatWithCommas,
  parseFromCommas
} from '../services/businessLogic';
import {
  CheckCircle,
  Warning as AlertTriangle,
  Scales,
  ArrowLineDown,
  Info,
  WarningCircle,
  CaretRight,
  CaretDown,
  ArrowsClockwise,
  Truck,
  Drop,
  Warehouse,
  Receipt,
  ArrowRight,
  SlidersHorizontal,
  ShieldCheck,
  GasPump
} from '@phosphor-icons/react';

export const TruckIntakeScreen: React.FC = () => {
  const {
    products,
    tanks,
    suppliers,
    physicalTanks,
    kegInventory,
    settings,
    orders,
    customers,
    logTruckIntake,
    logPreKeggedIntake
  } = useStore();

  const isDesktop = useIsDesktopSplit();

  // Progressive Disclosure View Mode
  // 'log_intake': Immediate, focused truck logging workspace (zero distraction)
  // 'tanks_history': Full storage facility telemetry, tank fill gauges & 48h audit history
  const [activeView, setActiveView] = useState<'log_intake' | 'tanks_history'>('log_intake');

  // Form State
  const [productId, setProductId] = useState<string>('veg');
  const [supplierId, setSupplierId] = useState<string>(() => suppliers[0]?.id || '');
  const [physicalTankId, setPhysicalTankId] = useState<string>(() => physicalTanks[0]?.id || '');
  const [driverName, setDriverName] = useState<string>('');
  const [spaceNote, setSpaceNote] = useState<string>('');
  const [intakeDateInput, setIntakeDateInput] = useState<string>(() => toDatetimeLocalValue());

  // Bulk truck state (zero decimals: integers)
  const [tons, setTons] = useState<string>('10');
  const [actualKegs, setActualKegs] = useState<string>('358');
  const [leftoverLitres, setLeftoverLitres] = useState<string>('10');

  // Pre-kegged palm state
  const [kegsReceived, setKegsReceived] = useState<string>('100');

  // Progressive disclosure states inside form
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isChangingTank, setIsChangingTank] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Progressive Disclosure State for Tank Detail Drawer
  const [selectedTankForDetail, setSelectedTankForDetail] = useState<string | null>(null);

  const selectedProduct = products.find(p => p.id === productId) || products[0];
  const isBulkTruck = selectedProduct.supply_model === 'bulk_truck';

  // Live calculation metrics for bulk truck
  const bulkMetrics = useMemo(() => {
    return calculateIntakeMetrics(
      parseInt(tons, 10) || 0,
      selectedProduct.litres_per_ton || 1075,
      parseFromCommas(actualKegs) || 0,
      parseInt(leftoverLitres, 10) || 0,
      kegInventory.kegsAtDepot,
      selectedProduct.litres_per_keg,
      settings.truck_shortfall_threshold
    );
  }, [tons, selectedProduct, actualKegs, leftoverLitres, kegInventory.kegsAtDepot, settings.truck_shortfall_threshold]);

  // Live calculation metrics for pre-kegged
  const preKeggedMetrics = useMemo(() => {
    return calculatePreKeggedIntakeMetrics(
      parseFromCommas(kegsReceived) || 0,
      selectedProduct.litres_per_keg
    );
  }, [kegsReceived, selectedProduct]);

  // Derived Telemetry
  const totalDepotLitres = useMemo(() => {
    return tanks.reduce((sum, t) => sum + (t.remaining_litres || 0), 0);
  }, [tanks]);

  const totalDepotCapacity = useMemo(() => {
    const physCap = physicalTanks.reduce((sum, pt) => sum + (pt.capacity_litres || 0), 0);
    if (physCap > 0) return physCap;
    return tanks.reduce((sum, t) => sum + (t.received_litres || 0), 0) || 60000;
  }, [physicalTanks, tanks]);

  const depotFullPercentage = Math.min(
    100,
    Math.round((totalDepotLitres / (totalDepotCapacity || 1)) * 100)
  );

  const shiftTotalLoss = useMemo(() => {
    return tanks.reduce((sum, t) => sum + (t.shortfall || 0), 0);
  }, [tanks]);

  // Reset form
  const handleResetForm = () => {
    setTons('10');
    setActualKegs('358');
    setLeftoverLitres('10');
    setKegsReceived('100');
    setDriverName('');
    setSpaceNote('');
    setIntakeDateInput(toDatetimeLocalValue());
    setShowAdvancedOptions(false);
    setIsChangingTank(false);
    setErrorMessage(null);
  };

  const handleSelectOil = (id: string) => {
    setProductId(id);
    if (id === 'veg') {
      const vegTank = physicalTanks.find(pt => pt.product_id === 'veg') || physicalTanks[0];
      if (vegTank) setPhysicalTankId(vegTank.id);
      setTons('10');
      setActualKegs('358');
      setLeftoverLitres('10');
    } else {
      // Palm oil arrives pre-kegged — it isn't decanted into a yard tank,
      // so there's no physical tank to associate with this delivery.
      setPhysicalTankId('');
      setKegsReceived('100');
    }
  };

  const handleAdjustTons = (delta: number) => {
    const curr = parseInt(tons, 10) || 0;
    const next = Math.max(1, curr + delta);
    setTons(next.toString());
  };

  const handleAdjustKegsReceived = (delta: number) => {
    const curr = parseFromCommas(kegsReceived) || 0;
    const next = Math.max(1, curr + delta);
    setKegsReceived(formatWithCommas(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!supplierId) {
      setErrorMessage('Please select a supplier for this delivery intake.');
      return;
    }

    const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'Supplier';
    const autoTruckLabel = `${supplierName} Truck-${Date.now().toString().slice(-4)}`;
    const fullTruckLabel = driverName.trim() ? `${autoTruckLabel} (${driverName.trim()})` : autoTruckLabel;

    setIsSubmitting(true);

    try {
      if (isBulkTruck) {
        const parsedTons = parseInt(tons, 10);
        if (!parsedTons || parsedTons <= 0) {
          setErrorMessage('Please enter a valid tonnage for bulk offload.');
          setIsSubmitting(false);
          return;
        }

        const result = logTruckIntake({
          productId,
          truckLabel: fullTruckLabel,
          supplierId,
          physicalTankId: physicalTankId || undefined,
          spaceNote: spaceNote.trim() || undefined,
          tons: parsedTons,
          actualKegs: parseFromCommas(actualKegs) || 0,
          leftoverLitres: parseInt(leftoverLitres, 10) || 0,
          date: fromDatetimeLocalValue(intakeDateInput)
        });

        if (result.success && result.tank) {
          setSuccessMessage(`${parsedTons} Tons (${result.tank.received_litres.toLocaleString()}L) logged for ${fullTruckLabel} from ${supplierName}. Store stock updated.`);
          handleResetForm();
          setTimeout(() => setSuccessMessage(null), 6000);
        } else {
          setErrorMessage(result.error || 'Failed to record truck intake.');
        }
      } else {
        const numKegs = parseFromCommas(kegsReceived) || 0;
        if (numKegs <= 0) {
          setErrorMessage('Please enter a valid count of kegs received.');
          setIsSubmitting(false);
          return;
        }

        const result = logPreKeggedIntake({
          productId,
          truckLabel: fullTruckLabel,
          supplierId,
          spaceNote: spaceNote.trim() || undefined,
          kegsReceived: numKegs,
          date: fromDatetimeLocalValue(intakeDateInput)
        });

        if (result.success && result.tank) {
          setSuccessMessage(`Pre-kegged delivery recorded! Received ${numKegs} kegs (${result.tank.received_litres.toLocaleString()}L) from ${supplierName}.`);
          handleResetForm();
          setTimeout(() => setSuccessMessage(null), 6000);
        } else {
          setErrorMessage(result.error || 'Failed to record pre-kegged delivery.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSelectedTank = physicalTanks.find(pt => pt.id === physicalTankId) || physicalTanks[0];
  const currentTankLitres = tanks
    .filter(t => t.physical_tank_id === currentSelectedTank?.id || t.id === 'tank-01')
    .reduce((s, t) => s + t.remaining_litres, 0) || 15435;
  const currentTankPct = currentSelectedTank?.capacity_litres
    ? Math.min(100, Math.round((currentTankLitres / currentSelectedTank.capacity_litres) * 100))
    : 50;

  return (
    <div className="w-full text-slate-900 dark:text-slate-100 max-w-[1600px] mx-auto space-y-6 pb-16 font-sans">
      
      {/* ── TOP HEADER WITH VIEW SWITCHER (PROGRESSIVE DISCLOSURE) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Inbound Logistics &amp; Stock Delivery
            </span>
          </div>
          <h1 className="text-2xl font-heading font-extrabold text-slate-900 dark:text-white tracking-tight">
            Truck Delivery Intake
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log incoming bulk oil deliveries and verify against supplier waybill.
          </p>
        </div>

        {/* View Switcher: Staff can focus on immediate function (Log Delivery) or inspect facility telemetry */}
        <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-1 self-start sm:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => setActiveView('log_intake')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'log_intake'
                ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4 text-amber-500" weight="bold" />
            <span>Log Delivery</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('tanks_history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'tanks_history'
                ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Warehouse className="w-4 h-4 text-slate-400" weight="bold" />
            <span>Storage Tanks &amp; Audit Log</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300">
              {physicalTanks.length || tanks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-200 text-sm font-sans font-bold flex items-center gap-3 animate-in fade-in sticky top-4 z-40 shadow-lg backdrop-blur-md"
        >
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" weight="bold" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-500 text-rose-950 dark:text-rose-200 text-sm font-sans font-bold flex items-center gap-3 animate-in fade-in sticky top-4 z-40 shadow-lg backdrop-blur-md"
        >
          <WarningCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" weight="bold" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VIEW 1: FOCUSED INTAKE WORKSPACE (IMMEDIATE FUNCTION)
         ══════════════════════════════════════════════════════════════════ */}
      {activeView === 'log_intake' && (
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* ── THE DELIVERY INTAKE FORM (FOCUSED OPERATIONAL HERO) ── */}
          <div className="depot-card p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-6 shadow-md bg-white dark:bg-slate-900">
            
            {/* Form Title & Reset Button */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/80 inline-block mb-1">
                  Immediate Function: Yard Offload
                </span>
                <h2 className="font-heading text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-500" weight="bold" />
                  <span>Log Arrived Delivery</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter waybill figures to verify offload volume and update store stock.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetForm}
                title="Clear form inputs"
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <ArrowsClockwise className="w-3.5 h-3.5" weight="bold" />
                <span>Reset</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* 1. Oil Cargo Selection (Clean, High-Affordance Segmented Selector) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  1. Select Oil Cargo Type
                </label>
                <div className="grid grid-cols-2 gap-3 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSelectOil('veg')}
                    className={`py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      productId === 'veg'
                        ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm border-2 border-amber-500'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-2 border-transparent'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${productId === 'veg' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                    <span>Golden Veg Oil (Bulk Tanker)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectOil('red')}
                    className={`py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      productId === 'red'
                        ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm border-2 border-amber-500'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-2 border-transparent'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${productId === 'red' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                    <span>Red Palm Oil (25L Pre-Kegged)</span>
                  </button>
                </div>
              </div>

              {/* 2. Supplier & Driver Information */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  2. Delivery Supplier &amp; Truck Driver
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Supplier Select Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="supplierSelect" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Supplier / Refinery <span className="text-amber-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="supplierSelect"
                        value={supplierId}
                        onChange={e => setSupplierId(e.target.value)}
                        className="w-full h-12 pl-3.5 pr-10 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs hover:border-slate-400 dark:hover:border-slate-600 appearance-none cursor-pointer"
                        required
                      >
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <CaretDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" weight="bold" />
                    </div>
                  </div>

                  {/* Driver Name Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="driverNameInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Truck Driver Name (Optional)
                    </label>
                    <input
                      id="driverNameInput"
                      type="text"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      placeholder="e.g. Musa Abdullahi"
                      className="w-full h-12 px-3.5 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs hover:border-slate-400 dark:hover:border-slate-600 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Delivery Weight & Calculated Volume */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  3. Waybill Quantity &amp; Calculated Expected Litres
                </label>

                {isBulkTruck ? (
                  /* Bulk Tanker (Scale Weight Tonnage) */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                      {/* Scale Weight Input with Steppers */}
                      <div className="sm:col-span-6 space-y-1.5">
                        <label htmlFor="tonsInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Scale Weight in Tons <span className="text-amber-500 font-bold">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustTons(-1)}
                            className="h-12 w-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-700 font-bold text-lg text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer select-none active:scale-95"
                            title="Decrease by 1 ton"
                          >
                            −
                          </button>

                          <div className="relative flex-1">
                            <input
                              id="tonsInput"
                              type="number"
                              min="1"
                              step="1"
                              value={tons}
                              onChange={e => setTons(e.target.value.replace(/[^0-9]/g, ''))}
                              className="w-full h-12 pl-4 pr-16 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums text-2xl font-black focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs hover:border-slate-400 dark:hover:border-slate-600"
                              placeholder="10"
                              required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-500 dark:text-slate-400 pointer-events-none">
                              TONS
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAdjustTons(1)}
                            className="h-12 w-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-700 font-bold text-lg text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer select-none active:scale-95"
                            title="Increase by 1 ton"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Calculated Volume - Clearly Demarcated as Read-Only Output */}
                      <div className="sm:col-span-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[72px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                            Calculated Volume (Read-only)
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            1,075 L / TON
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-2xl font-extrabold text-slate-950 dark:text-white mt-1">
                          {bulkMetrics.expectedLitres.toLocaleString()} L
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Equivalent to ~{bulkMetrics.expectedKegs} standard 25L company kegs.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Pre-Kegged Palm Oil */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                      {/* Received Keg Count Input with Steppers */}
                      <div className="sm:col-span-6 space-y-1.5">
                        <label htmlFor="kegsReceivedInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Pre-Kegged 25L Kegs Received <span className="text-amber-500 font-bold">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustKegsReceived(-10)}
                            className="h-12 w-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer select-none active:scale-95"
                            title="Decrease by 10 kegs"
                          >
                            −10
                          </button>

                          <div className="relative flex-1">
                            <input
                              id="kegsReceivedInput"
                              type="text"
                              inputMode="numeric"
                              value={kegsReceived}
                              onChange={e => setKegsReceived(formatWithCommas(e.target.value))}
                              className="w-full h-12 pl-4 pr-16 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums text-2xl font-black focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs hover:border-slate-400 dark:hover:border-slate-600"
                              placeholder="100"
                              required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-500 dark:text-slate-400 pointer-events-none">
                              KEGS
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAdjustKegsReceived(10)}
                            className="h-12 w-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer select-none active:scale-95"
                            title="Increase by 10 kegs"
                          >
                            +10
                          </button>
                        </div>
                      </div>

                      {/* Calculated Volume - Clearly Demarcated as Read-Only Output */}
                      <div className="sm:col-span-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[72px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                            Calculated Volume (Read-only)
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            25 L / KEG
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-2xl font-extrabold text-slate-950 dark:text-white mt-1">
                          {preKeggedMetrics.exactLitres.toLocaleString()} L
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Standard 25L company kegs ready for yard inventory.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Target Tank & Counted Kegs Verification — bulk tanker deliveries only.
                     Pre-kegged palm oil isn't decanted into a yard tank, so there's
                     nothing to select here for that flow. */}
              {isBulkTruck && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    4. Receiving Tank &amp; Offload Verification
                  </label>

                  {/* Target Tank Confirmation with Progressive Disclosure */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Warehouse className="w-4 h-4 text-slate-500" />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-500 mr-1.5">Receiving Tank:</span>
                        <strong className="font-bold text-slate-900 dark:text-white">
                          {currentSelectedTank?.label || 'Main Tank 1'}
                        </strong>
                        <span className="font-mono text-slate-500 ml-2">
                          ({currentTankLitres.toLocaleString()} L · {currentTankPct}% full)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsChangingTank(!isChangingTank)}
                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {isChangingTank ? 'Done' : 'Change Tank'}
                    </button>
                  </div>

                  {/* Progressive Disclosure for Tank Selection */}
                  {isChangingTank && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in">
                      {physicalTanks.map(pt => (
                        <label
                          key={pt.id}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-2.5 ${
                            physicalTankId === pt.id
                              ? 'bg-white dark:bg-slate-800 border-amber-500 shadow-xs'
                              : 'bg-white/60 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="targetTank"
                            value={pt.id}
                            checked={physicalTankId === pt.id}
                            onChange={() => setPhysicalTankId(pt.id)}
                            className="accent-amber-500 w-4 h-4"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-900 dark:text-white">{pt.label}</div>
                            <div className="text-slate-500 font-mono text-[11px]">{pt.capacity_litres.toLocaleString()} L capacity</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Counted Filled Kegs for Bulk Truck */}
                  <div className="space-y-1.5 pt-1">
                    <label htmlFor="kegCountInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Counted Filled 25L Kegs Offloaded at Discharge Point <span className="text-amber-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="kegCountInput"
                        type="text"
                        inputMode="numeric"
                        value={actualKegs}
                        onChange={e => setActualKegs(formatWithCommas(e.target.value))}
                        placeholder="358"
                        className="w-full h-12 pl-4 pr-16 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono tabular-nums text-2xl font-black focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 shadow-xs hover:border-slate-400 dark:hover:border-slate-600"
                        required
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-500 dark:text-slate-400 pointer-events-none">
                        KEGS
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Actual count of 25L jerrycans filled directly during tanker discharge.
                    </span>
                  </div>
                </div>
              )}

              {/* 5. Live Waybill Reconciliation Summary (Integrated directly above submit) */}
              <div className="pt-2">
                {isBulkTruck ? (
                  <div className={`p-4 rounded-xl border-2 transition-all space-y-2 ${
                    bulkMetrics.shortfall > settings.truck_shortfall_threshold
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-900 dark:text-rose-200'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Scales className="w-4 h-4" />
                        <span>Live Offload Reconciliation:</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-black shadow-xs ${
                        bulkMetrics.shortfall > settings.truck_shortfall_threshold
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {bulkMetrics.shortfall > settings.truck_shortfall_threshold
                          ? `⚠️ Shortfall: -${bulkMetrics.shortfall} L`
                          : `✅ ${bulkMetrics.shortfall === 0 ? '0 L (Balanced)' : `${Math.abs(bulkMetrics.shortfall)} L within tolerance`}`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs font-mono pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>Waybill Expected: <strong>{bulkMetrics.expectedLitres.toLocaleString()} L</strong></span>
                      <span>Physical Recovered: <strong>{bulkMetrics.recoveredLitres.toLocaleString()} L</strong></span>
                      <span>Variance: <strong>{bulkMetrics.shortfall > 0 ? `-${bulkMetrics.shortfall} L` : '0 L'}</strong></span>
                    </div>

                    {bulkMetrics.shortfall > settings.truck_shortfall_threshold && (
                      <p className="text-[11px] font-sans font-semibold text-rose-700 dark:text-rose-300 mt-1">
                        Notice: Deficit exceeds standard ±{settings.truck_shortfall_threshold}L tolerance. Please notify Supervisor before signing the waybill.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" weight="bold" />
                      <span>100% Pre-Kegged 25L Verification:</span>
                    </div>
                    <span className="font-mono text-xs font-black">
                      {preKeggedMetrics.exactLitres.toLocaleString()} Litres ({kegsReceived || 0} kegs)
                    </span>
                  </div>
                )}
              </div>

              {/* Big, Unmistakable Submit Action Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer border border-amber-400 disabled:opacity-50"
              >
                <ArrowLineDown className="w-5 h-5 text-slate-950" weight="bold" />
                <span>Confirm &amp; Record Delivery Intake</span>
              </button>
            </form>

            {/* Progressive Disclosure Section 1: Secondary Offload Options (Slop, Timestamp, Yard Note) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none transition-colors"
              >
                <CaretRight className={`w-3.5 h-3.5 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} weight="bold" />
                <span>Additional Options (Pipe Residual, Timestamp Override, Yard Note)</span>
              </button>

              {showAdvancedOptions && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border-2 border-slate-200 dark:border-slate-800 animate-in fade-in">
                  {isBulkTruck && (
                    <div className="space-y-1.5">
                      <label htmlFor="slopVolumeInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Pipe Residual / Slop (Litres)
                      </label>
                      <div className="relative">
                        <input
                          id="slopVolumeInput"
                          type="number"
                          step="1"
                          min="0"
                          value={leftoverLitres}
                          onChange={e => setLeftoverLitres(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full h-11 px-3.5 pr-14 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
                          placeholder="0"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[11px] text-slate-400">
                          LITRES
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">Residual oil in discharge hose or drain tray.</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="intakeDateInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Delivery Timestamp Override
                    </label>
                    <input
                      id="intakeDateInput"
                      type="datetime-local"
                      value={intakeDateInput}
                      onChange={e => setIntakeDateInput(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400">Leave default for real-time delivery stamp.</span>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="spaceNoteInput" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Yard Receiving / Quality Notes
                    </label>
                    <input
                      id="spaceNoteInput"
                      type="text"
                      value={spaceNote}
                      onChange={e => setSpaceNote(e.target.value)}
                      placeholder="e.g. Tanker seal intact, clear gold clarity test passed, hose drained"
                      className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Progressive Disclosure Section 2: SOP & Tolerance Rules */}
            <details className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 group cursor-pointer">
              <summary className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 list-none select-none flex items-center gap-1.5 transition-colors">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                <span>Offload tolerance rules &amp; standard operating procedure</span>
                <CaretRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90 ml-auto" />
              </summary>
              <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" weight="bold" />
                  <span>Normal Tolerance: Within ±50 Litres of waybill is automatic pass.</span>
                </div>
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" weight="bold" />
                  <span>Shortfall Alert: If deficit exceeds 50 Litres, notify Supervisor before signing waybill.</span>
                </div>
              </div>
            </details>

          </div>

          {/* ── RECENT DELIVERIES (COMPACT PROGRESSIVE FOOTER) ── */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-slate-500" />
              <span className="text-slate-500 dark:text-slate-400">
                Latest logged: <strong className="text-slate-800 dark:text-slate-200">{tanks[0]?.truck_label || 'No recent delivery'}</strong>
                {tanks[0] && <span className="font-mono text-slate-500 ml-1.5">(+{tanks[0].received_litres.toLocaleString()} L)</span>}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('tanks_history')}
              className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>View storage tanks &amp; delivery ledger ({tanks.length})</span>
              <ArrowRight className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VIEW 2: STORAGE TANKS & FULL AUDIT LOG (DISCLOSED ON DEMAND)
         ══════════════════════════════════════════════════════════════════ */}
      {activeView === 'tanks_history' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Top Summary Telemetry Strip (Restrained, elegant enterprise design) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Depot Total Stock */}
            <div className="depot-card p-4 flex items-center justify-between border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <Drop className="w-4 h-4 text-amber-500" weight="fill" />
                  <span className="font-sans text-xs font-semibold">Total Oil In Stock</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono tabular-nums text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                    {totalDepotLitres.toLocaleString()}
                  </span>
                  <span className="font-sans text-xs font-semibold text-slate-500">litres</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${depotFullPercentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {depotFullPercentage}% capacity
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Warehouse className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 2: Tankers in Yard */}
            <div className="depot-card p-4 flex items-center justify-between border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <Truck className="w-4 h-4 text-slate-500" weight="bold" />
                  <span className="font-sans text-xs font-semibold">Active Tankers</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono tabular-nums text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                    {Math.max(1, Math.min(3, tanks.length))}
                  </span>
                  <span className="font-sans text-xs font-semibold text-slate-500">In Facility</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Bay 01 Offloading</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Truck className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 3: Shift Shortfall / Gain */}
            <div className="depot-card p-4 flex items-center justify-between border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <Scales className="w-4 h-4 text-slate-500" weight="bold" />
                  <span className="font-sans text-xs font-semibold">Shift Loss / Gain</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-mono tabular-nums text-3xl font-black tracking-tight ${
                    shiftTotalLoss > settings.truck_shortfall_threshold
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-950 dark:text-white'
                  }`}>
                    {shiftTotalLoss > 0 ? `-${shiftTotalLoss}` : '0'}
                  </span>
                  <span className="font-sans text-xs font-semibold text-slate-500">litres</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold">
                  {shiftTotalLoss <= settings.truck_shortfall_threshold ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" weight="bold" />
                      <span>Within ±50L Tolerance</span>
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" weight="bold" />
                      <span>Exceeds Tolerance</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 4: Main Manifold */}
            <div className="depot-card p-4 flex items-center justify-between border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <SlidersHorizontal className="w-4 h-4 text-slate-500" weight="bold" />
                  <span className="font-sans text-xs font-semibold">Offload Manifold</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-heading text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                    Bay 01 Open
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-slate-500">
                  <span>Valves Cleared &amp; Ready</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <GasPump className="w-6 h-6" />
              </div>
            </div>

          </section>

          {/* Physical Storage Tanks Bento Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Store Oil Storage Tanks
                </h2>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Live physical volume, capacity percentages, and batch provenance.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                {physicalTanks.length} Tanks Calibrated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {physicalTanks.map((pt, idx) => {
                const liveLitres = tanks
                  .filter(t => t.physical_tank_id === pt.id || t.id === `tank-0${idx + 1}`)
                  .reduce((s, t) => s + t.remaining_litres, 0) || (idx === 0 ? 15435 : 10750);
                const pct = Math.min(100, Math.round((liveLitres / pt.capacity_litres) * 100));
                const sup = suppliers[idx % suppliers.length];

                return (
                  <div key={pt.id} className="depot-card p-5 flex flex-col justify-between border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Drop className="w-4 h-4 text-amber-500" weight="fill" />
                            <span className="font-sans text-xs font-bold text-slate-900 dark:text-white">
                              {pt.label}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono tabular-nums text-3xl font-black text-slate-950 dark:text-white">
                              {liveLitres.toLocaleString()}
                            </span>
                            <span className="font-mono text-sm font-bold text-slate-500">L</span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Capacity: {pt.capacity_litres.toLocaleString()} Litres
                          </span>
                        </div>

                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {pct}% full
                        </span>
                      </div>

                      {/* Level Progress Bar */}
                      <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700 mb-4">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Provenance Details */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Primary Supplier:</span>
                          <strong className="text-slate-900 dark:text-white">{sup?.name || 'Refinery Direct'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Last Batch:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {liveLitres.toLocaleString()} L
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Ready for Dispensing</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedTankForDetail(tanks[idx]?.id || `tank-0${idx + 1}`)}
                        className="font-sans font-bold text-slate-700 dark:text-slate-200 hover:text-amber-600 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
                      >
                        <span>Audit history</span>
                        <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Deliveries & Audit Log (Last 48h) */}
          <div className="depot-card p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" />
                <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white">
                  Shift Deliveries &amp; Audit Log
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {tanks.length} total deliveries logged
              </span>
            </div>

            <div className="space-y-2.5">
              {tanks.map(t => {
                const sup = suppliers.find(s => s.id === t.supplier_id);
                const prod = products.find(p => p.id === t.product_id);
                const isMatch = (t.shortfall || 0) <= settings.truck_shortfall_threshold;

                return (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        <span className="text-sm leading-none">{t.tons ? `${t.tons}T` : 'KEG'}</span>
                        <span className="text-[9px] uppercase mt-0.5">{prod?.id || 'OIL'}</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <strong className="font-heading text-sm font-bold text-slate-900 dark:text-white">
                            {sup?.name || t.truck_label}
                          </strong>
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {t.truck_label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                          <span>{formatDepotDate(t.date)} {formatDepotTime(t.date)}</span>
                          <span>·</span>
                          <span>{prod?.name || 'Oil'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="font-mono tabular-nums text-base font-bold text-slate-950 dark:text-white block">
                          +{t.received_litres.toLocaleString()} L
                        </span>
                        <span className="text-[11px] text-slate-500 font-sans font-medium">
                          {t.remaining_litres.toLocaleString()} L remaining
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full font-mono text-xs font-bold flex items-center gap-1 ${
                        isMatch
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      }`}>
                        {isMatch ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" weight="bold" />
                            <span>{(t.shortfall || 0) === 0 ? '0 L match' : `-${t.shortfall} L`}</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" weight="bold" />
                            <span>-{t.shortfall} L flag</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SLIDE-OVER DRAWER / BOTTOM SHEET FOR TANK AUDIT DETAIL
         ══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const selectedTank = tanks.find(t => t.id === selectedTankForDetail) || tanks[0];
        const selectedTankProduct = products.find(p => p.id === selectedTank?.product_id) || products[0];
        const selectedTankSupplier = suppliers.find(s => s.id === selectedTank?.supplier_id);

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
            title={selectedTank?.truck_label || 'Tank storage details'}
            subtitle={
              selectedTankProduct
                ? `${selectedTankProduct.name} · ${selectedTankSupplier ? `${selectedTankSupplier.name} · ` : ''}${selectedTank?.remaining_litres?.toLocaleString()}L Remaining`
                : ''
            }
          >
            {selectedTank && selectedTankProduct && (
              <div className="space-y-6 font-sans">
                {/* Provenance & Supply Model strip */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-xs font-sans text-slate-500 block">Supplier</span>
                    <span className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                      {selectedTankSupplier?.name || 'Direct Delivery'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-sans text-slate-500 block">Intake model</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-sans font-semibold text-xs">
                      {selectedTank.supply_model === 'pre_kegged' ? 'Pre-kegged 25L' : 'Bulk tanker'}
                    </span>
                  </div>
                </div>

                {/* Storage Metrics Row */}
                <div className="grid grid-cols-2 gap-3 font-mono tabular-nums text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-sans text-slate-500 block">Received capacity</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedTank.received_litres.toLocaleString()} L
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-sans text-slate-500 block">Available stock</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedTank.remaining_litres.toLocaleString()} L
                    </span>
                  </div>
                </div>

                {selectedTank.space_note && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-xs font-sans text-slate-500 block mb-0.5">Yard placement note</span>
                    <span className="font-sans text-slate-800 dark:text-slate-200 italic">
                      &ldquo;{selectedTank.space_note}&rdquo;
                    </span>
                  </div>
                )}

                {/* Orders Drawn from this Tank / Product Batch */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-amber-500" />
                      <span>Recent sales dispensed from this tank</span>
                    </h4>
                    <span className="text-xs font-mono text-slate-500">
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
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="font-sans font-bold text-slate-900 dark:text-slate-200">
                                {cust?.name || 'Customer'}
                              </div>
                              <div className="text-xs text-slate-500 font-mono">
                                {formatDepotDate(order.date)} {formatDepotTime(order.date)} · {order.qty} pack{order.qty === 1 ? '' : 's'} · {order.payment_method}
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-black text-slate-900 dark:text-slate-100 block">
                                -{(order.litres || 0).toLocaleString()} L
                              </span>
                              <span className="text-xs text-slate-500 uppercase font-sans font-semibold">Dispensed</span>
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
