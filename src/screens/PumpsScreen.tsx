import React, { useMemo, useState } from 'react';
import { useStore } from '../services/store';
import { usePermissions } from '../services/permissions';
import { calculatePumpMeterVariance, formatDepotDate, formatDepotTime, depotDateKey, getDepotToday } from '../services/businessLogic';
import { Modal } from '../components/common/Modal';
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
  Lock
} from '@phosphor-icons/react';

export const PumpsScreen: React.FC = () => {
  const { pumps, pumpReadings, orders, products, physicalTanks, settings, recordPumpReading, addPump, updatePump, deletePump } =
    useStore();
  const { isOwner } = usePermissions();

  const [loggerPumpId, setLoggerPumpId] = useState<string>(pumps[0]?.id || '');
  const [loggerReading, setLoggerReading] = useState('');
  const [loggerNote, setLoggerNote] = useState('');
  const [loggerMsg, setLoggerMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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

  const productName = (id?: string) => products.find(p => p.id === id)?.name || 'Unassigned';
  const tankLabel = (id?: string | null) => physicalTanks.find(t => t.id === id)?.label;

  const submitReading = (e: React.FormEvent) => {
    e.preventDefault();
    setLoggerMsg(null);
    const reading = Number(loggerReading);
    if (!loggerPumpId) return setLoggerMsg({ kind: 'err', text: 'Pick a pump.' });
    const res = recordPumpReading(loggerPumpId, reading, loggerNote.trim() || undefined);
    if (res.success) {
      setLoggerMsg({ kind: 'ok', text: `Logged ${reading.toLocaleString()} L on ${pumps.find(p => p.id === loggerPumpId)?.label}.` });
      setLoggerReading('');
      setLoggerNote('');
    } else {
      setLoggerMsg({ kind: 'err', text: res.error || 'Could not log the reading.' });
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
    if (!res.success) setEditErr(res.error || 'Could not remove pump.');
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

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center">
            <Fuel className="w-5 h-5 text-purple-700 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold text-slate-900 dark:text-white leading-tight">Pumps</h1>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Named pumps, daily meter readings, and metered-vs-sold reconciliation.
            </p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => setAddOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[12px] font-sans font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" weight="bold" /> Add pump
          </button>
        )}
      </div>

      {/* Register */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pumps.length === 0 && (
          <div className="col-span-full py-10 text-center text-[13px] text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
            No pumps registered yet.
          </div>
        )}
        {pumps.map(pump => {
          const dayAudits = auditsByPump[pump.id] || [];
          const latest = dayAudits[0];
          const alert = latest && latest.day === today && latest.isOverThreshold;
          return (
            <div
              key={pump.id}
              className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 space-y-2.5 ${
                alert ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-sans font-bold text-[14px] text-slate-900 dark:text-white">{pump.label}</div>
                  <div className="text-[11px] text-slate-500">{productName(pump.product_id)}</div>
                  <div className="text-[11px] text-slate-400">
                    Source: {tankLabel(pump.physical_tank_id) || 'Not set'}
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(pump)} className="p-1 rounded text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removePump(pump)} className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-[12px] font-mono tabular-nums">
                <span className="text-slate-500">Meter total</span>
                <span className="font-bold text-slate-900 dark:text-white">{pump.last_meter_reading.toLocaleString()} L</span>
              </div>
              <div
                className={`flex items-center gap-1.5 text-[11px] font-sans font-bold px-2 py-1 rounded-lg ${
                  alert
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {alert ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {latest
                  ? alert
                    ? `Today's variance ${latest.variance > 0 ? '+' : ''}${latest.variance} L`
                    : 'Reconciled'
                  : 'No readings yet'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Log a reading */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-brand-600 dark:text-brand-400" /> Log a meter reading
        </div>
        {pumps.length === 0 ? (
          <p className="text-[12px] text-slate-400">Add a pump first.</p>
        ) : (
          <form onSubmit={submitReading} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <label className="text-[11px] font-sans font-semibold text-slate-500 sm:col-span-1">
              Pump
              <select
                value={loggerPumpId}
                onChange={e => setLoggerPumpId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
              >
                {pumps.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} (last {p.last_meter_reading.toLocaleString()} L)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500">
              New reading (L)
              <input
                type="number"
                step="0.5"
                value={loggerReading}
                onChange={e => setLoggerReading(e.target.value)}
                required
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[13px]"
              />
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 sm:col-span-1">
              Note (optional)
              <input
                value={loggerNote}
                onChange={e => setLoggerNote(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
              />
            </label>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-sans font-bold text-[13px]"
            >
              Save reading
            </button>
          </form>
        )}
        {loggerMsg && (
          <div className={`text-[12px] ${loggerMsg.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {loggerMsg.text}
          </div>
        )}
      </div>

      {/* Reconciliation */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500">
          Daily reconciliation — metered vs sold
        </div>
        {pumps.every(p => (auditsByPump[p.id] || []).length === 0) ? (
          <p className="text-[12px] text-slate-400 py-4 text-center">Log a second reading on any pump to see its first day reconciled.</p>
        ) : (
          <div className="space-y-4">
            {pumps.map(pump => {
              const audits = auditsByPump[pump.id] || [];
              if (audits.length === 0) return null;
              return (
                <div key={pump.id}>
                  <div className="text-[12px] font-sans font-bold text-slate-700 dark:text-slate-300 mb-1.5">{pump.label}</div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-[12px]">
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
                          <tr key={i} className={a.isOverThreshold ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}>
                            <td className="px-3 py-2 font-sans font-semibold text-slate-800 dark:text-slate-200">{formatDepotDate(a.endDate)}</td>
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

      {/* Daily reading log */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="text-[12px] font-sans font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <History className="w-4 h-4 text-slate-400" /> Reading history
        </div>
        {readingsByDay.length === 0 ? (
          <p className="text-[12px] text-slate-400 py-4 text-center">No readings logged yet.</p>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {readingsByDay.map(([day, readings]) => (
              <div key={day}>
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {day === today ? 'Today' : formatDepotDate(readings[0].recorded_at)}
                </div>
                <div className="space-y-1">
                  {readings.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-[12px] py-1 border-b border-slate-100 dark:border-slate-800/70 last:border-0">
                      <span className="text-slate-600 dark:text-slate-300">
                        {pumps.find(p => p.id === r.pump_id)?.label || 'Unknown pump'}
                        {r.note ? ` — ${r.note}` : ''}
                      </span>
                      <span className="text-right font-mono tabular-nums">
                        <span className="font-bold text-slate-900 dark:text-white">{r.reading.toLocaleString()} L</span>
                        <span className="text-slate-400 ml-2">
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
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Lock className="w-3.5 h-3.5" /> Adding, renaming or removing pumps is owner-only.
        </div>
      )}

      {addOpen && (
        <Modal isOpen onClose={() => setAddOpen(false)} title={<span className="flex items-center gap-2"><Plus className="w-4 h-4 text-brand-500" /> Add pump</span>}>
          <form onSubmit={submitAddPump} className="space-y-3">
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Label
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Pump 3 (Veg Line 3)"
                required
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
              />
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Product it dispenses
              <select
                value={newProductId}
                onChange={e => setNewProductId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
              >
                <option value="">Unassigned</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Source tank
              <select
                value={newTankId}
                onChange={e => setNewTankId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
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
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Opening meter reading (L)
              <input
                type="number"
                value={newOpening}
                onChange={e => setNewOpening(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-[13px]"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[13px] font-sans font-semibold">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-brand-500 text-slate-950 text-[13px] font-sans font-bold">
                Add pump
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingPump && (
        <Modal isOpen onClose={() => setEditingPump(null)} title={<span className="flex items-center gap-2"><Pencil className="w-4 h-4 text-brand-500" /> Edit pump</span>}>
          <div className="space-y-3">
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Label
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
              />
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Product it dispenses
              <select
                value={editProductId}
                onChange={e => setEditProductId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
              >
                <option value="">Unassigned</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-sans font-semibold text-slate-500 block">
              Source tank
              <select
                value={editTankId}
                onChange={e => setEditTankId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[13px]"
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
            {editErr && <div className="text-[12px] text-rose-600 dark:text-rose-400">{editErr}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditingPump(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[13px] font-sans font-semibold">
                Cancel
              </button>
              <button onClick={submitEdit} className="px-4 py-2 rounded-xl bg-brand-500 text-slate-950 text-[13px] font-sans font-bold">
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PumpsScreen;
