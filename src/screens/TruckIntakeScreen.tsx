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
  ArrowsClockwise,
  Truck,
  Drop,
  Warehouse,
  Receipt,
  ArrowRight,
  Sparkle,
  GasPump,
  ShieldCheck,
  SlidersHorizontal
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

  // Form State
  const [productId, setProductId] = useState<string>('veg');
  const [supplierId, setSupplierId] = useState<string>(() => suppliers[0]?.id || '');
  const [physicalTankId, setPhysicalTankId] = useState<string>(() => physicalTanks[0]?.id || '');
  const [truckLabel, setTruckLabel] = useState<string>('KTU-882-XD');
  const [driverName, setDriverName] = useState<string>('');
  const [spaceNote, setSpaceNote] = useState<string>('');
  const [intakeDateInput, setIntakeDateInput] = useState<string>(() => toDatetimeLocalValue());

  // Bulk truck state (zero decimals: integers)
  const [tons, setTons] = useState<string>('10');
  const [actualKegs, setActualKegs] = useState<string>('358');
  const [leftoverLitres, setLeftoverLitres] = useState<string>('10');

  // Pre-kegged palm state
  const [kegsReceived, setKegsReceived] = useState<string>('100');

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
    setTruckLabel('KTU-882-XD');
    setDriverName('');
    setSpaceNote('');
    setIntakeDateInput(toDatetimeLocalValue());
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
      const palmTank = physicalTanks.find(pt => pt.product_id === 'palm') || physicalTanks[1] || physicalTanks[0];
      if (palmTank) setPhysicalTankId(palmTank.id);
      setKegsReceived('100');
    }
  };

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
          const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'Supplier';
          setSuccessMessage(`${parsedTons} Tons (${result.tank.received_litres.toLocaleString()}L) logged for ${truckLabel || 'Tanker'} from ${supplierName}. Telemetry and depot stock synced.`);
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
          physicalTankId: physicalTankId || undefined,
          spaceNote: spaceNote.trim() || undefined,
          kegsReceived: numKegs,
          date: fromDatetimeLocalValue(intakeDateInput)
        });

        if (result.success && result.tank) {
          const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'Supplier';
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

  return (
    <div className="w-full text-slate-900 dark:text-slate-100 max-w-[1680px] mx-auto space-y-6 pb-16 font-sans">
      {/* Toast Feedback */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-200 text-sm font-sans font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 sticky top-4 z-40 shadow-xl backdrop-blur-md"
        >
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" weight="bold" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-500 text-rose-950 dark:text-rose-200 text-sm font-sans font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 sticky top-4 z-40 shadow-xl backdrop-blur-md"
        >
          <WarningCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" weight="bold" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TOP SUMMARY TELEMETRY STRIP (4 MODERN CARDS)
         ══════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Depot Total Stock */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#E6DECF] dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
              <Drop className="w-4 h-4 text-emerald-600 dark:text-emerald-400" weight="fill" />
              <span className="font-mono text-xs uppercase font-extrabold tracking-wider">Depot Total Stock</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono tabular-nums text-3xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
                {totalDepotLitres.toLocaleString()}
              </span>
              <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase">
                LITRES
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${depotFullPercentage}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                {depotFullPercentage}% Depot Full
              </span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Warehouse className="w-7 h-7" weight="duotone" />
            <span className="text-[9px] font-mono font-black uppercase mt-0.5">
              {physicalTanks.length || tanks.length} Tanks
            </span>
          </div>
        </div>

        {/* KPI 2: Tankers in Yard */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#E6DECF] dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
              <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" weight="fill" />
              <span className="font-mono text-xs uppercase font-extrabold tracking-wider">Tankers in Yard</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono tabular-nums text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {Math.max(1, Math.min(3, tanks.length))}
              </span>
              <span className="font-sans text-xs font-bold text-slate-600 dark:text-slate-400">
                Active Trucks
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[11px] font-mono font-extrabold">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Bay 01 Active
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                +1 Queued
              </span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col items-center justify-center text-amber-600 dark:text-amber-400">
            <Truck className="w-7 h-7" weight="duotone" />
            <span className="text-[9px] font-mono font-black uppercase mt-0.5">Offload</span>
          </div>
        </div>

        {/* KPI 3: Shift Loss / Gain */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#E6DECF] dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
              <Scales className="w-4 h-4 text-slate-600 dark:text-slate-400" weight="fill" />
              <span className="font-mono text-xs uppercase font-extrabold tracking-wider">Shift Loss / Gain</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-mono tabular-nums text-3xl sm:text-4xl font-black tracking-tight ${
                shiftTotalLoss > settings.truck_shortfall_threshold
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-950 dark:text-white'
              }`}>
                {shiftTotalLoss > 0 ? `-${shiftTotalLoss}` : '0'}
              </span>
              <span className="font-mono text-xs font-black text-slate-500 uppercase">
                LITRES
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-sans font-bold">
              {shiftTotalLoss <= settings.truck_shortfall_threshold ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" weight="bold" />
                  <span>Safe (Within 50L Limit)</span>
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" weight="bold" />
                  <span>Exceeds Tolerance</span>
                </span>
              )}
            </div>
          </div>
          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border ${
            shiftTotalLoss <= settings.truck_shortfall_threshold
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400'
          }`}>
            <ShieldCheck className="w-7 h-7" weight="duotone" />
            <span className="text-[9px] font-mono font-black uppercase mt-0.5">Audit OK</span>
          </div>
        </div>

        {/* KPI 4: Main Manifold */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-[#E6DECF] dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
              <SlidersHorizontal className="w-4 h-4 text-brand-500" weight="bold" />
              <span className="font-mono text-xs uppercase font-extrabold tracking-wider">Main Manifold</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="font-heading text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                Bay 01 Open
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-sans font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" weight="bold" />
              <span>Flow Unlocked & Ready</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 flex flex-col items-center justify-center text-brand-600 dark:text-brand-400">
            <GasPump className="w-7 h-7" weight="duotone" />
            <span className="text-[9px] font-mono font-black uppercase mt-0.5">Ready</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN ASYMMETRIC 12-COLUMN WORK SURFACE
         ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ──────────────────────────────────────────────────────────────
            LEFT PANEL (5 Cols): Streamlined Step-by-Step Intake Wizard
           ────────────────────────────────────────────────────────────── */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E6DECF] dark:border-slate-800 p-6 shadow-sm flex flex-col relative">
            
            {/* Header with Visual Tag and Reset */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-mono text-xs font-bold uppercase border border-brand-200 dark:border-brand-800">
                    <Truck className="w-3.5 h-3.5" weight="bold" />
                    <span>Tanker Inbound</span>
                  </span>
                  <span className="font-mono text-xs text-slate-500 font-bold">
                    #TK-{Date.now().toString().slice(-4)}
                  </span>
                </div>
                <h1 className="font-heading text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                  Log Incoming Oil Tanker
                </h1>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select oil type, enter waybill weight, and verify physical keg count.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetForm}
                title="Reset Form"
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-700"
              >
                <ArrowsClockwise className="w-4 h-4" weight="bold" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ── STEP 1: Choose Oil Cargo ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-500 text-slate-950 font-heading text-xs font-black flex items-center justify-center shadow-sm">
                      1
                    </span>
                    <span className="font-heading text-sm text-slate-950 dark:text-white font-extrabold uppercase tracking-wide">
                      Step 1: Choose Oil Cargo
                    </span>
                  </div>
                  <span className="text-[11px] font-sans font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Sparkle className="w-3.5 h-3.5" weight="fill" />
                    <span>Calibrated Density</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3" id="oilTypeSelector">
                  {/* Golden Veg Oil Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectOil('veg')}
                    className={`p-4 rounded-xl text-left transition-all flex flex-col justify-between relative overflow-hidden border-2 ${
                      productId === 'veg'
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 shadow-sm'
                        : 'bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <Drop className="w-5 h-5" weight="fill" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-extrabold uppercase ${
                        productId === 'veg'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {productId === 'veg' ? 'Selected' : 'Select'}
                      </span>
                    </div>
                    <span className="font-heading text-base font-extrabold text-slate-950 dark:text-white block">
                      Golden Veg Oil
                    </span>
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-700 dark:text-amber-400 font-mono font-bold">
                      <Scales className="w-3.5 h-3.5" weight="bold" />
                      <span>1,075 L / Ton (25L Kegs)</span>
                    </div>
                  </button>

                  {/* Crude Palm Oil Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectOil('palm')}
                    className={`p-4 rounded-xl text-left transition-all flex flex-col justify-between relative overflow-hidden border-2 ${
                      productId === 'palm'
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500 shadow-sm'
                        : 'bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <Drop className="w-5 h-5" weight="duotone" />
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-extrabold uppercase ${
                        productId === 'palm'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {productId === 'palm' ? 'Selected' : 'Select'}
                      </span>
                    </div>
                    <span className="font-heading text-base font-extrabold text-slate-950 dark:text-white block">
                      Crude Palm Oil
                    </span>
                    <div className="flex items-center gap-1 mt-1 text-xs text-rose-700 dark:text-rose-400 font-mono font-bold">
                      <Scales className="w-3.5 h-3.5" weight="bold" />
                      <span>1,120 L / Ton (25L Kegs)</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* ── STEP 2: Delivery Waybill & Volume ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-500 text-slate-950 font-heading text-xs font-black flex items-center justify-center shadow-sm">
                    2
                  </span>
                  <span className="font-heading text-sm text-slate-950 dark:text-white font-extrabold uppercase tracking-wide">
                    Step 2: Delivery Waybill &amp; Volume
                  </span>
                </div>

                {/* Supplier & Truck Plate Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="supplierSelect" className="font-sans text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                      <span>Supplier Company</span>
                    </label>
                    <select
                      id="supplierSelect"
                      value={supplierId}
                      onChange={e => setSupplierId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-sm font-sans font-semibold text-slate-950 dark:text-white focus:outline-none focus:border-brand-500"
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="truckNumber" className="font-sans text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Truck Plate Number</span>
                    </label>
                    <input
                      id="truckNumber"
                      type="text"
                      value={truckLabel}
                      onChange={e => setTruckLabel(e.target.value)}
                      placeholder="e.g. KTU-882-XD"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-sm font-mono font-black text-slate-950 dark:text-white uppercase focus:outline-none focus:border-brand-500 placeholder-slate-400"
                      required
                    />
                  </div>
                </div>

                {/* Visual Conversion Pipeline Card */}
                {isBulkTruck ? (
                  <div className="bg-[#FAF6ED]/70 dark:bg-slate-950/80 border-2 border-[#E6DECF] dark:border-slate-800 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-extrabold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Scales className="w-4 h-4 text-amber-500" weight="bold" />
                        <span>Scale Weight (Tons)</span>
                      </span>
                      <span className="font-mono font-extrabold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                        <span>Calculated Volume</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      {/* Tonnage Input (Integer, Zero Decimals) */}
                      <div className="relative">
                        <input
                          id="tonnageInput"
                          type="number"
                          step="1"
                          min="1"
                          max="60"
                          value={tons}
                          onChange={e => setTons(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-950 dark:text-white font-mono tabular-nums text-3xl font-black rounded-xl p-3 pr-16 focus:outline-none focus:border-brand-500 shadow-inner"
                          required
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex flex-col items-center">
                          <span className="font-mono font-black text-[11px] text-slate-400">TONS</span>
                        </div>
                      </div>

                      {/* Large Glanceable Display */}
                      <div className="flex flex-col justify-center px-4 py-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans font-bold uppercase tracking-wider flex items-center gap-1">
                          <Drop className="w-3 h-3 text-amber-500" weight="fill" />
                          <span>Net Liquid Litres</span>
                        </span>
                        <span className="font-mono tabular-nums text-2xl sm:text-3xl text-amber-600 dark:text-amber-400 font-black tracking-tight" id="expectedLitresDisplay">
                          {bulkMetrics.expectedLitres.toLocaleString()} L
                        </span>
                      </div>
                    </div>

                    {/* Jerrycan & Keg conversion bar */}
                    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 font-black">
                          <Warehouse className="w-4 h-4" />
                        </div>
                        <span className="font-sans font-bold text-slate-800 dark:text-slate-200">
                          Expected Keg Equivalent:
                        </span>
                      </div>
                      <span className="text-emerald-700 dark:text-emerald-300 font-mono font-black text-xs px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800">
                        ~{bulkMetrics.expectedKegs} kegs (25L)
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Pre-kegged Palm Model Input */
                  <div className="bg-[#FAF6ED]/70 dark:bg-slate-950/80 border-2 border-[#E6DECF] dark:border-slate-800 p-4 rounded-2xl space-y-3">
                    <label htmlFor="kegsReceived" className="font-sans text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                       <span>Count of Sealed Kegs Received (25L each)</span>
                       <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">1 Keg = 25L</span>
                    </label>
                    <div className="relative">
                      <input
                        id="kegsReceived"
                        type="text"
                        inputMode="numeric"
                        value={kegsReceived}
                        onChange={e => setKegsReceived(formatWithCommas(e.target.value))}
                        placeholder="100"
                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 text-slate-950 dark:text-white font-mono tabular-nums text-3xl font-black rounded-xl p-3 pr-16 focus:outline-none focus:border-brand-500 shadow-inner"
                        required
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-black text-[11px] text-slate-400">
                        KEGS
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="font-sans font-medium text-slate-600 dark:text-slate-400">Total Net Palm Volume:</span>
                      <span className="font-mono tabular-nums text-base font-black text-rose-600 dark:text-rose-400">
                        {preKeggedMetrics.exactLitres.toLocaleString()} Litres
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── STEP 3: Tank Check & Keg Count ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-500 text-slate-950 font-heading text-xs font-black flex items-center justify-center shadow-sm">
                      3
                    </span>
                    <span className="font-heading text-sm text-slate-950 dark:text-white font-extrabold uppercase tracking-wide">
                      Step 3: Tank Check &amp; Keg Count
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-mono text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    Ready to Pump
                  </span>
                </div>

                {/* Receiving Tank Selector Radio Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {physicalTanks.slice(0, 2).map((pt, idx) => {
                    const isSelected = physicalTankId === pt.id;
                    const liveLitres = tanks
                      .filter(t => t.physical_tank_id === pt.id || t.id === `tank-0${idx + 1}`)
                      .reduce((s, t) => s + t.remaining_litres, 0) || (idx === 0 ? 15435 : 10750);
                    const pct = Math.min(100, Math.round((liveLitres / pt.capacity_litres) * 100));

                    return (
                      <label
                        key={pt.id}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-brand-50/50 dark:bg-brand-950/30 border-brand-500 shadow-sm'
                            : 'bg-slate-50/60 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="targetTank"
                          value={pt.id}
                          checked={isSelected}
                          onChange={() => setPhysicalTankId(pt.id)}
                          className="mt-1 accent-brand-500 w-4 h-4"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-heading text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {pt.label}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-brand-600 dark:text-brand-400 font-bold mt-0.5">
                            {liveLitres.toLocaleString()} L · {pct}% Full
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Offload Counters (Counted Kegs + Residual Slop) */}
                {isBulkTruck && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="kegCountInput" className="font-sans text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Warehouse className="w-3.5 h-3.5 text-amber-500" />
                        <span>Counted Filled Kegs</span>
                      </label>
                      <div className="relative">
                        <input
                          id="kegCountInput"
                          type="text"
                          inputMode="numeric"
                          value={actualKegs}
                          onChange={e => setActualKegs(formatWithCommas(e.target.value))}
                          placeholder="358"
                          className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white font-mono tabular-nums text-xl sm:text-2xl font-black p-3 pr-14 rounded-xl focus:outline-none focus:border-brand-500"
                          required
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-xs text-slate-400">
                          KEGS
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="slopVolumeInput" className="font-sans text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Drop className="w-3.5 h-3.5 text-emerald-500" weight="fill" />
                        <span>Pipe Slop / Residual</span>
                      </label>
                      <div className="relative">
                        <input
                          id="slopVolumeInput"
                          type="number"
                          step="1"
                          min="0"
                          value={leftoverLitres}
                          onChange={e => setLeftoverLitres(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-slate-950 dark:text-white font-mono tabular-nums text-xl sm:text-2xl font-black p-3 pr-14 rounded-xl focus:outline-none focus:border-brand-500"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-xs text-slate-400">
                          LITRES
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visual Balance Equation Formula Box */}
                {isBulkTruck && (
                  <div className={`p-4 rounded-xl border-2 flex items-center justify-between mt-2 shadow-sm transition-colors ${
                    bulkMetrics.shortfall > settings.truck_shortfall_threshold
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                      : bulkMetrics.shortfall > 0
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        bulkMetrics.shortfall > settings.truck_shortfall_threshold
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                          : bulkMetrics.shortfall > 0
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {bulkMetrics.shortfall > settings.truck_shortfall_threshold ? (
                          <AlertTriangle className="w-5 h-5" weight="bold" />
                        ) : (
                          <CheckCircle className="w-5 h-5" weight="bold" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-xs font-heading font-extrabold text-slate-900 dark:text-white">
                          <Scales className="w-3.5 h-3.5 text-brand-500" />
                          <span>Physical Match Equation</span>
                        </div>
                        <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 font-bold mt-0.5">
                          Recovered: {bulkMetrics.recoveredLitres.toLocaleString()} L vs Expected: {bulkMetrics.expectedLitres.toLocaleString()} L
                        </span>
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full font-mono text-xs font-black shadow-sm ${
                      bulkMetrics.shortfall > settings.truck_shortfall_threshold
                        ? 'bg-rose-600 text-white'
                        : bulkMetrics.shortfall > 0
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      {bulkMetrics.shortfall > 0
                        ? `-${bulkMetrics.shortfall} L Short`
                        : `${Math.abs(bulkMetrics.shortfall)} L (Balanced)`}
                    </span>
                  </div>
                )}
              </div>

              {/* Big Action Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 rounded-2xl bg-brand-500 hover:bg-brand-600 active:scale-[0.99] text-slate-950 font-heading font-black text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 transition-all cursor-pointer border border-brand-400 disabled:opacity-50"
              >
                <ArrowLineDown className="w-6 h-6 text-slate-950" weight="bold" />
                <span>CONFIRM INTAKE &amp; PUMP TO TANK</span>
              </button>
            </form>

            {/* Friendly Pictorial SOP Accordion */}
            <details className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 group cursor-pointer">
              <summary className="flex items-center justify-between font-mono font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors list-none select-none">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500" />
                  <span>Depot Offload Rules &amp; SOP (Tap to expand)</span>
                </div>
                <CaretRight className="w-4 h-4 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" weight="bold" />
                  <span><strong>Normal Tolerance:</strong> Within ±50 Litres of waybill is automatic pass.</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" weight="bold" />
                  <span><strong>Shortfall Alert:</strong> If deficit &gt; 50 Litres, call Supervisor before signing waybill.</span>
                </div>
              </div>
            </details>

          </div>
        </section>

        {/* ──────────────────────────────────────────────────────────────
            RIGHT PANEL (7 Cols): Visual Depot Tanks & Shift Audit Log
           ────────────────────────────────────────────────────────────── */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                Depot Physical Tanks
              </h2>
              <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live level meniscus gauges, batch provenance, and remaining ullage.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-bold">
                LIVE TELEMETRY
              </span>
            </div>
          </div>

          {/* Storage Tanks Bento Layout with Sleek Meniscus Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Tank 01 (Golden Veg Oil) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E6DECF] dark:border-slate-800 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div>
                {/* Tank Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Drop className="w-4 h-4 text-amber-500" weight="fill" />
                      <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-extrabold uppercase tracking-wider">
                        Yard Tank 01
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-mono text-[10px] font-extrabold">
                        Golden Veg
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono tabular-nums text-3xl font-black text-slate-950 dark:text-white block tracking-tight">
                        {tanks[0]?.remaining_litres?.toLocaleString() || '15,435'}
                      </span>
                      <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                        L
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 font-bold mt-0.5">
                      Capacity: 16,000 Litres
                    </span>
                  </div>

                  <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 font-mono text-xs font-bold flex items-center gap-1 shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" weight="bold" />
                    <span>0 L Loss</span>
                  </div>
                </div>

                {/* Visual Liquid Meniscus Cross-Section Tank Diagram */}
                <div className="mb-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center text-xs font-bold mb-2">
                    <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1 font-sans">
                      <Drop className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                      <span>Oil Level Meniscus</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[11px]">
                        Empty Space: <strong>565 L</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-extrabold text-xs shadow-sm">
                        96.5% FULL
                      </span>
                    </div>
                  </div>

                  {/* Physical Tank Cutout Graphic with animated wave */}
                  <div className="relative w-full h-12 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-300 dark:border-slate-700 shadow-inner flex items-center">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 relative transition-all duration-500 flex items-center justify-end pr-2 overflow-hidden shadow-sm"
                      style={{ width: '96.5%' }}
                    >
                      <div className="absolute inset-0 bg-white/20 flex items-center justify-around pointer-events-none animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white/40" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                        <span className="w-2.5 h-2.5 rounded-full bg-white/40" />
                      </div>
                      <Drop className="w-4 h-4 text-slate-950 relative z-10" weight="fill" />
                    </div>
                    {/* Scale Tick Marks */}
                    <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300">
                      <span>0%</span>
                      <span className="border-r border-slate-400/50 h-3" />
                      <span>50%</span>
                      <span className="border-r border-slate-400/50 h-3" />
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* Tank Provenance Summary */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl flex flex-col gap-2 text-xs border border-slate-200 dark:border-slate-800/80 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                      <Warehouse className="w-3.5 h-3.5" /> Supplier:
                    </span>
                    <span className="text-slate-900 dark:text-white font-extrabold">
                      {suppliers[0]?.name || 'Presco Oil Plc'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" /> Current Tanker:
                    </span>
                    <span className="text-slate-900 dark:text-white font-mono font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                      AAA-123-XB
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5" /> Last Batch:
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono font-bold">
                      16,125 L
                    </span>
                  </div>
                </div>
              </div>

              {/* Tank Footnote */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Ready For Dispense</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTankForDetail(tanks[0]?.id || 'tank-01')}
                  className="font-sans font-bold text-slate-800 dark:text-slate-200 hover:text-brand-500 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  <span>Log History</span>
                  <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                </button>
              </div>
            </div>

            {/* Tank 02 (Reserve Veg Oil) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E6DECF] dark:border-slate-800 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div>
                {/* Tank Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Drop className="w-4 h-4 text-amber-500" weight="fill" />
                      <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-extrabold uppercase tracking-wider">
                        Yard Tank 02
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-mono text-[10px] font-extrabold">
                        Reserve Veg
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono tabular-nums text-3xl font-black text-slate-950 dark:text-white block tracking-tight">
                        {tanks[1]?.remaining_litres?.toLocaleString() || '10,750'}
                      </span>
                      <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                        L
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 font-bold mt-0.5">
                      Capacity: 20,000 Litres
                    </span>
                  </div>

                  <div className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-300 font-mono text-xs font-bold flex items-center gap-1 shadow-sm">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" weight="bold" />
                    <span>-20 L Flag</span>
                  </div>
                </div>

                {/* Visual Liquid Meniscus Tank Diagram */}
                <div className="mb-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center text-xs font-bold mb-2">
                    <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1 font-sans">
                      <Drop className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                      <span>Oil Level Meniscus</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono text-[11px]">
                        Empty Space: <strong>9,250 L</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-extrabold text-xs shadow-sm">
                        53.7% FULL
                      </span>
                    </div>
                  </div>

                  {/* Physical Tank Cutout Graphic */}
                  <div className="relative w-full h-12 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-300 dark:border-slate-700 shadow-inner flex items-center">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 relative transition-all duration-500 flex items-center justify-end pr-2 overflow-hidden shadow-sm"
                      style={{ width: '53.7%' }}
                    >
                      <div className="absolute inset-0 bg-white/20 flex items-center justify-around pointer-events-none animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white/40" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      </div>
                      <Drop className="w-4 h-4 text-slate-950 relative z-10" weight="fill" />
                    </div>
                    {/* Scale Tick Marks */}
                    <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300">
                      <span>0%</span>
                      <span className="border-r border-slate-400/50 h-3" />
                      <span>50%</span>
                      <span className="border-r border-slate-400/50 h-3" />
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* Tank Provenance Summary */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl flex flex-col gap-2 text-xs border border-slate-200 dark:border-slate-800/80 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                      <Warehouse className="w-3.5 h-3.5" /> Supplier:
                    </span>
                    <span className="text-slate-900 dark:text-white font-extrabold">
                      {suppliers[1]?.name || 'Grand Cereals Ltd'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" /> Current Tanker:
                    </span>
                    <span className="text-slate-900 dark:text-white font-mono font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                      KJA-492-XA
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5" /> Last Batch:
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono font-bold">
                      10,750 L
                    </span>
                  </div>
                </div>
              </div>

              {/* Tank Footnote */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Offloading Ready</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTankForDetail(tanks[1]?.id || 'tank-02')}
                  className="font-sans font-bold text-slate-800 dark:text-slate-200 hover:text-brand-500 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  <span>Log History</span>
                  <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                </button>
              </div>
            </div>

          </div>

          {/* ── Shift Inbound Deliveries & Audit Log ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E6DECF] dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <Receipt className="w-4 h-4" weight="bold" />
                </div>
                <h3 className="font-heading text-base font-extrabold text-slate-950 dark:text-white">
                  Shift Inbound Deliveries &amp; Audit Log
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500 font-bold">
                Last 48 Hours
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Row 1: Balanced Delivery */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex flex-col items-center justify-center text-amber-700 dark:text-amber-400 font-mono font-black">
                    <span className="text-sm leading-none">15T</span>
                    <span className="text-[9px] uppercase mt-0.5">VEG</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-extrabold text-slate-900 dark:text-white">
                        {suppliers[0]?.name || 'Presco Oil Plc'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono font-bold bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        WB-9014
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        AAA-123-XB
                      </span>
                      <span>·</span>
                      <span>Golden Veg Oil</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-mono tabular-nums text-base font-black text-slate-950 dark:text-white block">
                      16,125 L
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono font-bold">
                      537 Kegs
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 font-mono text-xs font-black shadow-sm flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" weight="bold" />
                    <span>0 L Match</span>
                  </span>
                </div>
              </div>

              {/* Row 2: Shortfall Delivery */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex flex-col items-center justify-center text-amber-700 dark:text-amber-400 font-mono font-black">
                    <span className="text-sm leading-none">10T</span>
                    <span className="text-[9px] uppercase mt-0.5">VEG</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-extrabold text-slate-900 dark:text-white">
                        {suppliers[1]?.name || 'Grand Cereals Ltd'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono font-bold bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        WB-9022
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        KJA-492-XA
                      </span>
                      <span>·</span>
                      <span>Golden Veg Oil</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-mono tabular-nums text-base font-black text-slate-950 dark:text-white block">
                      10,730 L
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono font-bold">
                      357 Kegs
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-300 font-mono text-xs font-black shadow-sm flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" weight="bold" />
                    <span>-20 L Flag</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

        </section>

      </div>

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
            title={selectedTank?.truck_label || 'Tank Storage Details'}
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
                    <span className="text-xs font-sans text-slate-500 block uppercase">Supplier</span>
                    <span className="font-heading font-extrabold text-slate-900 dark:text-white text-sm">
                      {selectedTankSupplier?.name || 'Direct Depot Intake'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-sans text-slate-500 block uppercase">Intake Model</span>
                    <span className="px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-mono font-bold uppercase tracking-wider text-xs border border-brand-200 dark:border-brand-800">
                      {selectedTank.supply_model === 'pre_kegged' ? 'In kegs' : 'By tanker'}
                    </span>
                  </div>
                </div>

                {/* Storage Metrics Row */}
                <div className="grid grid-cols-2 gap-3 font-mono tabular-nums text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-sans text-slate-500 block uppercase">Received Capacity</span>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {selectedTank.received_litres.toLocaleString()} L
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-sans text-slate-500 block uppercase">Available Stock</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {selectedTank.remaining_litres.toLocaleString()} L
                    </span>
                  </div>
                </div>

                {selectedTank.space_note && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-xs font-sans text-slate-500 uppercase block mb-0.5">Yard Placement Note:</span>
                    <span className="font-sans text-slate-800 dark:text-slate-200 italic">
                      &ldquo;{selectedTank.space_note}&rdquo;
                    </span>
                  </div>
                )}

                {/* Orders Drawn from this Tank / Product Batch */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-brand-500" />
                      <span>Recent Orders Dispensed</span>
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
