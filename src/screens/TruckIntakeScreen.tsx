import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import { calculateIntakeMetrics, formatDepotDate } from '../services/businessLogic';
import {
  Truck,
  CheckCircle2,
  Scale,
  Boxes,
  ArrowDownToLine,
  Info,
  AlertTriangle,
  History
} from 'lucide-react';

export const TruckIntakeScreen: React.FC = () => {
  const { products, tanks, kegInventory, settings, logTruckIntake } = useStore();

  const [productId, setProductId] = useState<string>('veg');
  const [truckLabel, setTruckLabel] = useState<string>('');
  const [tons, setTons] = useState<string>('10');
  const [actualKegs, setActualKegs] = useState<string>('360');
  const [leftoverLitres, setLeftoverLitres] = useState<string>('20');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

    const result = logTruckIntake({
      productId,
      truckLabel: truckLabel.trim() || `TRK-${selectedProduct.name.split(' ')[0].toUpperCase()}-${Date.now().toString().slice(-4)}`,
      tons: parseFloat(tons) || 0,
      actualKegs: parseFloat(actualKegs) || 0,
      leftoverLitres: parseFloat(leftoverLitres) || 0
    });

    if (result.success) {
      setSuccessMessage(`Tank ${result.tank?.truck_label} logged successfully with ${result.tank?.received_litres.toLocaleString()}L!`);
      // Reset form
      setTruckLabel('');
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
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span>Truck Intake & Volumetric Offload</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Convert delivery tonnage into litres and {settings.litres_per_keg}L kegs. Automatic shortfall detection and capacity checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300">
            <span className="text-slate-500 dark:text-slate-400">Depot Kegs:</span>{' '}
            <span className={`font-bold ${kegInventory.isDepotStockCritical ? 'text-rose-600 dark:text-rose-400' : 'text-brand-600 dark:text-brand-400'}`}>
              {kegInventory.kegsAtDepot}
            </span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in sticky top-4 z-40 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">{successMessage}</span>
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
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Intake Parameters & Offload Data</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">1 Keg = {settings.litres_per_keg} Litres</span>
          </div>

          {/* Product Select */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Select Product</label>
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
                      <div className="text-xs font-bold">{p.name}</div>
                      <div className="text-[10px] opacity-75 font-mono">~{p.litres_per_ton} L/Ton</div>
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

          {/* Truck Label Identifier */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Truck Identification / Driver Name
            </label>
            <input
              type="text"
              placeholder="e.g. TRK-VEG-909 (Mallam Aliyu)"
              value={truckLabel}
              onChange={e => setTruckLabel(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Scale Weight in Tons */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Delivery Weight (Metric Tons)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
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
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-base font-mono font-bold focus:outline-none focus:border-brand-500"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                TONS
              </span>
            </div>
          </div>

          {/* Physical Recovered Offload Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Actual Kegs Filled */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
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
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            {/* Leftover Bulk Litres */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
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
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Depot Capacity Warning Banner */}
          {metrics.exceedsDepotKegCapacity && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5 animate-in fade-in">
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
            className="w-full py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <ArrowDownToLine className="w-4 h-4 text-slate-950" />
            <span>Complete Offload & Create Active Depot Tank</span>
          </button>
        </form>

        {/* Right Column: Live Reconciliation Preview & Shortfall Gauge (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Mathematical Conversion Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Live Volumetric Conversion
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold">
                Formula Verified
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Expected Litres ({tons || 0}T):</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{metrics.expectedLitres.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Expected 30L Kegs:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">~{metrics.expectedKegs} kegs</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>Recovered Volume:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{metrics.recoveredLitres.toLocaleString()} L</span>
              </div>

              {/* Live Shortfall Gauge / Alert */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-sans font-bold text-slate-700 dark:text-slate-300 text-xs">Delivery Variance:</span>
                  <span
                    className={`font-mono font-black text-sm px-2 py-0.5 rounded-md ${
                      isShortfallTriggered
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30'
                        : metrics.shortfall > 0
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {metrics.shortfall > 0 ? `-${metrics.shortfall} L` : `${metrics.shortfall} L`}
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

          {/* New Tank Visual Preview */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm flex flex-col items-center">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider self-start">
              Offload Tank Level Simulation
            </span>
            <TankGauge
              productId={productId}
              productName={`Simulated ${selectedProduct.name} Offload`}
              remainingLitres={metrics.recoveredLitres}
              totalCapacityLitres={Math.max(15000, metrics.expectedLitres * 1.2)}
              truckLabel={truckLabel || 'New Incoming Delivery'}
              shortfall={metrics.shortfall}
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Historical Offload Variance Table & Mobile Cards */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Depot Storage Tanks & Offload Variance Log</span>
          </h3>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {tanks.length} Total Tanks Logged
          </span>
        </div>

        {/* Desktop Dense Table */}
        <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Tank Identifier</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Intake Date</th>
                <th className="px-4 py-3 text-right">Tonnage</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3 text-right">Shortfall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-mono">
              {tanks.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-200 font-sans">
                    {t.truck_label}
                  </td>
                  <td className="px-4 py-3 uppercase font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.product_id === 'veg' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                    }`}>
                      {t.product_id === 'veg' ? 'Golden Oil' : 'Palm Oil'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {formatDepotDate(t.date)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                    {t.tons} T
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                    {t.received_litres.toLocaleString()} L
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brand-600 dark:text-brand-400">
                    {t.remaining_litres.toLocaleString()} L
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.shortfall > settings.truck_shortfall_threshold
                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-extrabold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {t.shortfall > 0 ? `-${t.shortfall}L` : '0L'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Touch Cards */}
        <div className="sm:hidden space-y-3">
          {tanks.map(t => (
            <div
              key={t.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono"
            >
              <div className="flex items-center justify-between font-sans">
                <span className="font-bold text-slate-900 dark:text-white">{t.truck_label}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  t.product_id === 'veg' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                }`}>
                  {t.product_id === 'veg' ? 'Golden Oil' : 'Palm Oil'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-500 block">Date</span>
                  <span className="text-slate-800 dark:text-slate-200">{formatDepotDate(t.date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tonnage</span>
                  <span className="text-slate-800 dark:text-slate-200">{t.tons} Tons</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Remaining / Received</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">
                    {t.remaining_litres.toLocaleString()} / {t.received_litres.toLocaleString()} L
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Shortfall</span>
                  <span className={`font-bold ${t.shortfall > settings.truck_shortfall_threshold ? 'text-rose-600' : 'text-slate-600'}`}>
                    {t.shortfall > 0 ? `-${t.shortfall} L` : '0 L'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
