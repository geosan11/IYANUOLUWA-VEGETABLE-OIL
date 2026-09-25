import React, { useEffect, useState } from 'react';
import { Drop } from '@phosphor-icons/react';
import { supabase, isSupabaseConfigured } from '../../services/supabase';

/**
 * Shared chrome for every signed-out auth view — sign in, forgot password and
 * set-a-new-password.
 *
 * The three views are separate components rather than one screen with mode
 * switches, so this shell exists to keep their brand header, card, canvas and
 * footer from drifting apart. Everything it paints comes from the app's own
 * design system (`depot-card`, the brand-500 CTA colour, the cream canvas in
 * index.css) so signing in looks like the rest of the depot app.
 */
export const AuthShell: React.FC<{
  /** Card heading — the one thing that differs per view. */
  title: string;
  /** Line under the brand name in the header. */
  subtitle: string;
  children: React.ReactNode;
  /** Optional note under the card (muted, centred). */
  footer?: React.ReactNode;
}> = ({ title, subtitle, children, footer }) => {
  // Branding is fetched here (not per screen) so all auth views show the same
  // logo/name. Goes through the public_company_branding() RPC instead of
  // selecting app_settings directly: this runs before sign-in, and no table
  // grants SELECT to `anon`, so a direct read always came back empty and the
  // header silently kept its hardcoded fallback. The RPC is SECURITY DEFINER
  // and returns only the two public branding fields (migration 0018).
  const [brandName, setBrandName] = useState('Iyanuoluwa Depot');
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .rpc('public_company_branding')
      .then(({ data, error }) => {
        if (error) {
          // Most likely migration 0018 hasn't been applied yet. Fall back to
          // the built-in name/logo rather than leaving a blank header.
          console.warn(
            '[auth] public_company_branding() unavailable — has migration 0018 been applied?',
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

  return (
    // The canvas matches body in index.css (#FAF6ED / #070d1a). This is the
    // first thing anyone sees, so it must not sit on a different colour to the
    // app behind it — it previously used Tailwind's cool grey slate-100.
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF6ED] dark:bg-[#070d1a] px-4 py-8">
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
          <p className="text-xs font-sans text-slate-500 dark:text-slate-400 text-center">{subtitle}</p>
        </div>

        <div className="depot-card p-6 space-y-4">
          <h2 className="font-heading font-bold text-base text-slate-900 dark:text-white">{title}</h2>
          {children}
        </div>

        {footer && (
          <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-4 font-sans">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthShell;
