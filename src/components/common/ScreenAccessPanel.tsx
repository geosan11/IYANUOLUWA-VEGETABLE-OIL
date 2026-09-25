import React, { useEffect, useState } from 'react';
import { listAllProfiles, updateProfileAccess, createStaffAccount, deleteStaffAccount, AuthProfile } from '../../services/auth';
import { useStore } from '../../services/store';
import { useToast } from '../../services/toast';
import { NAV_ITEMS, getVisibleNavItems } from '../../constants/nav';
import type { UserRole } from '../../types';
import { ShieldCheck, ArrowsClockwise, Check, WarningCircle, IdentificationBadge, Plus, Trash } from '@phosphor-icons/react';

/** Same sanitizer the create-staff-account Edge Function applies server-side
 * — mirrored here purely so the username preview shown while typing matches
 * what actually gets created. */
const sanitizeUsername = (raw: string) =>
  raw.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');

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
  fullName: string;
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
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('staff');
  const [inviteHubId, setInviteHubId] = useState<string>('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
          rows.map(p => [p.id, { role: p.role, hubId: p.hub_id, allowedScreens: p.allowed_screens ?? null, fullName: p.full_name || '' }])
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
    if (d.fullName !== (p.full_name || '')) return true;
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

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSending(true);
    setInviteMessage(null);
    const username = sanitizeUsername(inviteUsername);
    const { error } = await createStaffAccount(
      username,
      invitePassword,
      inviteRole,
      inviteRole === 'owner' ? null : inviteHubId || null,
      null,
      inviteName
    );
    setInviteSending(false);
    if (error) {
      setInviteMessage({ kind: 'err', text: error });
      showToast('error', error);
      return;
    }
    const okMsg = `Account created for "${username}". Give them the username and password directly — they can sign in right away.`;
    setInviteMessage({ kind: 'ok', text: okMsg });
    showToast('success', okMsg);
    setInviteName('');
    setInviteUsername('');
    setInvitePassword('');
    setInviteRole('staff');
    setInviteHubId('');
  };

  const save = async (p: AuthProfile) => {
    const d = drafts[p.id];
    if (!d) return;
    setSavingId(p.id);
    setRowMessage(prev => ({ ...prev, [p.id]: '' }));
    const { error } = await updateProfileAccess(p.id, {
      role: d.role,
      hub_id: d.role === 'owner' ? null : d.hubId,
      allowed_screens: d.allowedScreens,
      full_name: d.fullName.trim() || null
    });
    setSavingId(null);
    if (error) {
      setRowMessage(prev => ({ ...prev, [p.id]: error }));
      showToast('error', error);
      return;
    }
    setProfiles(prev =>
      prev.map(row =>
        row.id === p.id
          ? { ...row, role: d.role, hub_id: d.role === 'owner' ? null : d.hubId, allowed_screens: d.allowedScreens, full_name: d.fullName.trim() || null }
          : row
      )
    );
    setRowMessage(prev => ({ ...prev, [p.id]: 'Saved. Takes effect next time they load the app.' }));
    showToast('success', `${d.fullName.trim() || p.full_name || 'Account'} updated. Takes effect next time they load the app.`);
  };

  const remove = async (p: AuthProfile) => {
    const label = p.full_name || `Account ${p.id.slice(0, 8)}`;
    if (!window.confirm(`Permanently delete "${label}"? They will no longer be able to sign in. This cannot be undone.`)) {
      return;
    }
    setDeletingId(p.id);
    const { error } = await deleteStaffAccount(p.id);
    setDeletingId(null);
    if (error) {
      showToast('error', error);
      return;
    }
    setProfiles(prev => prev.filter(row => row.id !== p.id));
    setDrafts(prev => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
    showToast('success', `"${label}" removed. They can no longer sign in.`);
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-[18px] font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span>Team Members &amp; Screen Access</span>
          </h3>
          <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
            Real signed-in accounts. Set exactly which screens each person can see, or leave a role
            on its default set. Owner always sees everything.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setInviteOpen(v => !v)}
            className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-sans font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" weight="bold" />
            <span>Add Team Member</span>
          </button>
          <button
            type="button"
            onClick={load}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Refresh list"
          >
            <ArrowsClockwise className="w-4 h-4" />
          </button>
        </div>
      </div>

      {inviteOpen && (
        <form onSubmit={submitInvite} className="p-4 rounded-xl bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/60 space-y-3">
          <div className="flex items-center gap-2 text-xs font-sans font-bold text-cyan-800 dark:text-cyan-300">
            <IdentificationBadge className="w-4 h-4" weight="bold" />
            <span>Set a username &amp; password for them — no email invite needed</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Full name"
              className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans"
            />
            <input
              type="text"
              required
              value={inviteUsername}
              onChange={e => setInviteUsername(e.target.value)}
              placeholder="Username (e.g. musa.b)"
              className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans"
            />
            <input
              type="text"
              required
              minLength={6}
              value={invitePassword}
              onChange={e => setInvitePassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as UserRole)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans font-semibold"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            {inviteRole === 'owner' ? (
              <span className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-sans font-semibold flex items-center">
                All hubs (owner)
              </span>
            ) : (
              <select
                value={inviteHubId}
                onChange={e => setInviteHubId(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-sans font-semibold"
              >
                <option value="">No hub assigned</option>
                {hubs.map(h => (
                  <option key={h.id} value={h.id}>[{h.code}] {h.name}</option>
                ))}
              </select>
            )}
          </div>
          {inviteUsername && (
            <p className="text-[11px] font-sans text-cyan-700 dark:text-cyan-400">
              They'll sign in with username <strong className="font-mono">{sanitizeUsername(inviteUsername) || '—'}</strong> and the password you set.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {inviteMessage && (
              <span className={`text-[11px] font-sans ${inviteMessage.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {inviteMessage.text}
              </span>
            )}
            <button
              type="submit"
              disabled={inviteSending}
              className="ml-auto px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-sans font-bold transition-all active:scale-95"
            >
              {inviteSending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      )}

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
          No accounts yet — use the form above to add the first team member.
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
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200 flex items-center justify-center font-bold text-sm shrink-0">
                    {(draft.fullName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        value={draft.fullName}
                        onChange={e => setDrafts(prev => ({ ...prev, [p.id]: { ...prev[p.id], fullName: e.target.value } }))}
                        placeholder={`Account ${p.id.slice(0, 8)} — no name set`}
                        className="min-w-0 flex-1 px-2 py-1 -ml-2 rounded-lg bg-transparent hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 focus:border-cyan-400 font-heading font-bold text-[14px] text-slate-900 dark:text-white placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 transition-colors"
                      />
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-600 text-white font-sans text-[10px] font-bold shrink-0">You</span>
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
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      disabled={deletingId === p.id}
                      title="Delete this account"
                      className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 disabled:opacity-50 transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
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
