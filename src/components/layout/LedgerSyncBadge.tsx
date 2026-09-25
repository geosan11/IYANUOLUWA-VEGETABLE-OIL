import React, { useEffect, useState } from 'react';
import { CloudCheck, CloudSlash } from '@phosphor-icons/react';
import { isSupabaseConfigured } from '../../services/supabase';
import { ledgerOutboxCount, subscribeLedgerOutbox } from '../../services/ledger';

/** Mirrors the queue at most this often, for flushes that happen in the background. */
const POLL_MS = 15000;

/**
 * Shows the state of the transactional sync in the header: nothing at all while
 * every sale, payment and stock intake has reached the database, an amber count
 * while rows are still queued on this device, and a grey cloud while the device
 * is offline.
 *
 * Deliberately silent rather than celebratory — a pill that says "all synced"
 * all day is furniture; the counter only appears when there is something for
 * the cashier to be aware of (their work is safe here, but not yet shared).
 */
export const LedgerSyncBadge: React.FC = () => {
  const [pending, setPending] = useState<number>(() => ledgerOutboxCount());
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  // The queue tells us the moment it grows or drains.
  useEffect(() => subscribeLedgerOutbox(setPending), []);

  // Connection changes, plus a slow poll as a safety net for background flushes.
  useEffect(() => {
    const sync = () => {
      setPending(ledgerOutboxCount());
      setOnline(navigator.onLine);
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    const timer = window.setInterval(sync, POLL_MS);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.clearInterval(timer);
    };
  }, []);

  // Nothing is queued and the device is connected: there is nothing to say.
  if (!isSupabaseConfigured || (pending === 0 && online)) return null;

  const title =
    pending > 0
      ? `${pending} ledger row(s) are saved on this device and will be written to the database automatically.`
      : 'No connection right now: new sales and payments are saved on this device and sync automatically once the network returns.';

  return (
    <div
      title={title}
      className={`flex items-center gap-1.5 h-9 px-2.5 rounded-xl border text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
        online
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-700 dark:text-amber-400'
          : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
      }`}
    >
      {online ? (
        <CloudCheck className="w-3.5 h-3.5 flex-shrink-0" weight="fill" />
      ) : (
        <CloudSlash className="w-3.5 h-3.5 flex-shrink-0" weight="fill" />
      )}
      <span>{pending > 0 ? `${pending} to sync` : 'Offline'}</span>
    </div>
  );
};

export default LedgerSyncBadge;
