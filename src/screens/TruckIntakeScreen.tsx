import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import { TruckTankIllustration } from '../components/common/TruckTankIllustration';
import { BottomSheet } from '../components/common/BottomSheet';
import { calculateIntakeMetrics, calculateDipstickVariance, formatDepotDate } from '../services/businessLogic';
import {
  Truck,
  CheckCircle2,
  Scale,
  Boxes,
  ArrowDownToLine,
  Info,
  AlertTriangle,
  History,
  Ruler,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

export const TruckIntakeScreen: React.FC = () => {
  const {
    products,
    tanks,
    kegInventory,
    settings,
    pumps,
    dipstickReadings,
    logTruckIntake,
    recordDipstickReading
  } = useStore();


  const [productId, setProductId] = useState<string>('veg');
  const [truckLabel, setTruckLabel] = useState<string>('Truck 3 · KJA-492-XA');
  const [driverName, setDriverName] = useState<string>('Alhaji Musa');
  const [tons, setTons] = useState<string>('10');
  const [actualKegs, setActualKegs] = useState<string>('360');
  const [leftoverLitres, setLeftoverLitres] = useState<string>('20');
  const [newlyAddedTankId, setNewlyAddedTankId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mobile Sheet State for Tank Detail
  const [selectedTankForMobileSheet, setSelectedTankForMobileSheet] = useState<string | null>(null);

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

  // Live calculation metrics
  const metrics = useMemo(() => {
    return calculateIntakeMetrics(
      parseFloat(tons) || 0,
      selectedProduct.litres_per_ton,
      parseFloat(actualKegs) || 0,
      parseFloat(leftoverLitres) || 0,
      kegInventory.kegsAtDepot,
      settings.litres_per_keg
    );
  }, [tons, selectedProduct, actualKegs, leftoverLitres, kegInventory.kegsAtDepot, settings.litres_per_keg]);

  const isShortfallTriggered = metrics.shortfall > settings.truck_shortfall_threshold;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tons || parseFloat(tons) <= 0) return;

    const fullTruckLabel = driverName.trim()
      ? `${truckLabel.trim() || `TRK-${selectedProduct.name.split(' ')[0].toUpperCase()}-${Date.now().toString().slice(-4)}`} (${driverName.trim()})`
      : truckLabel.trim() || `TRK-${selectedProduct.name.split(' ')[0].toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const result = logTruckIntake({
      productId,
      truckLabel: fullTruckLabel,
      tons: parseFloat(tons) || 0,
      actualKegs: parseFloat(actualKegs) || 0,
      leftoverLitres: parseFloat(leftoverLitres) || 0
    });

    if (result.success && result.tank) {
      setNewlyAddedTankId(result.tank.id);
      setSuccessMessage(`Truck ${result.tank.truck_label} offload recorded! Received ${result.tank.received_litres.toLocaleString()}L.`);
      // Reset form
      setTruckLabel('Truck 4 · BDG-102-LK');
      setDriverName('Emeka Obi');
      setTons('10');
      setActualKegs('360');
      setLeftoverLitres('0');
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Title & Context Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-[24px] font-heading font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <span>Truck Intake & Volumetric Offload</span>
          </h2>
          <p className="text-[14px] font-sans text-slate-500 dark:text-slate-400 mt-1">
            Convert delivery tonnage into litres and {settings.litres_per_keg}L kegs. Automatic shortfall detection and capacity checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[12px] font-mono tabular-nums text-slate-700 dark:text-slate-300">
            <span className="text-slate-500 dark:text-slate-400 font-sans">Depot Kegs:</span>{' '}
            <span className={`font-bold ${kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {kegInventory.kegsAtDepot}
            </span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[12px] font-sans font-semibold flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
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
              <span>Intake Parameters & Offload Data</span>
            </h3>
            <span className="text-[12px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">1 Keg = {settings.litres_per_keg} Litres</span>
          </div>

          {/* Product Select */}
          <div className="space-y-2">
            <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">Select Product</label>
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const isSelected = p.id === productId;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all min-h-[48px] ${
                      isSelected
                        ? p.id === 'veg'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-300 font-bold shadow-sm'
                          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-300 font-bold shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-[14px] font-sans font-bold">{p.name}</div>
                      <div className="text-[11px] opacity-75 font-mono tabular-nums">~{p.litres_per_ton} L/Ton</div>
                    </div>
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: p.id === 'veg' ? '#F59E0B' : '#EF4444' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Truck Plate and Driver Name 2-Column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Truck License / Plate No.
              </label>
              <input
                type="text"
                placeholder="e.g. Truck 3 · KJA-492-XA"
                value={truckLabel}
                onChange={e => setTruckLabel(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Driver Name (Leader Line Connected)
              </label>
              <input
                type="text"
                placeholder="e.g. Alhaji Musa"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-[14px] font-sans font-medium focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Scale Weight in Tons */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Delivery Weight (Metric Tons)
              </label>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                Multiplier: {selectedProduct.litres_per_ton} L/Ton
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.1"
                placeholder="10.00"
                value={tons}
                inputMode="decimal"
                onChange={e => setTons(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[16px] font-mono tabular-nums font-bold focus:outline-none focus:border-brand-500"
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
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Actual Kegs Filled ({settings.litres_per_keg}L)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="360"
                value={actualKegs}
                inputMode="numeric"
                onChange={e => setActualKegs(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            {/* Leftover Bulk Litres */}
            <div className="space-y-1">
              <label className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Leftover Recovered (Litres)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="20"
                value={leftoverLitres}
                inputMode="decimal"
                onChange={e => setLeftoverLitres(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold text-[14px] focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Depot Capacity Warning Banner */}
          {metrics.exceedsDepotKegCapacity && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-[12px] font-sans text-amber-900 dark:text-amber-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Depot Keg Capacity Warning</span>
                <span>
                  Expected offload requires ~{metrics.expectedKegs.toFixed(0)} kegs, but depot only has {kegInventory.kegsAtDepot} empty kegs available.
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[14px] uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <ArrowDownToLine className="w-[18px] h-[18px] text-slate-950" />
            <span>Complete Offload & Animate Tank Fill</span>
          </button>
        </form>

        {/* Right Column: Live Reconciliation Preview & Simulation (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Mathematical Conversion Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Live Volumetric Conversion
              </span>
              <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold">
                Formula Verified
              </span>
            </div>

            <div className="space-y-3 text-[12px] font-mono tabular-nums">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span className="font-sans">Expected Litres ({tons || 0}T):</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{metrics.expectedLitres.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span className="font-sans">Expected 30L Kegs:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">~{metrics.expectedKegs} kegs</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-sans">Recovered Volume:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{metrics.recoveredLitres.toLocaleString()} L</span>
              </div>

              {/* Live Shortfall Gauge / Alert */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-bold text-slate-700 dark:text-slate-300 text-[12px]">Delivery Variance:</span>
                  <span
                    className={`font-mono tabular-nums font-bold text-[14px] px-2 py-0.5 rounded-md ${
                      isShortfallTriggered
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30'
                        : metrics.shortfall > 0
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {metrics.shortfall > 0 ? `-${metrics.shortfall} L` : `${metrics.shortfall} L (Clean)`}
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
          </div>

          {/* Live Tanker Truck Simulation Preview */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-[12px] font-sans font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Live Offload Tanker Simulation
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
                  ? `${truckLabel.trim() || 'TRK-VEG'} (${driverName.trim()})`
                  : truckLabel.trim() || 'TRK-VEG',
                tons: parseFloat(tons) || 10,
                received_litres: metrics.recoveredLitres || 1,
                remaining_litres: metrics.recoveredLitres || 1,
                shortfall: metrics.shortfall,
                date: new Date().toISOString()
              }}
              product={selectedProduct}
              connectedPumpLabel={pumps.find(p => p.product_id === productId)?.label}
              animateOnMount={false}
            />
          </div>
        </div>
      </div>

      {/* Historical Offload Variance Log: Rendered as Visual Tanker Fleet Cards */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <span>Depot Storage Tanks & Tanker Offload Fleet</span>
            </h3>
            <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
              Simplified tanker-truck anatomy with horizontal liquid fill gauges, driver leader lines, and delivery variance tracking.
            </p>
          </div>
          <span className="text-[12px] font-mono tabular-nums font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
            {tanks.length} Active Storage Tanks
          </span>
        </div>

        {/* Mobile Compact Tank Rows */}
        <div className="sm:hidden space-y-2.5">
          {tanks.map(t => {
            const prod = products.find(p => p.id === t.product_id);
            const pct = Math.min(100, (t.remaining_litres / (t.received_litres || 1)) * 100);
            const tankReadings = dipstickReadings
              .filter(d => d.tank_id === t.id)
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
            const latestReading = tankReadings[0];
            const isVeg = t.product_id === 'veg';

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTankForMobileSheet(t.id)}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 active:scale-98 transition-all cursor-pointer flex flex-col gap-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                    />
                    <span className="font-sans font-bold text-[14px] text-slate-900 dark:text-white">
                      {t.truck_label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {latestReading ? (
                      latestReading.is_flagged ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Variance Alert" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Verified" />
                      )
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-400" title="Awaiting Stick" />
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[12px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  <span>{t.tons}T · {t.remaining_litres.toLocaleString()}L / {t.received_litres.toLocaleString()}L</span>
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

        {/* Visual Tanker Fleet Grid (Desktop 2-Col) */}
        <div className="hidden sm:grid grid-cols-1 xl:grid-cols-2 gap-5">
          {tanks.map(t => {
            const prod = products.find(p => p.id === t.product_id);
            const connectedPump = pumps.find(p => p.product_id === t.product_id);
            // Find most recent dipstick reading for this tank
            const tankReadings = dipstickReadings
              .filter(d => d.tank_id === t.id)
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
            const latestReading = tankReadings[0];

            return (
              <div key={t.id} className="flex flex-col space-y-2">
                <TruckTankIllustration
                  tank={t}
                  product={prod}
                  connectedPumpLabel={connectedPump ? connectedPump.label : undefined}
                  animateOnMount={t.id === newlyAddedTankId}
                />

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
                          ? `Stick: ${latestReading.reading_litres.toLocaleString()} L · System: ${(latestReading.system_litres ?? t.remaining_litres).toLocaleString()} L · ${formatDepotDate(latestReading.recorded_at)}`
                          : `System volume: ${t.remaining_litres.toLocaleString()} L`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDipstick(t.id)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-[16px] text-slate-900 dark:text-white">
                    Physical Tank Dipstick Audit
                  </h3>
                  <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400">
                    {selectedDipstickTank.truck_label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDipstickTankId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordDipstickSubmit} className="p-5 space-y-4 overflow-y-auto">
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
                <label className="block text-[12px] font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Dipstick Reading (Litres) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={dipstickReadingInput}
                    onChange={e => setDipstickReadingInput(e.target.value)}
                    placeholder="e.g. 3250"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono tabular-nums text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="absolute right-3 top-2.5 text-[12px] font-mono text-slate-400">
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
                <label className="block text-[12px] font-sans font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Dip Notes / Stick Condition (Optional)
                </label>
                <input
                  type="text"
                  value={dipstickNotes}
                  onChange={e => setDipstickNotes(e.target.value)}
                  placeholder="e.g., Morning dip, cold temperature, calibrated brass tape"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-sans text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDipstickTankId(null)}
                  className="px-4 py-2 text-[13px] font-sans font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[13px] font-sans font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save Physical Dipstick Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Mobile Tank Inspection Bottom Sheet */}
      {(() => {
        const selectedMobileTank = tanks.find(t => t.id === selectedTankForMobileSheet);
        const selectedMobileProduct = products.find(p => p.id === selectedMobileTank?.product_id);
        const selectedMobilePump = pumps.find(p => p.product_id === selectedMobileTank?.product_id);
        const mobileTankReadings = selectedMobileTank
          ? dipstickReadings
              .filter(d => d.tank_id === selectedMobileTank.id)
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
          : [];
        const latestMobileReading = mobileTankReadings[0];

        return (
          <BottomSheet
            isOpen={!!selectedTankForMobileSheet}
            onClose={() => setSelectedTankForMobileSheet(null)}
            title={selectedMobileTank?.truck_label || 'Tank Details'}
            subtitle={
              selectedMobileProduct
                ? `${selectedMobileProduct.name} · ${selectedMobileTank?.tons} Tons Intake`
                : ''
            }
          >
            {selectedMobileTank && selectedMobileProduct && (
              <div className="space-y-4">
                <TruckTankIllustration
                  tank={selectedMobileTank}
                  product={selectedMobileProduct}
                  connectedPumpLabel={selectedMobilePump?.label}
                  animateOnMount={false}
                />

                {/* Dipstick Verification Strip & Action */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-sans font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Ruler className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <span>Physical Dipstick Status</span>
                    </span>
                    {latestMobileReading ? (
                      latestMobileReading.is_flagged ? (
                        <span className="text-[10px] font-mono tabular-nums font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                          VARIANCE {(latestMobileReading.variance ?? 0) > 0 ? `+${latestMobileReading.variance}` : (latestMobileReading.variance ?? 0)}L
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono tabular-nums font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          VERIFIED ({(latestMobileReading.variance ?? 0) > 0 ? `+${latestMobileReading.variance}` : (latestMobileReading.variance ?? 0)}L)
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
                      <span>Current Ledger Volume:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedMobileTank.remaining_litres.toLocaleString()} L
                      </span>
                    </div>
                    {latestMobileReading && (
                      <div className="flex justify-between">
                        <span>Last Physical Stick:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {latestMobileReading.reading_litres.toLocaleString()} L ({formatDepotDate(latestMobileReading.recorded_at)})
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedMobileTank.id;
                      setSelectedTankForMobileSheet(null);
                      handleOpenDipstick(id);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[13px] font-sans font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Ruler className="w-4 h-4" />
                    <span>Record Physical Dipstick</span>
                  </button>
                </div>
              </div>
            )}
          </BottomSheet>
        );
      })()}
    </div>
  );
};
