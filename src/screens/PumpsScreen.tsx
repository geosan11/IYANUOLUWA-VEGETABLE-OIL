import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { usePermissions } from '../services/permissions';
import { useToast } from '../services/toast';
import { calculatePumpMeterVariance, formatDepotDate, formatDepotTime, depotDateKey, getDepotToday, keepDigitsAndDecimal } from '../services/businessLogic';
import { Modal } from '../components/common/Modal';
import { PumpOdometerIllustration } from '../components/common/PumpOdometerIllustration';
import { Pump, PumpVarianceAudit } from '../types';
import {
  GasPump as Fuel,
  Plus,
  Pencil,
  Trash as Trash2,
  Gauge,
  ClockCounterClockwise as History,
  Warning as AlertTriangle,
  CheckCircle as CheckCircle2,
  Lock,
  ArrowsClockwise
} from '@phosphor-icons/react';

export const PumpsScreen: React.FC = () => {
  const { pumps, pumpReadings, orders, products, physicalTanks, settings, recordPumpReading, resetPumpMeter, addPump, updatePump, deletePump } =
    useStore();
  const { isOwner } = usePermissions();
  const { showToast } = useToast();

  const [loggerPumpId, setLoggerPumpId] = useState<string>(pumps[0]?.id || '');
  const [loggerReading, setLoggerReading] = useState('');
  const [loggerNote, setLoggerNote] = useState('');
  const [loggerWarning, setLoggerWarning] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newProductId, setNewProductId] = useState(products[0]?.id || '');
  const [newOpening, setNewOpening] = useState('0');
  const [newTankId, setNewTankId] = useState('');

  const [editingPump, setEditingPump] = useState<Pump | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editProductId, setEditProductId] = useState('');
  const [editTankId, setEditTankId] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<Pump | null>(null);
  const [resetStep, setResetStep] = useState<'form' | 'confirm'>('form');
  const [resetOldReading, setResetOldReading] = useState('0');
  const [resetReading, setResetReading] = useState('0');
  const [resetReason, setResetReason] = useState('');
  const [resetErr, setResetErr] = useState<string | null>(null);

  const productName = (id?: string) => products.find(p => p.id === id)?.name || 'Unassigned';
  const tankLabel = (id?: string | null) => physicalTanks.find(t => t.id === id)?.label;

  // Hub switches (and pump deletion) re-scope `pumps` without remounting this
  // screen — resync the selected logger pump so it never silently points at
  // a pump from a different hub.
  useEffect(() => {
    if (!pumps.some(p => p.id === loggerPumpId)) {
      setLoggerPumpId(pumps[0]?.id || '');
    }
  }, [pumps, loggerPumpId]);

  const submitReading = (e: React.FormEvent, confirmed = false) => {
    e.preventDefault();
    const reading = Number(loggerReading);
    if (!loggerPumpId) return showToast('error', 'Pick a pump.');
    const res = recordPumpReading(loggerPumpId, reading, loggerNote.trim() || undefined, confirmed);
    if (res.success) {
      setLoggerWarning(null);
      showToast('success', `Logged ${reading.toLocaleString()} L on ${pumps.find(p => p.id === loggerPumpId)?.label}.`);
      setLoggerReading('');
      setLoggerNote('');
    } else if (res.warning) {
      setLoggerWarning(res.warning);
    } else {
      setLoggerWarning(null);
      showToast('error', res.error || 'Could not log the reading.');
    }
  };

  const submitAddPump = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    addPump({
      label: newLabel.trim(),
      productId: newProductId || undefined,
      openingReading: Number(newOpening) || 0,
      physicalTankId: newTankId || null
    });
    setAddOpen(false);
    setNewLabel('');
    setNewOpening('0');
    setNewTankId('');
  };

  const openEdit = (pump: Pump) => {
    setEditingPump(pump);
    setEditLabel(pump.label);
    setEditProductId(pump.product_id || '');
    setEditTankId(pump.physical_tank_id || '');
    setEditErr(null);
  };

  const submitEdit = () => {
    if (!editingPump) return;
    updatePump(editingPump.id, {
      label: editLabel.trim(),
      product_id: editProductId || null,
      physical_tank_id: editTankId || null
    });
    setEditingPump(null);
  };

  const removePump = (pump: Pump) => {
    if (!window.confirm(`Remove ${pump.label}?`)) return;
    const res = deletePump(pump.id);
    if (!res.success) showToast('error', res.error || 'Could not remove pump.');
  };

  const openReset = (pump: Pump) => {
    setResetTarget(pump);
    setResetStep('form');
    setResetOldReading(String(pump.last_meter_reading || 0));
    setResetReading('0');
    setResetReason('');
    setResetErr(null);
  };

  const proceedToResetConfirm = () => {
    setResetErr(null);
    if (isNaN(Number(resetOldReading)) || resetOldReading.trim() === '') {
      setResetErr('Enter what the meter showed just before it was rubbed off.');
      return;
    }
    if (isNaN(Number(resetReading)) || resetReading.trim() === '') {
      setResetErr('Enter the new starting reading.');
      return;
    }
    if (!resetReason.trim()) {
      setResetErr('A reason is required.');
      return;
    }
    setResetStep('confirm');
  };

  const submitReset = () => {
    if (!resetTarget) return;
    const res = resetPumpMeter(resetTarget.id, Number(resetOldReading), Number(resetReading), resetReason);
    if (!res.success) {
      setResetErr(res.error || 'Could not reset the meter.');
      setResetStep('form');
      return;
    }
    setResetTarget(null);
  };

  // Reconciliation per pump, per day.
  const auditsByPump = useMemo(() => {
    const map: Record<string, PumpVarianceAudit[]> = {};
    for (const pump of pumps) {
      map[pump.id] = calculatePumpMeterVariance(pump, pumpReadings, orders, settings.pump_variance_threshold).reverse();
    }
    return map;
  }, [pumps, pumpReadings, orders, settings.pump_variance_threshold]);

  // Daily reading log, newest first, grouped by depot day.
  const readingsByDay = useMemo(() => {
    const groups = new Map<string, typeof pumpReadings>();
    const sorted = [...pumpReadings].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    for (const r of sorted) {
      const day = depotDateKey(r.recorded_at);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(r);
    }
    return Array.from(groups.entries());
  }, [pumpReadings]);

  const today = getDepotToday();

  // Active pump for illustration
  const selectedPumpForIllustration = pumps.find(p => p.id === loggerPumpId) || pumps[0];
  const selectedAudits = selectedPumpForIllustration ? auditsByPump[selectedPumpForIllustration.id] || [] : [];
  const latestSelectedAudit = selectedAudits[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-950/60 border border-purple-500/20 dark:border-purple-800 flex items-center justify-center">
            <Fuel className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-slate-900 dark:text-white leading-tight">
              Dispense Pumps & Meter Audits
            </h1>
            <p className="text-xs font-sans text-slate-500 dark:text-slate-400">
              Mechanical odometer readings, morning vs evening counts, and cashier sales reconciliation.
            </p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-sans font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" weight="bold" /> Add Pump
          </button>
        )}
      </div>

      {/* Visual Odometer Illustration */}
      {selectedPumpForIllustration && (
        <PumpOdometerIllustration
          pumpName={selectedPumpForIllustration.label}
          openingReading={latestSelectedAudit ? latestSelectedAudit.startReading : selectedPumpForIllustration.last_meter_reading}
          currentReading={latestSelectedAudit ? latestSelectedAudit.endReading : selectedPumpForIllustration.last_meter_reading}
          recordedSalesLitres={latestSelectedAudit ? latestSelectedAudit.expectedLitres : 0}
          tankName={tankLabel(selectedPumpForIllustration.physical_tank_id) || 'Yard Storage Tank'}
          onReset={isOwner ? () => openReset(selectedPumpForIllustration) : undefined}
        />
      )}

      {/* Register Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {pumps.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
            No pumps registered yet. Click &ldquo;Add Pump&rdquo; to configure your depot dispensers.
          </div>
        )}
        {pumps.map(pump => {
          const dayAudits = auditsByPump[pump.id] || [];
          const latest = dayAudits[0];
          const alert = latest && latest.day === today && latest.isOverThreshold;
          const isVeg = pump.product_id === 'veg';

          return (
            <div
              key={pump.id}
              className={`p-4 rounded-2xl depot-card border space-y-2.5 transition-all cursor-pointer ${
                pump.id === loggerPumpId ? 'ring-2 ring-amber-500/40' : ''
              } ${
                alert ? 'border-rose-300 dark:border-rose-800 shadow-glow-rose' : 'border-slate-200 dark:border-slate-800'
              }`}
              onClick={() => setLoggerPumpId(pump.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-heading font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: isVeg ? '#F59E0B' : '#EF4444' }}
                    />
                    <span>{pump.label}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-sans">{productName(pump.product_id)}</div>
                  <div className="text-xs text-slate-400 font-sans">
                    Source: {tankLabel(pump.physical_tank_id) || 'Yard Tank'}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openReset(pump)} title="Reset meter (new/replaced meter)" className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                      <ArrowsClockwise className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(pump)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removePump(pump)} className="p-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-mono tabular-nums pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 font-sans">Current Meter:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{pump.last_meter_reading.toLocaleString()} L</span>
              </div>
              <div
                className={`flex items-center gap-1.5 text-xs font-sans font-bold px-2 py-1 rounded-lg ${
                  alert
                    ? 'badge-rose'
                    : 'badge-emerald'
                }`}
              >
                {alert ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {latest
                  ? alert
                    ? `Today's variance ${latest.variance > 0 ? '+' : ''}${latest.variance} L`
                    : 'Meter Reconciled (OK)'
                  : 'Opening Logged'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log a reading */}
      <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 space-y-3 shadow-card-light dark:shadow-card-dark">
        <div className="text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-amber-500" />
          <span>Record Daily Meter Reading (Morning or Evening)</span>
        </div>
        {pumps.length === 0 ? (
          <p className="text-xs text-slate-400">Add a pump first to log meter counts.</p>
        ) : (
          <form onSubmit={submitReading} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 sm:col-span-1">
              Select Pump
              <select
                value={loggerPumpId}
                onChange={e => setLoggerPumpId(e.target.value)}
                className="depot-input mt-1 w-full px-3 py-2.5 rounded-xl text-sm font-sans font-semibold"
              >
                {pumps.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} (Current: {p.last_meter_reading.toLocaleString()} L)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400">
              Meter Reading (Litres)
              <input
                type="number"
                step="0.1"
                min="0"
                value={loggerReading}
                onChange={e => {
                  setLoggerReading(keepDigitsAndDecimal(e.target.value));
                  setLoggerWarning(null);
                }}
                placeholder="e.g. 143830.5"
                required
                className="depot-input mt-1 w-full px-3 py-2.5 rounded-xl font-mono font-bold text-sm"
              />
            </label>
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 sm:col-span-1">
              Shift Note (optional)
              <input
                value={loggerNote}
                onChange={e => setLoggerNote(e.target.value)}
                placeholder="e.g. Evening close"
                className="depot-input mt-1 w-full px-3 py-2.5 rounded-xl text-sm font-sans"
              />
            </label>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-sm active:scale-98 transition-all"
            >
              Save Reading
            </button>
          </form>
        )}
        {loggerWarning && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-sans">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
            <div className="flex-1 space-y-2">
              <p className="font-medium">{loggerWarning}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={e => submitReading(e as unknown as React.FormEvent, true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Log it anyway
                </button>
                <button
                  type="button"
                  onClick={() => setLoggerWarning(null)}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 font-semibold"
                >
                  Let me fix it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reconciliation Table */}
      <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 space-y-3 shadow-card-light dark:shadow-card-dark">
        <div className="text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Daily Reconciliation — Metered Volume vs Cashier Sales
        </div>
        {pumps.every(p => (auditsByPump[p.id] || []).length === 0) ? (
          <p className="text-xs text-slate-400 py-4 text-center">Log a second reading on any pump to compute its daily meter variance.</p>
        ) : (
          <div className="space-y-4">
            {pumps.map(pump => {
              const audits = auditsByPump[pump.id] || [];
              if (audits.length === 0) return null;
              return (
                <div key={pump.id}>
                  <div className="text-xs font-heading font-bold text-slate-800 dark:text-slate-200 mb-1.5">{pump.label}</div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] uppercase tracking-wider text-slate-500 font-sans">
                        <tr>
                          <th className="text-left px-3 py-2">Day</th>
                          <th className="text-right px-3 py-2">Metered</th>
                          <th className="text-right px-3 py-2">Sold</th>
                          <th className="text-right px-3 py-2">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {audits.map((a, i) => (
                          <tr key={i} className={a.isOverThreshold ? 'bg-rose-500/10' : ''}>
                            <td className="px-3 py-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                              {formatDepotDate(a.endDate)}
                              <span className="ml-1.5 font-mono font-normal text-slate-400">{formatDepotTime(a.endDate)}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">{a.meterDelta.toLocaleString()} L</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">{a.expectedLitres.toLocaleString()} L</td>
                            <td
                              className={`px-3 py-2 text-right font-mono tabular-nums font-bold ${
                                a.isOverThreshold ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {a.variance > 0 ? '+' : ''}
                              {a.variance} L
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reading history */}
      <div className="p-5 rounded-2xl depot-card border border-slate-200 dark:border-slate-800 space-y-3 shadow-card-light dark:shadow-card-dark">
        <div className="text-xs font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <History className="w-4 h-4 text-slate-400" />
          <span>Meter Reading Audit Log</span>
        </div>
        {readingsByDay.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No readings logged yet.</p>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {readingsByDay.map(([day, readings]) => (
              <div key={day}>
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {day === today ? 'Today' : formatDepotDate(readings[0].recorded_at)}
                </div>
                <div className="space-y-1">
                  {readings.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/70 last:border-0">
                      <span className="text-slate-600 dark:text-slate-300 font-sans">
                        {r.is_reset && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase mr-1.5">
                            <ArrowsClockwise className="w-3 h-3" /> Reset
                          </span>
                        )}
                        {pumps.find(p => p.id === r.pump_id)?.label || 'Unknown pump'}
                        {r.note ? ` — ${r.note}` : ''}
                      </span>
                      <span className="text-right font-mono tabular-nums">
                        <span className="font-bold text-slate-900 dark:text-white">{r.reading.toLocaleString()} L</span>
                        <span className="text-slate-400 ml-2 text-xs">
                          {formatDepotTime(r.recorded_at)} · {r.recorded_by || 'staff'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="flex items-center gap-2 text-xs text-slate-400 font-sans">
          <Lock className="w-3.5 h-3.5" /> Adding, renaming, or removing pumps is restricted to depot managers.
        </div>
      )}

      {addOpen && (
        <Modal isOpen onClose={() => setAddOpen(false)} title={<span className="flex items-center gap-2"><Plus className="w-4 h-4 text-amber-500" /> Add Pump</span>}>
          <form onSubmit={submitAddPump} className="space-y-3">
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
              Label
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Pump 3 (Veg Line 3)"
                required
                className="depot-input mt-1 w-full px-3 py-2 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
              Product it dispenses
              <select
                value={newProductId}
                onChange={e => setNewProductId(e.target.value)}
                className="depot-input mt-1 w-full px-3 py-2 rounded-xl text-sm"
              >
                <option value="">Unassigned</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
              Source tank
              <select
                value={newTankId}
                onChange={e => setNewTankId(e.target.value)}
                className="depot-input mt-1 w-full px-3 py-2 rounded-xl text-sm"
              >
                <option value="">Not set</option>
                {physicalTanks
                  .filter(t => !newProductId || t.product_id === newProductId)
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
              Opening meter reading (L)
              <input
                type="number"
                step="0.1"
                min="0"
                value={newOpening}
                onChange={e => setNewOpening(keepDigitsAndDecimal(e.target.value))}
                className="depot-input mt-1 w-full px-3 py-2 rounded-xl font-mono font-bold text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-sans font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-sans font-bold">
                Add Pump
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingPump && (
        <Modal isOpen onClose={() => setEditingPump(null)} title={<span className="flex items-center gap-2"><Pencil className="w-4 h-4 text-amber-500" /> Edit Pump</span>}>
          <div className="space-y-3">
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
              Label
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="depot-input mt-1 w-full px-3 py-2 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
              Product it dispenses
              <select
                value={editProductId}
                onChange={e => setEditProductId(e.target.value)}
                className="depot-input mt-1 w-full px-3 py-2 rounded-xl text-sm"
              >
                <option value="">Unassigned</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
              Source tank
              <select
                value={editTankId}
                onChange={e => setEditTankId(e.target.value)}
                className="depot-input mt-1 w-full px-3 py-2 rounded-xl text-sm"
              >
                <option value="">Not set</option>
                {physicalTanks
                  .filter(t => !editProductId || t.product_id === editProductId)
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
              </select>
            </label>
            {editErr && <div className="text-xs text-rose-600 dark:text-rose-400">{editErr}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditingPump(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-sans font-semibold">
                Cancel
              </button>
              <button onClick={submitEdit} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-sans font-bold">
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal
          isOpen
          onClose={() => setResetTarget(null)}
          title={<span className="flex items-center gap-2"><ArrowsClockwise className="w-4 h-4 text-blue-500" /> Reset Meter — {resetTarget.label}</span>}
        >
          {resetStep === 'form' ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs font-sans">
                Use this when the meter's been rubbed off / zeroed for a new batch, or the physical unit was replaced.
                Both numbers below are saved to history — nothing is lost, and every future reading is compared against
                the new value, not the old one.
              </div>
              <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
                Final reading before it was rubbed off (L)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={resetOldReading}
                  onChange={e => setResetOldReading(keepDigitsAndDecimal(e.target.value))}
                  className="depot-input mt-1 w-full px-3 py-2 rounded-xl font-mono font-bold text-sm"
                />
                <span className="block mt-1 text-[11px] font-normal text-slate-400">
                  Pre-filled from the last logged reading — correct it if the meter had moved on since then.
                </span>
              </label>
              <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
                New starting meter reading (L)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={resetReading}
                  onChange={e => setResetReading(keepDigitsAndDecimal(e.target.value))}
                  className="depot-input mt-1 w-full px-3 py-2 rounded-xl font-mono font-bold text-sm"
                />
              </label>
              <label className="text-xs font-sans font-semibold text-slate-600 dark:text-slate-400 block">
                Reason (required — kept in the audit log)
                <input
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  placeholder="e.g. New drum/batch started, meter zeroed"
                  required
                  className="depot-input mt-1 w-full px-3 py-2 rounded-xl text-sm"
                />
              </label>
              {resetErr && <div className="text-xs text-rose-600 dark:text-rose-400">{resetErr}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setResetTarget(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-sans font-semibold">
                  Cancel
                </button>
                <button onClick={proceedToResetConfirm} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-sans font-bold">
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-sans font-semibold">
                Do you want to rub off this meter? Please confirm — this cannot be undone.
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 text-sm font-sans overflow-hidden">
                <div className="flex justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/60">
                  <span className="text-slate-500">Final reading saved</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{Number(resetOldReading).toLocaleString()} L</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-slate-500">Resets to</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{Number(resetReading).toLocaleString()} L</span>
                </div>
                <div className="px-3 py-2">
                  <span className="text-slate-500 block text-xs mb-0.5">Reason</span>
                  <span className="text-slate-800 dark:text-slate-200">{resetReason}</span>
                </div>
              </div>
              {resetErr && <div className="text-xs text-rose-600 dark:text-rose-400">{resetErr}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setResetStep('form')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-sans font-semibold">
                  Go back
                </button>
                <button onClick={submitReset} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-sans font-bold">
                  Yes, rub off &amp; reset
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default PumpsScreen;
