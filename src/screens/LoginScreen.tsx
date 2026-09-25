import React, { useState } from 'react';
import { useAuth } from '../services/auth';
import { useToast } from '../services/toast';
import {
  Envelope,
  LockKey,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  Spinner
} from '@phosphor-icons/react';
import { AuthShell } from '../components/common/AuthShell';

/** Which form the single auth card is showing. */
type View = 'sign-in' | 'forgot';

/**
 * Signed-out entry point.
 *
 * There is deliberately NO self-service sign-up: staff accounts are created
 * for them by an owner (Team & Access → add a team member, with or without an
 * email), and the first owner account is created in the Supabase dashboard —
 * see SCHEMA.md. A "create account" form here was the one path that let anyone
 * mint a `staff`-role account, so the only self-service route left is "Forgot
 * password" — and even that needs a real inbox, because owner-created usernames
 * live on a synthetic address that can't receive mail.
 *
 * Brand header, card and footer come from AuthShell so this stays identical to
 * the forgot-password and set-a-new-password views.
 */
export const LoginScreen: React.FC = () => {
  const { signIn, requestPasswordReset } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<View>('sign-in');
  // One field, two meanings: the sign-in view takes an email OR a username,
  // the forgot view takes the email address only. Sharing the state means a
  // username someone half-typed survives the trip to "Forgot password?".
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchTo = (next: View) => {
    setView(next);
    setError(null);
    setInfo(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const { error: err } = await signIn(identifier.trim(), password);
    if (err) {
      setError(err);
      showToast('error', err);
    }
    setSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const { error: err } = await requestPasswordReset(identifier);
    if (err) {
      setError(err);
      showToast('error', err);
    } else {
      // Deliberately non-committal about whether the address has an account —
      // Supabase won't disclose that, and neither should this screen.
      const okMsg = `If ${identifier.trim()} has a depot account, a reset link is on its way. Open it on this device to choose a new password.`;
      setInfo(okMsg);
      showToast('success', 'Reset link sent.');
    }
    setSubmitting(false);
  };

  return (
    <AuthShell
      title={view === 'sign-in' ? 'Sign in' : 'Forgot password'}
      subtitle={view === 'sign-in' ? 'Sign in to your depot operations account' : 'Password recovery'}
      footer={
        view === 'sign-in'
          ? 'Need an account? Accounts are created by the depot owner — ask them to add you in Team & Access.'
          : 'Still stuck? The owner can set a new password for you in Team & Access.'
      }
    >
      <form onSubmit={view === 'sign-in' ? handleSignIn : handleForgotPassword} className="space-y-3.5">
        {view === 'sign-in' ? (
          <>
            <div className="space-y-1">
              <label
                htmlFor="login-identifier"
                className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block"
              >
                Email or Username
              </label>
              <div className="relative">
                <Envelope className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-identifier"
                  // Sign-in accepts a plain username (owner-created staff
                  // accounts have no real email) as well as a real email, so
                  // it can't be type="email" — the browser would block
                  // submitting a bare username as invalid.
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="you@depot.com or username"
                  autoComplete="username"
                  autoFocus
                  required
                  className="depot-input pl-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchTo('forgot')}
                  className="text-[11px] font-sans font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  minLength={6}
                  required
                  className="depot-input pl-10"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <label
              htmlFor="login-identifier"
              className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block"
            >
              Email address
            </label>
            <div className="relative">
              <Envelope className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="login-identifier"
                type="email"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@depot.com"
                autoComplete="email"
                aria-describedby="forgot-hint"
                autoFocus
                required
                className="depot-input pl-10"
              />
            </div>
            <p
              id="forgot-hint"
              className="text-[11px] font-sans text-slate-500 dark:text-slate-400 pt-0.5"
            >
              We'll email a one-time link to set a new password. Staff accounts
              that sign in with a username have no inbox — the owner resets those
              from Team &amp; Access.
            </p>
          </div>
        )}

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

        {info && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 p-3 rounded-xl badge-emerald text-xs font-sans"
          >
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
            <span>{info}</span>
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
              <span>{view === 'sign-in' ? 'Sign in' : 'Send reset link'}</span>
              <ArrowRight className="w-4 h-4" weight="bold" />
            </>
          )}
        </button>

        {view === 'forgot' && (
          <button
            type="button"
            onClick={() => switchTo('sign-in')}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-sans font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" weight="bold" />
            Back to sign in
          </button>
        )}
      </form>
    </AuthShell>
  );
};

export default LoginScreen;
