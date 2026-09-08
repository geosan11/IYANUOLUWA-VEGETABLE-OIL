import React, { useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { TankGauge } from '../components/common/TankGauge';
import { calculateIntakeMetrics, formatDepotDate } from '../services/businessLogic';
import { LITRES_PER_KEG } from '../constants/config';
import {
  Truck,
  CheckCircle2,
  Scale,
  Boxes,
  ArrowDownToLine,
  Info
} from 'lucide-react';

export const TruckIntakeScreen: React.FC = () => {
  const { products, tanks, kegInventory, logTruckIntake } = useStore();

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
      LITRES_PER_KEG
    );
  }, [tons, selectedProduct, actualKegs, leftoverLitres, kegInventory.kegsAtDepot]);

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
    <div className="space-y-6 pb-12">
      {/* Page Title & Context Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <span>Truck Intake & Volumetric Offload</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Convert incoming delivery scale weight tonnage into litres and standard 30L keg units. Flags delivery shortfall and yard capacity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
            <span className="text-slate-400">Depot Kegs Available:</span>{' '}
            <span className={`font-bold ${kegInventory.isDepotStockCritical ? 'text-rose-400' : 'text-brand-400'}`}>
              {kegInventory.kegsAtDepot}
            </span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main 2-Column Counter Form & Live Preview Layout (Desktop-First) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Data Entry Form (lg:col-span-7) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-brand-400" />
              <span>Intake Parameters & Offload Data</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">1 Keg = {LITRES_PER_KEG} Litres</span>
          </div>

          {/* Product Select */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Select Product</label>
            <div className="grid grid-cols-2 gap-3">
              {products.map(p => {
                const isSelected = p.id === productId;
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
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-950'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-100">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {p.litres_per_ton.toLocaleString()} L / Ton
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

          {/* Truck / Driver Reference */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Truck & Driver Reference</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional plate/name</span>
            </label>
            <input
              type="text"
              value={truckLabel}
              onChange={e => setTruckLabel(e.target.value)}
              placeholder="e.g. LAG-492-XA (Driver Aliyu)"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {/* Scale Weight in Tons */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Delivery Weight (Tons)</span>
              <span className="text-[10px] text-brand-400 font-mono font-semibold">
                Expected: {metrics.expectedLitres.toLocaleString()} L (≈ {metrics.expectedKegs} Kegs)
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={tons}
                onChange={e => setTons(e.target.value)}
                className="w-full pl-4 pr-14 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono font-bold focus:outline-none focus:border-brand-500"
                placeholder="10.00"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                TONS
              </span>
            </div>
          </div>

          {/* Physical Recovered Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Actual Kegs Filled */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Actual Kegs Filled (30L)</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ={(parseFloat(actualKegs) || 0) * LITRES_PER_KEG} L
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={actualKegs}
                  onChange={e => setActualKegs(e.target.value)}
                  className="w-full pl-4 pr-14 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
                  placeholder="360"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  KEGS
                </span>
              </div>
            </div>

            {/* Leftover Litres in Tank/Hose */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Leftover Litres Recovered</span>
                <span className="text-[10px] text-slate-400 font-normal">Loose oil</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={leftoverLitres}
                  onChange={e => setLeftoverLitres(e.target.value)}
                  className="w-full pl-4 pr-14 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-brand-500"
                  placeholder="0"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                  LITRES
                </span>
              </div>
            </div>
          </div>

          {/* Informational Keg Capacity Warning */}
          {metrics.exceedsDepotKegCapacity && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Depot Keg Capacity Alert:</span>
                This delivery requires ≈ {metrics.expectedKegs} kegs, but depot only has {kegInventory.kegsAtDepot} empty company kegs. Oil can still be received into bulk holding tanks or customer containers.
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 active:scale-[0.99] text-slate-950 font-black text-xs shadow-lg shadow-brand-500/25 uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Confirm & Log Tank In-Feed ({metrics.recoveredLitres.toLocaleString()} Litres)</span>
          </button>
        </form>

        {/* Right Column: Live Calculation Card & Live Shortfall Gauge (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between h-full">
            <div>
              <div className="border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Live Intake Reconciliation & Shortfall Analysis
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real-time variance check calculated before submit.
                </p>
              </div>

              {/* Metric Breakdown Table */}
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Scale Weight:</span>
                  <span className="font-bold text-slate-200">{tons || 0} Tons</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Density Factor:</span>
                  <span className="text-slate-300">{selectedProduct.litres_per_ton} L/Ton</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Expected Volume:</span>
                  <span className="font-bold text-slate-100">
                    {metrics.expectedLitres.toLocaleString()} L
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Total Recovered:</span>
                  <span className="font-bold text-emerald-400">
                    {metrics.recoveredLitres.toLocaleString()} L
                  </span>
                </div>

                {/* LIVE SHORTFALL / VARIANCE CARD (Flagged Red if > 50L) */}
                <div
                  className={`p-4 rounded-xl border mt-3 transition-all ${
                    metrics.isShortfallHigh
                      ? 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                      : metrics.shortfall > 0
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                      : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Delivery Shortfall / Loss
                    </span>
                    {metrics.isShortfallHigh && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                        HIGH VARIANCE (&gt;50L)
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-black">
                    {metrics.shortfall > 0 ? `-${metrics.shortfall.toFixed(1)} L` : `${metrics.shortfall.toFixed(1)} L`}
                  </div>
                  <div className="text-[10px] mt-1 opacity-80 font-sans">
                    {metrics.isShortfallHigh
                      ? 'Shrinkage exceeds the 50L tolerance limit. Flag driver invoice for depot manager audit.'
                      : metrics.shortfall > 0
                      ? 'Within acceptable transport thermal contraction limits.'
                      : 'Zero loss / bonus yield offloaded.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Gauge Preview of the New Tank */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-center">
              <TankGauge
                productId={productId}
                productName={`${selectedProduct.name} Preview`}
                remainingLitres={metrics.recoveredLitres}
                totalCapacityLitres={metrics.expectedLitres || 15000}
                size="md"
                shortfall={metrics.shortfall}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop-First Dense Tank Inventory & Variance Table */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-brand-400" />
              <span>Depot Storage Tanks & Offload Variance Log</span>
            </h3>
            <p className="text-xs text-slate-400">
              Complete historical ledger of received trucks and remaining FIFO draw balances.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {tanks.length} Total Tanks Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Date Logged</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Truck / Driver</th>
                <th className="py-2.5 px-3 text-right">Tons</th>
                <th className="py-2.5 px-3 text-right">Received (L)</th>
                <th className="py-2.5 px-3 text-right">Remaining (L)</th>
                <th className="py-2.5 px-3 text-right">Depletion %</th>
                <th className="py-2.5 px-3 text-right">Shortfall</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tanks.map((tank, idx) => {
                const product = products.find(p => p.id === tank.product_id);
                const pct = Math.min(100, Math.max(0, (tank.remaining_litres / (tank.received_litres || 1)) * 100));
                const isVeg = tank.product_id === 'veg';
                const isDrained = tank.remaining_litres <= 0.01;

                return (
                  <tr
                    key={tank.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-3 text-slate-300">
                      {formatDepotDate(tank.date)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isVeg
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                        />
                        {product?.name || tank.product_id}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-200">
                      {tank.truck_label}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-300">
                      {tank.tons.toFixed(2)} T
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-100">
                      {tank.received_litres.toLocaleString()} L
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      <span className={isDrained ? 'text-slate-400' : isVeg ? 'text-amber-400' : 'text-rose-400'}>
                        {tank.remaining_litres.toLocaleString()} L
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isVeg ? 'bg-amber-400' : 'bg-rose-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 w-8 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {tank.shortfall > 50 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          -{tank.shortfall.toFixed(0)} L
                        </span>
                      ) : tank.shortfall > 0 ? (
                        <span className="text-slate-400">-{tank.shortfall.toFixed(0)} L</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">0 L</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isDrained ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400">
                          Depleted
                        </span>
                      ) : idx === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                          FIFO Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
                          Standby
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
