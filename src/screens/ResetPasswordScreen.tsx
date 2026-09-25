import React, { useState } from 'react';
import { useAuth } from '../services/auth';
import { useToast } from '../services/toast';
import { LockKey, ArrowRight, WarningCircle, Spinner, SignOut } from '@phosphor-icons/react';
import { AuthShell } from '../components/common/AuthShell';

/** GoTrue's own minimum, so the client rejects nothing the server would accept. */
const MIN_PASSWORD_LENGTH = 6;

/**
 * Shown only while `passwordRecovery` is true — i.e. the user opened a reset
 * link and the client turned its tokens into a session (see AuthGate). It is
 * never reachable by navigation, so it offers no "cancel" that would pretend
 * the old password still works; the escape hatch is signing out.
 */
export const ResetPasswordScreen: React.FC = () => {
  const { updatePassword, signOut } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      const msg = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      setError(msg);
      showToast('error', msg);
      return;
    }
    if (password !== confirm) {
      const msg = 'Both passwords must match.';
      setError(msg);
      showToast('error', msg);
      return;
    }

    setSubmitting(true);
    const { error: err } = await updatePassword(password);
    setSubmitting(false);
    if (err) {
      setError(err);
      showToast('error', err);
      return;
    }
    // Clearing the recovery flag re-renders AuthGate straight into the app —
    // there is nothing to navigate to here.
    showToast('success', 'Password updated — you are signed in.');
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Password recovery"
      footer="Reset links expire after a short while. If this one has stopped working, request a new one from the sign-in screen."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1">
          <label
            htmlFor="reset-password"
            className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block"
          >
            New password
          </label>
          <div className="relative">
            <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              autoFocus
              required
              className="depot-input pl-10"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="reset-confirm"
            className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block"
          >
            Confirm new password
          </label>
          <div className="relative">
            <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="reset-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat the password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="depot-input pl-10"
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 p-3 rounded-xl badge-rose text-xs font-sans"
          >
            <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
        >
          {submitting ? (
            <Spinner className="w-4 h-4 animate-spin" weight="bold" />
          ) : (
            <>
              <span>Save new password</span>
              <ArrowRight className="w-4 h-4" weight="bold" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => signOut()}
          className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-sans font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <SignOut className="w-4 h-4" weight="bold" />
          Sign out instead
        </button>
      </form>
    </AuthShell>
  );
};

export default ResetPasswordScreen;
