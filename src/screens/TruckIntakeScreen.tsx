import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { useToast } from '../services/toast';
import { BottomSheet } from '../components/common/BottomSheet';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { useIsDesktopSplit } from '../hooks/useBreakpoint';
import {
  calculateIntakeMetrics,
  calculatePreKeggedIntakeMetrics,
  resolveLitresPerTon,
  resolveLitresPerKeg,
  configuredNumber,
  formatDepotDate,
  formatDepotTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  formatWithCommas,
  parseFromCommas,
  depotDateKey,
  getDepotToday
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
  ShieldCheck,
  GasPump,
  Spinner
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
  const { showToast } = useToast();

  // Progressive Disclosure View Mode
  // 'log_intake': Immediate, focused truck logging workspace (zero distraction)
  // 'tanks_history': Full storage facility telemetry, tank fill gauges & 48h audit history
  const [activeView, setActiveView] = useState<'log_intake' | 'tanks_history'>('log_intake');

  // Form State — the first configured product until the operator picks another
  // one, and empty when the depot has no catalogue yet (the screen then shows
  // the setup prompt rather than a form it cannot compute).
  const [productId, setProductId] = useState<string>(() => products[0]?.id || '');
  const [supplierId, setSupplierId] = useState<string>(() => suppliers[0]?.id || '');
  const [physicalTankId, setPhysicalTankId] = useState<string>(() => physicalTanks[0]?.id || '');
  const [driverName, setDriverName] = useState<string>('');
  const [spaceNote, setSpaceNote] = useState<string>('');
  const [intakeDateInput, setIntakeDateInput] = useState<string>(() => toDatetimeLocalValue());

  // Bulk truck state (zero decimals: integers). Deliberately EMPTY: these are
  // waybill figures the operator reads off the paperwork, and pre-filling a
  // guess (10T / 358 kegs / 10L) both hid what the fields were for and produced
  // a bogus "−1,800 L shortfall" banner the moment the screen opened.
  const [tons, setTons] = useState<string>('');
  const [actualKegs, setActualKegs] = useState<string>('');
  const [leftoverLitres, setLeftoverLitres] = useState<string>('');

  // Pre-kegged palm state
  const [kegsReceived, setKegsReceived] = useState<string>('');

  // Progressive disclosure states inside form
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isChangingTank, setIsChangingTank] = useState(false);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Progressive Disclosure State for Tank Detail Drawer
  const [selectedTankForDetail, setSelectedTankForDetail] = useState<string | null>(null);

  const selectedProduct = products.find(p => p.id === productId) || products[0];

  // One source of truth for both the live preview below and the recorded
  // receipt: the product's own figures, else the depot defaults in Settings,
  // else 0 meaning "not configured". Nothing here invents a density or a keg
  // size, so what the operator sees is exactly what gets written.
  const litresPerTon = resolveLitresPerTon(selectedProduct, settings);
  const litresPerKeg = resolveLitresPerKeg(selectedProduct, settings);
  const companyKegSize = configuredNumber(settings.litres_per_keg);
  const isBulkTruck = selectedProduct?.supply_model === 'bulk_truck';
  const densityFromProduct = configuredNumber(selectedProduct?.litres_per_ton) > 0;
  const kegSizeFromProduct = configuredNumber(selectedProduct?.litres_per_keg) > 0;

  // What would stop this delivery being recorded: no density to turn tons into
  // litres, or no keg size to turn counted kegs into litres.
  const configBlocker = !selectedProduct
    ? 'Add a product in Settings before recording a delivery.'
    : isBulkTruck && litresPerTon <= 0
      ? `Set the density (litres per ton) for ${selectedProduct.name} in Settings before recording a bulk intake.`
      : litresPerKeg <= 0
        ? `Set the keg size (litres per keg) for ${selectedProduct.name} in Settings before recording a delivery.`
        : null;

  // Live calculation metrics for bulk truck
  const bulkMetrics = useMemo(() => {
    return calculateIntakeMetrics(
      parseInt(tons, 10) || 0,
      litresPerTon,
      parseFromCommas(actualKegs) || 0,
      parseInt(leftoverLitres, 10) || 0,
      kegInventory.kegsAtDepot,
      litresPerKeg,
      settings.truck_shortfall_threshold
    );
  }, [tons, litresPerTon, actualKegs, leftoverLitres, kegInventory.kegsAtDepot, litresPerKeg, settings.truck_shortfall_threshold]);

  // Live calculation metrics for pre-kegged
  const preKeggedMetrics = useMemo(() => {
    return calculatePreKeggedIntakeMetrics(
      parseFromCommas(kegsReceived) || 0,
      litresPerKeg
    );
  }, [kegsReceived, litresPerKeg]);

  // Tolerance contract: a 0 threshold means the owner hasn't set one, so a
  // shortfall is shown as a figure without being flagged as a breach.
  const hasShortfallTolerance = configuredNumber(settings.truck_shortfall_threshold) > 0;
  const isShortfallFlagged = hasShortfallTolerance && bulkMetrics.shortfall > settings.truck_shortfall_threshold;
  const isShortfallWithinTolerance = hasShortfallTolerance && bulkMetrics.shortfall <= settings.truck_shortfall_threshold;

  // Derived Telemetry
  const totalDepotLitres = useMemo(() => {
    return tanks.reduce((sum, t) => sum + (t.remaining_litres || 0), 0);
  }, [tanks]);

  // Only a capacity the depot actually configured can produce a fill %. The
  // old chain ended in a hardcoded 60,000L, which showed a made-up percentage
  // for a depot with no physical tanks registered at all.
  const totalDepotCapacity = useMemo(() => {
    const physCap = physicalTanks.reduce((sum, pt) => sum + (pt.capacity_litres || 0), 0);
    if (physCap > 0) return physCap;
    return tanks.reduce((sum, t) => sum + (t.received_litres || 0), 0);
  }, [physicalTanks, tanks]);

  const hasDepotCapacity = totalDepotCapacity > 0;
  const depotFullPercentage = hasDepotCapacity
    ? Math.min(100, Math.round((totalDepotLitres / totalDepotCapacity) * 100))
    : 0;

  const shiftTotalLoss = useMemo(() => {
    const todayStr = getDepotToday();
    return tanks
      .filter(t => depotDateKey(t.date) === todayStr)
      .reduce((sum, t) => sum + (t.shortfall || 0), 0);
  }, [tanks]);

  // Counted from records the depot actually has — the storage view used to show
  // invented live telemetry (a clamped tanker count, "Bay 01 Open") instead.
  const deliveriesTodayCount = useMemo(() => {
    const todayStr = getDepotToday();
    return tanks.filter(t => depotDateKey(t.date) === todayStr).length;
  }, [tanks]);

  // Reset form
  const handleResetForm = () => {
    setTons('');
    setActualKegs('');
    setLeftoverLitres('');
    setKegsReceived('');
    setDriverName('');
    setSpaceNote('');
    setIntakeDateInput(toDatetimeLocalValue());
    setShowAdvancedOptions(false);
    setIsChangingTank(false);
    setErrorMessage(null);
  };

  // Driven by the product's own supply model instead of hardcoded 'veg'/'red'
  // ids, so a depot that renames or replaces its products still gets the right
  // form. Waybill figures are left exactly as the operator typed them.
  const handleSelectOil = (id: string) => {
    setProductId(id);
    const product = products.find(p => p.id === id);
    if (product?.supply_model === 'bulk_truck') {
      const productTank = physicalTanks.find(pt => pt.product_id === product.id) || physicalTanks[0];
      if (productTank) setPhysicalTankId(productTank.id);
    } else {
      // Pre-kegged oil arrives in kegs — it isn't decanted into a yard tank,
      // so there's no physical tank to associate with this delivery.
      setPhysicalTankId('');
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
      showToast('error', 'Please select a supplier for this delivery intake.');
      return;
    }

    // Never record litres we had to invent: the store refuses these too, so
    // say it here where the form is, not after a failed write.
    if (configBlocker) {
      setErrorMessage(configBlocker);
      showToast('error', configBlocker);
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
          showToast('error', 'Please enter a valid tonnage for bulk offload.');
          setIsSubmitting(false);
          return;
        }

        const result = logTruckIntake({
          productId,
          truckLabel: fullTruckLabel,
          supplierId,
          physicalTankId: currentSelectedTank?.id || undefined,
          spaceNote: spaceNote.trim() || undefined,
          tons: parsedTons,
          actualKegs: parseFromCommas(actualKegs) || 0,
          leftoverLitres: parseInt(leftoverLitres, 10) || 0,
          date: fromDatetimeLocalValue(intakeDateInput)
        });

        if (result.success && result.tank) {
          const okMsg = `${parsedTons} Tons (${result.tank.received_litres.toLocaleString()}L) logged for ${fullTruckLabel} from ${supplierName}. Store stock updated.`;
          setSuccessMessage(okMsg);
          showToast('success', okMsg);
          handleResetForm();
          setTimeout(() => setSuccessMessage(null), 6000);
        } else {
          const errMsg = result.error || 'Failed to record truck intake.';
          setErrorMessage(errMsg);
          showToast('error', errMsg);
        }
      } else {
        const numKegs = parseFromCommas(kegsReceived) || 0;
        if (numKegs <= 0) {
          setErrorMessage('Please enter a valid count of kegs received.');
          showToast('error', 'Please enter a valid count of kegs received.');
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
          const okMsg = `Pre-kegged delivery recorded! Received ${numKegs} kegs (${result.tank.received_litres.toLocaleString()}L) from ${supplierName}.`;
          setSuccessMessage(okMsg);
          showToast('success', okMsg);
          handleResetForm();
          setTimeout(() => setSuccessMessage(null), 6000);
        } else {
          const errMsg = result.error || 'Failed to record pre-kegged delivery.';
          setErrorMessage(errMsg);
          showToast('error', errMsg);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSelectedTank = physicalTanks.find(pt => pt.id === physicalTankId) || physicalTanks[0];
  const currentTankLitres = tanks
    .filter(t => t.physical_tank_id === currentSelectedTank?.id)
    .reduce((s, t) => s + t.remaining_litres, 0);
  // Only a configured capacity can produce a fill %; without one the panel
  // shows the litres alone rather than an invented "50% full".
  const currentTankPct = currentSelectedTank?.capacity_litres
    ? Math.min(100, Math.round((currentTankLitres / currentSelectedTank.capacity_litres) * 100))
    : 0;

  // Nothing to deliver against yet: guide the operator to set up a product
  // rather than rendering a form whose figures cannot be computed.
  if (products.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <Truck className="w-6 h-6 text-slate-400" weight="bold" />
        </div>
        <h1 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
          No products configured yet
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          A delivery can only be recorded against a product, and its litres are worked
          out from that product's keg size and density. Add your first product in
          Settings → Products &amp; Keg Sizes, then come back here to log the intake.
        </p>
      </div>
    );
  }

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

        {/* Two unrelated jobs live on this screen — recording a delivery, and
            reviewing what's already in the tanks. A segmented switcher keeps
            whichever one you're doing on screen at full size instead of
            stacking both, and the labels name the job in plain words. */}
        <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-1 self-start sm:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => setActiveView('log_intake')}
            aria-pressed={activeView === 'log_intake'}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'log_intake'
                ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck
              className={`w-4 h-4 ${activeView === 'log_intake' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}
              weight="bold"
            />
            <span>Log a delivery</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('tanks_history')}
            aria-pressed={activeView === 'tanks_history'}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'tanks_history'
                ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Warehouse
              className={`w-4 h-4 ${activeView === 'tanks_history' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}
              weight="bold"
            />
            <span>Tanks &amp; delivery history</span>
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
          className="p-4 rounded-xl badge-emerald text-sm font-sans font-bold flex items-start gap-3 animate-in fade-in sticky top-4 z-40 shadow-lg"
        >
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" weight="bold" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl badge-rose text-sm font-sans font-bold flex items-start gap-3 animate-in fade-in sticky top-4 z-40 shadow-lg"
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
          <div className="depot-card p-5 sm:p-6 space-y-5">
            
            {/* Form Title & Reset Button */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="badge-amber inline-block mb-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider">
                  Truck in the yard
                </span>
                <h2 className="font-heading text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Truck className="w-5 h-5 text-brand-600 dark:text-brand-400" weight="bold" />
                  <span>Log this delivery</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter the waybill figures — the litres and kegs are worked out for you below.
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
              
              {/* Step 1 — this single choice decides the shape of the whole
                  form (bulk tanker vs pre-kegged), so it comes first and each
                  option says how the oil actually arrives. */}
              <div className="space-y-2">
                <h3 className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                  1. What is the truck carrying?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800">
                  {products.map(p => {
                    const isPalm = p.supply_model === 'pre_kegged';
                    const isSelected = p.id === productId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectOil(p.id)}
                        aria-pressed={isSelected}
                        className={`py-3 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm border-2 border-brand-500'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-2 border-transparent'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-brand-500' : 'bg-slate-400'}`} />
                        <span>{p.name} — {isPalm ? 'pre-kegged' : 'bulk tanker'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <h3 className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                  2. Who sent it, and who drove it?
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Supplier Select Input */}
                  <div className="space-y-1.5">
                    <label htmlFor="supplierSelect" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                      Supplier / refinery <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="supplierSelect"
                        value={supplierId}
                        onChange={e => setSupplierId(e.target.value)}
                        className="depot-input h-12 pr-10 font-semibold appearance-none cursor-pointer"
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
                    <label htmlFor="driverNameInput" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                      Driver name <span className="normal-case font-medium text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="driverNameInput"
                      type="text"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      placeholder="e.g. Musa Abdullahi"
                      className="depot-input h-12"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Delivery Weight & Calculated Volume */}
              <div className="space-y-3">
                <h3 className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                  3. Waybill figures — the litres are calculated for you
                </h3>

                {isBulkTruck ? (
                  /* Bulk Tanker (Scale Weight Tonnage) */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                      {/* Scale Weight Input with Steppers */}
                      <div className="sm:col-span-6 space-y-1.5">
                        <label htmlFor="tonsInput" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                          Scale weight (tons) <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustTons(-1)}
                            aria-label="Decrease tons by 1"
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
                              className="depot-input h-12 pl-4 pr-16 font-mono tabular-nums text-2xl font-black"
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
                            aria-label="Increase tons by 1"
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
                            {litresPerTon > 0
                              ? `${litresPerTon.toLocaleString()} L / TON${densityFromProduct ? '' : ' (depot default)'}`
                              : 'Density not set'}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-2xl font-extrabold text-slate-950 dark:text-white mt-1">
                          {bulkMetrics.expectedLitres.toLocaleString()} L
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {litresPerKeg > 0
                            ? `Equivalent to ~${bulkMetrics.expectedKegs} standard ${litresPerKeg}L company kegs.`
                            : 'Set the keg size in Settings to see the keg equivalent.'}
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
                        <label htmlFor="kegsReceivedInput" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                          Kegs received{litresPerKeg > 0 ? ` (${litresPerKeg}L)` : ''} <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustKegsReceived(-10)}
                            aria-label="Decrease kegs by 10"
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
                              className="depot-input h-12 pl-4 pr-16 font-mono tabular-nums text-2xl font-black"
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
                            aria-label="Increase kegs by 10"
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
                            {litresPerKeg > 0
                              ? `${litresPerKeg} L / KEG${kegSizeFromProduct ? '' : ' (depot default)'}`
                              : 'Keg size not set'}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-2xl font-extrabold text-slate-950 dark:text-white mt-1">
                          {preKeggedMetrics.exactLitres.toLocaleString()} L
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {litresPerKeg > 0
                            ? `Standard ${litresPerKeg}L company kegs ready for yard inventory.`
                            : 'Set the keg size in Settings to see the volume.'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4 — bulk tanker deliveries only. Pre-kegged palm oil never
                  goes into a yard tank, so there's nothing to choose for that
                  flow. The tank's own label, live litres and fill % come from
                  the store rather than being typed in. */}
              {isBulkTruck && (
                <div className="space-y-3">
                  <h3 className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                    4. Which tank is it going into?
                  </h3>

                  {/* Target Tank Confirmation with Progressive Disclosure */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Warehouse className="w-4 h-4 text-slate-500" />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-500 mr-1.5">Receiving Tank:</span>
                        <strong className="font-bold text-slate-900 dark:text-white">
                          {currentSelectedTank?.label || 'No tank selected'}
                        </strong>
                        <span className="font-mono text-slate-500 ml-2">
                          ({currentTankLitres.toLocaleString()} L{currentSelectedTank?.capacity_litres ? ` · ${currentTankPct}% full` : ''})
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsChangingTank(!isChangingTank)}
                      className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                    >
                      {isChangingTank ? 'Done' : 'Change tank'}
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
                              ? 'bg-white dark:bg-slate-800 border-brand-500 shadow-xs'
                              : 'bg-white/60 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="targetTank"
                            value={pt.id}
                            checked={physicalTankId === pt.id}
                            onChange={() => setPhysicalTankId(pt.id)}
                            className="accent-brand-500 w-4 h-4"
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
                    <label htmlFor="kegCountInput" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                      Kegs filled &amp; counted at discharge <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="kegCountInput"
                        type="text"
                        inputMode="numeric"
                        value={actualKegs}
                        onChange={e => setActualKegs(formatWithCommas(e.target.value))}
                        placeholder="358"
                        className="depot-input h-12 pl-4 pr-16 font-mono tabular-nums text-2xl font-black"
                        required
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-500 dark:text-slate-400 pointer-events-none">
                        KEGS
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      {litresPerKeg > 0
                        ? `Actual count of ${litresPerKeg}L jerrycans filled directly during tanker discharge.`
                        : 'Actual count of jerrycans filled directly during tanker discharge.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 5 — the last thing above the submit button is the only one
                  worth reading twice: what the waybill claims, what was actually
                  counted, and the gap between the two. */}
              <div className="pt-2 space-y-2">
                <h3 className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                  5. Check the figures before you record
                </h3>
                {isBulkTruck ? (
                  <div className={`p-4 rounded-xl border-2 transition-all space-y-2 ${
                    isShortfallFlagged
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-900 dark:text-rose-200'
                      : isShortfallWithinTolerance
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Scales className="w-4 h-4" />
                        <span>Waybill vs. what came out of the truck</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full font-mono text-xs font-black shadow-xs ${
                        isShortfallFlagged
                          ? 'bg-rose-600 text-white'
                          : isShortfallWithinTolerance
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-500 text-white'
                      }`}>
                        {bulkMetrics.shortfall === 0
                          ? '0 L — exact match'
                          : isShortfallFlagged
                            ? `${bulkMetrics.shortfall.toLocaleString()} L short`
                            : isShortfallWithinTolerance
                              ? `${Math.abs(bulkMetrics.shortfall).toLocaleString()} L within tolerance`
                              : `${Math.abs(bulkMetrics.shortfall).toLocaleString()} L difference`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-mono tabular-nums pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>Waybill says: <strong>{bulkMetrics.expectedLitres.toLocaleString()} L</strong></span>
                      <span>Counted: <strong>{bulkMetrics.recoveredLitres.toLocaleString()} L</strong></span>
                      <span>Difference: <strong>{bulkMetrics.shortfall > 0 ? `-${bulkMetrics.shortfall} L` : '0 L'}</strong></span>
                    </div>

                    {bulkMetrics.shortfall > settings.truck_shortfall_threshold && (
                      <p className="text-[11px] font-sans font-semibold text-rose-700 dark:text-rose-300 mt-1">
                        This is more than the ±{settings.truck_shortfall_threshold} L tolerance. Tell the supervisor before
                        the waybill is signed.
                      </p>
                    )}

                    {bulkMetrics.exceedsDepotKegCapacity && (
                      <p className="text-[11px] font-sans font-semibold text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" weight="bold" />
                        <span>
                          Warning: This delivery needs ≈{Math.ceil(bulkMetrics.expectedKegs).toLocaleString()} kegs to decant, but only {kegInventory.kegsAtDepot.toLocaleString()} are available at depot. Arrange more empty kegs before offloading.
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" weight="bold" />
                      <span>Kegs counted vs. litres recorded</span>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-black">
                      {preKeggedMetrics.exactLitres.toLocaleString()} Litres ({kegsReceived || 0} kegs)
                    </span>
                  </div>
                )}
              </div>

              {/* The submit button states the effect, not the mechanism. */}
              {/* A delivery can't be recorded from an unconfigured product —
                  the litres would be fabricated. Say what's missing here
                  instead of offering a button that can only fail. */}
              {configBlocker && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
                  <span>{configBlocker}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !!configBlocker}
                className="w-full h-14 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-[0.99] text-slate-950 font-sans font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Spinner className="w-5 h-5 animate-spin" weight="bold" />
                ) : (
                  <>
                    <ArrowLineDown className="w-5 h-5 text-slate-950" weight="bold" />
                    <span>Record this delivery</span>
                  </>
                )}
              </button>
            </form>

            {/* Everything below the submit button is genuinely optional, so it
                stays collapsed — a routine delivery needs none of it and the
                audit trail is complete without it. */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                aria-expanded={showAdvancedOptions}
                className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none transition-colors"
              >
                <CaretRight className={`w-3.5 h-3.5 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} weight="bold" />
                <span>Add pipe residual, delivery time or a yard note</span>
              </button>

              {showAdvancedOptions && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border-2 border-slate-200 dark:border-slate-800 animate-in fade-in">
                  {isBulkTruck && (
                    <div className="space-y-1.5">
                      <label htmlFor="slopVolumeInput" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                        Oil left in the pipe (litres)
                      </label>
                      <div className="relative">
                        <input
                          id="slopVolumeInput"
                          type="number"
                          step="1"
                          min="0"
                          value={leftoverLitres}
                          onChange={e => setLeftoverLitres(e.target.value.replace(/[^0-9]/g, ''))}
                          className="depot-input h-11 pr-14 font-mono font-bold"
                          placeholder="0"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[11px] text-slate-400">
                          LITRES
                        </span>
                      </div>
                      <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Residual oil in the discharge hose or drain tray.</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="intakeDateInput" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                      Delivery time
                    </label>
                    <input
                      id="intakeDateInput"
                      type="datetime-local"
                      value={intakeDateInput}
                      onChange={e => setIntakeDateInput(e.target.value)}
                      className="depot-input h-11 font-mono text-xs font-semibold"
                    />
                    <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Leave as it is for the real time of this delivery.</span>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="spaceNoteInput" className="block text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400">
                      Yard note
                    </label>
                    <input
                      id="spaceNoteInput"
                      type="text"
                      value={spaceNote}
                      onChange={e => setSpaceNote(e.target.value)}
                      placeholder="e.g. seal intact, clarity test passed, hose drained"
                      className="depot-input h-11"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reference material, not part of the flow — <details> keeps it out
                of the way while staying keyboard accessible. */}
            <details className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 group cursor-pointer">
              <summary className="font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 list-none select-none flex items-center gap-1.5 transition-colors">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Tolerance rules &amp; how a shortfall is handled</span>
                <CaretRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90 ml-auto" />
              </summary>
              <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" weight="bold" />
                  <span>Normal Tolerance: Within ±{settings.truck_shortfall_threshold} Litres of waybill is automatic pass.</span>
                </div>
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" weight="bold" />
                  <span>Shortfall Alert: If deficit exceeds {settings.truck_shortfall_threshold} Litres, notify Supervisor before signing waybill.</span>
                </div>
              </div>
            </details>

          </div>

          {/* Latest entry plus a way into the full history, so what was just
              written is visible without leaving the intake view. */}
          <div className="depot-card depot-card-hover p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <Truck className="w-4 h-4 text-slate-500" />
              <span className="text-slate-500 dark:text-slate-400">
                Latest logged: <strong className="text-slate-800 dark:text-slate-200">{tanks[0]?.truck_label || 'nothing yet'}</strong>
                {tanks[0] && <span className="font-mono tabular-nums text-slate-500 ml-1.5">(+{tanks[0].received_litres.toLocaleString()} L)</span>}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('tanks_history')}
              className="text-brand-600 dark:text-brand-400 font-bold hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>See tanks &amp; delivery history ({tanks.length})</span>
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
            <div className="depot-card p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <Drop className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="fill" />
                  <span className="font-sans text-xs font-semibold">Total oil in stock</span>
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
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${depotFullPercentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {hasDepotCapacity ? `${depotFullPercentage}% of capacity` : 'Capacity not configured'}
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Warehouse className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 2: real intake activity. This card used to show invented
                telemetry — a clamped tanker count and a hardcoded "Bay 01
                Offloading" — so it now counts actual records from the store. */}
            <div className="depot-card p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <Truck className="w-4 h-4 text-slate-500" weight="bold" />
                  <span className="font-sans text-xs font-semibold">Deliveries logged today</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono tabular-nums text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                    {deliveriesTodayCount}
                  </span>
                  <span className="font-sans text-xs font-semibold text-slate-500">
                    {deliveriesTodayCount === 1 ? 'truck' : 'trucks'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${deliveriesTodayCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span>{deliveriesTodayCount > 0 ? 'Intake recorded' : 'No intake recorded yet today'}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Truck className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 3: today's shortfall, summed from the intake records */}
            <div className="depot-card p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <Scales className="w-4 h-4 text-slate-500" weight="bold" />
                  <span className="font-sans text-xs font-semibold">Shortfall today</span>
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
                      <span>Within ±{settings.truck_shortfall_threshold} L tolerance</span>
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

            {/* KPI 4: empty kegs on hand. This replaces an invented "Offload
                Manifold / Bay 01 Open / valves cleared" panel — the keg count is
                real store data, and it's what actually gates decanting a bulk
                delivery (see the capacity warning inside the form). */}
            <div className="depot-card p-4 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-slate-400">
                  <GasPump className="w-4 h-4 text-slate-500" weight="bold" />
                  <span className="font-sans text-xs font-semibold">Empty kegs at depot</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono tabular-nums text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                    {kegInventory.kegsAtDepot.toLocaleString()}
                  </span>
                  <span className="font-sans text-xs font-semibold text-slate-500">{companyKegSize > 0 ? `${companyKegSize}L kegs` : 'kegs'}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  <span>Available to decant bulk deliveries</span>
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
                  Storage tanks
                </h2>
                <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Live volume in each tank, how full it is, and which supplier the last batch came from.
                </p>
              </div>
              <span className="badge-sky text-xs font-mono px-2.5 py-1 rounded-full">
                {physicalTanks.length} tanks
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {physicalTanks.map((pt) => {
                const tanksForThisPT = tanks.filter(t => t.physical_tank_id === pt.id);
                const liveLitres = tanksForThisPT.reduce((s, t) => s + t.remaining_litres, 0);
                const pct = Math.min(100, Math.round((liveLitres / pt.capacity_litres) * 100));
                const mostRecentBatch = [...tanksForThisPT].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                )[0];
                const sup = suppliers.find(s => s.id === mostRecentBatch?.supplier_id);

                return (
                  <div key={pt.id} className="depot-card depot-card-hover p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Drop className="w-4 h-4 text-brand-600 dark:text-brand-400" weight="fill" />
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
                          className="h-full bg-brand-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Provenance Details */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Primary Supplier:</span>
                          <strong className="text-slate-900 dark:text-white">{sup?.name || 'Not recorded'}</strong>
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
                        onClick={() => setSelectedTankForDetail(tanks.find(t => t.physical_tank_id === pt.id)?.id || null)}
                        className="font-sans font-bold text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
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

          {/* Every intake record, newest first. */}
          <div className="depot-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white">
                  Delivery log
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {tanks.length} deliveries logged
              </span>
            </div>

            <div className="space-y-2.5">
              {tanks.map(t => {
                const sup = suppliers.find(s => s.id === t.supplier_id);
                const prod = products.find(p => p.id === t.product_id);
                // With no tolerance configured, 0 is not a breach — the figure
                // is still shown, just not colour-coded as a failure.
                const isMatch = !configuredNumber(settings.truck_shortfall_threshold)
                  || (t.shortfall || 0) <= settings.truck_shortfall_threshold;

                return (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        <span className="text-sm leading-none">{t.tons ? `${t.tons}T` : 'KEG'}</span>
                        <span className="text-[9px] uppercase mt-0.5">{prod?.id || '—'}</span>
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
                          <span>{prod?.name || 'Product not found'}</span>
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
                      <span className={`px-3 py-1 rounded-full font-mono tabular-nums text-xs font-bold flex items-center gap-1 ${
                        isMatch
                          ? 'badge-emerald'
                          : 'badge-rose'
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
        const selectedTankKegSize = resolveLitresPerKeg(selectedTankProduct, settings);

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
                    <span className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block">Supplier</span>
                    <span className="font-heading font-bold text-slate-900 dark:text-white text-sm">
                      {selectedTankSupplier?.name || 'Direct delivery'}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block">How it arrived</span>
                    <span className="badge-sky px-2.5 py-1 rounded-full font-sans text-xs">
                      {selectedTank.supply_model === 'pre_kegged'
                        ? (selectedTankKegSize > 0 ? `Pre-kegged ${selectedTankKegSize}L` : 'Pre-kegged')
                        : 'Bulk tanker'}
                    </span>
                  </div>
                </div>

                {/* Storage Metrics Row */}
                <div className="grid grid-cols-2 gap-3 font-mono tabular-nums text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block">Received</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedTank.received_litres.toLocaleString()} L
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block">Left in tank</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedTank.remaining_litres.toLocaleString()} L
                    </span>
                  </div>
                </div>

                {selectedTank.space_note && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-[12px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block mb-0.5">Yard note</span>
                    <span className="font-sans text-slate-800 dark:text-slate-200 italic">
                      &ldquo;{selectedTank.space_note}&rdquo;
                    </span>
                  </div>
                )}

                {/* Orders Drawn from this Tank / Product Batch */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <span>Recent sales from this batch</span>
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
