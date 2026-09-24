import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/auth';
import { useToast } from '../services/toast';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Envelope, LockKey, ArrowRight, WarningCircle, Drop, Spinner } from '@phosphor-icons/react';

type Mode = 'sign-in' | 'sign-up';

export const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch branding from DB so login screen shows the depot logo + name
  const [brandName, setBrandName] = useState('Iyanuoluwa Depot');
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    // Goes through the public_company_branding() RPC instead of selecting
    // app_settings directly. This runs before sign-in, and no table grants
    // SELECT to `anon`, so a direct read always came back empty and this
    // screen silently kept its hardcoded fallback. The RPC is SECURITY
    // DEFINER and returns only the two public branding fields (migration 0018).
    supabase
      .rpc('public_company_branding')
      .then(({ data, error }) => {
        if (error) {
          // Most likely migration 0018 hasn't been applied yet. Fall back to
          // the built-in name/logo rather than leaving a blank header.
          console.warn(
            '[login] public_company_branding() unavailable — has migration 0018 been applied?',
            error.message
          );
          return;
        }
        const row = (Array.isArray(data) ? data[0] : data) as
          | { company_name?: string | null; company_logo_url?: string | null }
          | null
          | undefined;
        if (!row) return;
        if (row.company_name) setBrandName(row.company_name);
        if (row.company_logo_url) setBrandLogo(row.company_logo_url);
        document.title = row.company_name || 'Iyanuoluwa Depot';
      });
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    if (mode === 'sign-in') {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(err);
        showToast('error', err);
      }
    } else {
      if (!fullName.trim()) {
        setError('Enter your full name.');
        showToast('error', 'Enter your full name.');
        setSubmitting(false);
        return;
      }
      const { error: err } = await signUp(email.trim(), password, fullName.trim());
      if (err) {
        setError(err);
        showToast('error', err);
      } else {
        const okMsg = 'Account created. Check your email to confirm, then sign in — a new account starts as Counter Staff until an owner promotes it.';
        setInfo(okMsg);
        showToast('success', okMsg);
        setMode('sign-in');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brandName}
              className="h-16 w-auto max-w-[160px] object-contain rounded-xl shadow-lg"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center text-slate-950 shadow-lg shadow-brand-500/20">
              <Drop className="w-7 h-7" weight="fill" />
            </div>
          )}
          <h1 className="font-heading font-bold text-xl text-slate-900 dark:text-white text-center">
            {brandName}
          </h1>
          <p className="text-xs font-sans text-slate-500 dark:text-slate-400 text-center">
            Sign in to your depot operations account
          </p>
        </div>

        <div className="depot-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('sign-in'); setError(null); setInfo(null); }}
              className={`py-2 rounded-lg text-xs font-sans font-bold transition-all ${
                mode === 'sign-in'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('sign-up'); setError(null); setInfo(null); }}
              className={`py-2 rounded-lg text-xs font-sans font-bold transition-all ${
                mode === 'sign-up'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'sign-up' && (
              <div className="space-y-1">
                <label htmlFor="login-fullname" className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block">
                  Full name
                </label>
                <input
                  id="login-fullname"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Ade Bankole"
                  required
                  className="depot-input"
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="login-email" className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block">
                {mode === 'sign-in' ? 'Email or Username' : 'Email'}
              </label>
              <div className="relative">
                <Envelope className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-email"
                  // Sign-in accepts a plain username (owner-created staff
                  // accounts have no real email) as well as a real email, so
                  // it can't be type="email" — the browser would block
                  // submitting a bare username as invalid.
                  type={mode === 'sign-in' ? 'text' : 'email'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={mode === 'sign-in' ? 'you@depot.com or username' : 'you@depot.com'}
                  autoComplete="username"
                  required
                  className="depot-input pl-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="login-password" className="text-[11px] font-sans font-bold uppercase text-slate-600 dark:text-slate-400 block">
                Password
              </label>
              <div className="relative">
                <LockKey className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                  className="depot-input pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-sans">
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" weight="bold" />
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-sans">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-sans font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all"
            >
              {submitting ? (
                <Spinner className="w-4 h-4 animate-spin" weight="bold" />
              ) : (
                <>
                  <span>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</span>
                  <ArrowRight className="w-4 h-4" weight="bold" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-4 font-sans">
          New accounts start as Counter Staff. An owner must promote the first
          account to Owner from Supabase (see SCHEMA.md).
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
