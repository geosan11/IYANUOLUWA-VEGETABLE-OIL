import React, { useEffect, useState } from 'react';
import { listAllProfiles, updateProfileAccess, AuthProfile } from '../../services/auth';
import { useStore } from '../../services/store';
import { NAV_ITEMS, getVisibleNavItems } from '../../constants/nav';
import type { UserRole } from '../../types';
import { ShieldCheck, ArrowsClockwise, Check, WarningCircle } from '@phosphor-icons/react';

const ROLE_OPTIONS: { id: UserRole; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'hub_manager', label: 'Hub Manager' },
  { id: 'staff', label: 'Counter Staff' },
  { id: 'driver', label: 'Driver' }
];

interface DraftRow {
  role: UserRole;
  hubId: string | null;
  /** null = "use the role default"; an array (however short) = an explicit override. */
  allowedScreens: string[] | null;
}

/**
 * Owner-only screen: every real Supabase account (from `profiles`), with a
 * role picker, a hub assignment picker, and a per-user screen checklist that
 * overrides the role default. Writes straight to Supabase — RLS
 * (`profiles_owner_update` + the role-change guard trigger) is the real
 * backstop; this is the UI for it.
 */
export const ScreenAccessPanel: React.FC = () => {
  const { currentUser, hubs } = useStore();
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    setLoadError(null);
    listAllProfiles().then(({ profiles: rows, error }) => {
      setLoading(false);
      if (error) {
        setLoadError(error);
        return;
      }
      setProfiles(rows);
      setDrafts(
        Object.fromEntries(
          rows.map(p => [p.id, { role: p.role, hubId: p.hub_id, allowedScreens: p.allowed_screens ?? null }])
        )
      );
    });
  };

  useEffect(load, []);

  const isDirty = (p: AuthProfile) => {
    const d = drafts[p.id];
    if (!d) return false;
    if (d.role !== p.role) return true;
    if (d.hubId !== p.hub_id) return true;
    const a = d.allowedScreens ?? [];
    const b = p.allowed_screens ?? [];
    return a.length !== b.length || a.some(id => !b.includes(id));
  };

  const toggleScreen = (userId: string, screenId: string) => {
    setDrafts(prev => {
      const current = prev[userId];
      if (!current) return prev;
      const base = current.allowedScreens ?? getVisibleNavItems(current.role, null).map(i => i.id);
      const next = base.includes(screenId) ? base.filter(id => id !== screenId) : [...base, screenId];
      return { ...prev, [userId]: { ...current, allowedScreens: next } };
    });
  };

  const resetToDefault = (userId: string) => {
    setDrafts(prev => ({ ...prev, [userId]: { ...prev[userId], allowedScreens: null } }));
  };

  const save = async (p: AuthProfile) => {
    const d = drafts[p.id];
    if (!d) return;
    setSavingId(p.id);
    setRowMessage(prev => ({ ...prev, [p.id]: '' }));
    const { error } = await updateProfileAccess(p.id, {
      role: d.role,
      hub_id: d.role === 'owner' ? null : d.hubId,
      allowed_screens: d.allowedScreens
    });
    setSavingId(null);
    if (error) {
      setRowMessage(prev => ({ ...prev, [p.id]: error }));
      return;
    }
    setProfiles(prev =>
      prev.map(row => (row.id === p.id ? { ...row, role: d.role, hub_id: d.role === 'owner' ? null : d.hubId, allowed_screens: d.allowedScreens } : row))
    );
    setRowMessage(prev => ({ ...prev, [p.id]: 'Saved. Takes effect next time they load the app.' }));
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span>9. Live Account Screen Access</span>
          </h3>
          <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Real signed-in accounts. Set exactly which screens each person can see, or leave a role
            on its default set. Owner always sees everything.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
          title="Refresh list"
        >
          <ArrowsClockwise className="w-4 h-4" />
        </button>
      </div>

      {loading && (
        <p className="text-xs font-sans text-slate-400 py-4 text-center">Loading accounts…</p>
      )}

      {loadError && !loading && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-sans">
          <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
          <span>{loadError}</span>
        </div>
      )}

      {!loading && !loadError && profiles.length === 0 && (
        <p className="text-xs font-sans text-slate-400 py-4 text-center">
          No accounts yet — send the login screen's "Create account" link to your team.
        </p>
      )}

      <div className="space-y-3">
        {profiles.map(p => {
          const draft = drafts[p.id];
          if (!draft) return null;
          const isCurrent = p.id === currentUser.id;
          const dirty = isDirty(p);

          return (
            <div
              key={p.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 flex items-center justify-center font-bold text-sm shrink-0">
                    {(p.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-[14px] text-slate-900 dark:text-white truncate">
                        {p.full_name || `Account ${p.id.slice(0, 8)}`}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-600 text-white font-sans text-[10px] font-bold">You</span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 truncate">{p.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {draft.role === 'owner' ? (
                    <span className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-sans font-semibold">
                      All hubs (owner)
                    </span>
                  ) : (
                    <select
                      value={draft.hubId ?? ''}
                      onChange={e =>
                        setDrafts(prev => ({ ...prev, [p.id]: { ...prev[p.id], hubId: e.target.value || null } }))
                      }
                      title="Assigned depot hub"
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans font-semibold text-slate-700 dark:text-slate-300"
                    >
                      <option value="">No hub assigned</option>
                      {hubs.map(h => (
                        <option key={h.id} value={h.id}>[{h.code}] {h.name}</option>
                      ))}
                    </select>
                  )}
                  <select
                    value={draft.role}
                    disabled={isCurrent}
                    onChange={e =>
                      setDrafts(prev => ({ ...prev, [p.id]: { ...prev[p.id], role: e.target.value as UserRole } }))
                    }
                    title={isCurrent ? "You can't change your own role here" : 'Change role'}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {draft.role === 'owner' ? (
                <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400 pl-[46px]">
                  Owners always see every screen — nothing to configure.
                </p>
              ) : (
                <div className="pl-[46px] space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {NAV_ITEMS.map(item => {
                      const effective = draft.allowedScreens ?? getVisibleNavItems(draft.role, null).map(i => i.id);
                      const checked = effective.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleScreen(p.id, item.id)}
                          aria-pressed={checked}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-sans font-bold border transition-all cursor-pointer ${
                            checked
                              ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" weight="bold" />}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {draft.allowedScreens !== null && (
                    <button
                      type="button"
                      onClick={() => resetToDefault(p.id)}
                      className="text-[11px] font-sans text-cyan-700 dark:text-cyan-400 hover:underline"
                    >
                      ↺ Use role default instead
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pl-[46px]">
                <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400">{rowMessage[p.id]}</span>
                <button
                  type="button"
                  onClick={() => save(p)}
                  disabled={!dirty || savingId === p.id}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-sans font-bold shrink-0 transition-all active:scale-95"
                >
                  {savingId === p.id ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScreenAccessPanel;
