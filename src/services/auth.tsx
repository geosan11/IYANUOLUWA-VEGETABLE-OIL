import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import type { UserRole } from '../types';

/**
 * The Functions client's `error.message` on a non-2xx response is always the
 * generic "Edge Function returned a non-2xx status code" — the actual reason
 * (e.g. "Only an owner can invite team members") is JSON on the raw Response,
 * reachable only via `FunctionsHttpError.context`. Every `functions.invoke()`
 * call site should route its error through this instead of `error.message`.
 */
async function describeFunctionsError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error as string;
    } catch {
      // Response body wasn't JSON — fall through to the generic message.
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

// Keep in sync with STAFF_LOGIN_DOMAIN in supabase/functions/create-staff-account/index.ts.
const STAFF_LOGIN_DOMAIN = 'staff.iyanuoluwa.local';

/**
 * The login field accepts either a real email (the owner account, or a team
 * member an owner invited by email) or a bare username (staff/driver accounts
 * the owner created directly in Team Members, which have no real email — see
 * create-staff-account). Anything without an "@" is treated as a username
 * and mapped to the same synthetic address the Edge Function created it
 * under.
 */
function resolveLoginIdentifier(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const username = trimmed
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
  return `${username}@${STAFF_LOGIN_DOMAIN}`;
}

export interface AuthProfile {
  id: string;
  role: UserRole;
  full_name: string | null;
  hub_id: string | null;
  theme: 'light' | 'dark';
  allowed_screens: string[] | null;
}

/**
 * Every profile row, for the owner's Team & Access screen. Owner-only per
 * RLS (`profiles_read`: `id = auth.uid() or app_current_role() = 'owner'`) —
 * a non-owner caller gets back only their own row, not an error.
 */
export async function listAllProfiles(): Promise<{ profiles: AuthProfile[]; error: string | null }> {
  if (!supabase) return { profiles: [], error: 'Supabase is not configured for this deployment.' };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, hub_id, theme, allowed_screens')
    .order('full_name', { ascending: true });
  if (error) return { profiles: [], error: error.message };
  return { profiles: (data as AuthProfile[]) ?? [], error: null };
}

/**
 * Owner-only edit of another user's role, hub, or screen access. RLS
 * (`profiles_owner_update` + the `profiles_guard_role` trigger) is the real
 * gate — this just surfaces its result.
 */
export async function updateProfileAccess(
  userId: string,
  patch: { role?: UserRole; hub_id?: string | null; allowed_screens?: string[] | null; full_name?: string | null }
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  return { error: error?.message ?? null };
}

/**
 * Owner-only: sends a real Supabase auth invite email to a new team member
 * via the `invite-user` Edge Function (needs the service-role key, which the
 * browser never has — see `supabase/functions/README.md` for deployment).
 * Also sets the invited person's role/hub/screen access on the profile row
 * the invite creates, so they land with the right access on first login.
 */
export async function inviteUser(
  email: string,
  role: UserRole,
  hubId: string | null,
  allowedScreens: string[] | null,
  fullName?: string | null
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      email,
      role,
      hub_id: hubId,
      allowed_screens: allowedScreens,
      full_name: fullName?.trim() || null,
      redirectTo: `${window.location.origin}/`
    }
  });
  if (error) return { error: await describeFunctionsError(error) };
  if (data?.error) return { error: data.error };
  return { error: null };
}

/**
 * Owner-only: creates a team member's account directly with a username and
 * password the owner sets — no email invite round-trip. Used in place of
 * `inviteUser` in the Team Members UI for staff who don't have easy email
 * access; the owner hands them the username/password themselves.
 */
export async function createStaffAccount(
  username: string,
  password: string,
  role: UserRole,
  hubId: string | null,
  allowedScreens: string[] | null,
  fullName?: string | null
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
  const { data, error } = await supabase.functions.invoke('create-staff-account', {
    body: {
      username,
      password,
      role,
      hub_id: hubId,
      allowed_screens: allowedScreens,
      full_name: fullName?.trim() || null
    }
  });
  if (error) return { error: await describeFunctionsError(error) };
  if (data?.error) return { error: data.error };
  return { error: null };
}

/**
 * Owner-only: permanently deletes a team member's account. The matching
 * `profiles` row is removed automatically (on delete cascade from
 * auth.users) — nothing else to clean up client-side.
 */
export async function deleteStaffAccount(userId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
  const { data, error } = await supabase.functions.invoke('delete-staff-account', {
    body: { userId }
  });
  if (error) return { error: await describeFunctionsError(error) };
  if (data?.error) return { error: data.error };
  return { error: null };
}

interface AuthResult {
  error: string | null;
}

interface AuthContextValue {
  /** True once the initial session check has resolved (whether or not a session exists). */
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** The matching `profiles` row (role, hub, name). Null while it's still loading after a session appears. */
  profile: AuthProfile | null;
  /** True only while profiles is being (re)fetched for an existing session. */
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /**
   * Sends a Supabase password-recovery email. Resolves with `error: null`
   * even when no account matches the address — Supabase deliberately does not
   * disclose that — so the screen can never leak which emails exist.
   */
  requestPasswordReset: (emailOrUsername: string) => Promise<AuthResult>;
  /** Sets a new password for the signed-in user (the recovery screen's action). */
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  /**
   * True only while the app must show the "set a new password" screen instead
   * of the depot UI — i.e. the user arrived through a password-recovery link.
   * A recovery link signs them in with a real session, so without this flag
   * AuthGate would render the full app and the reset screen would be skipped.
   */
  passwordRecovery: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, hub_id, theme, allowed_screens')
      .eq('id', userId)
      .single();
    setProfileLoading(false);
    if (error) {
      // Most likely: the new-user trigger hasn't inserted the row yet, or RLS
      // is blocking it. Either way, leave profile null — AuthGate shows a
      // "setting up your account" state rather than silently granting access.
      console.warn('Failed to load profile:', error.message);
      setProfile(null);
      return;
    }
    setProfile(data as AuthProfile);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setReady(true));
      } else {
        setReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // PASSWORD_RECOVERY fires when the client consumes a recovery link from
      // the hash (the client runs the implicit flow by default). The session it
      // sets is a real one, so AuthGate checks this flag BEFORE rendering the
      // app — otherwise the user would land straight in the depot UI and never
      // see the "set a new password" screen.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      // USER_UPDATED covers the normal exit (updatePassword succeeded);
      // SIGNED_OUT covers abandoning the reset and signing out instead.
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setPasswordRecovery(false);
      setSession(newSession);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (emailOrUsername: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
    const { error } = await supabase.auth.signInWithPassword({
      email: resolveLoginIdentifier(emailOrUsername),
      password
    });
    return { error: error?.message ?? null };
  }, []);

  /**
   * Sends a password-recovery email. A bare username is rejected up front:
   * owner-created staff accounts live on a synthetic address under
   * STAFF_LOGIN_DOMAIN that has no inbox, so a recovery mail could never reach
   * them — better to explain that than to send a link into the void. When an
   * address IS supplied, Supabase returns success regardless of whether the
   * account exists, which is exactly the behaviour we want (no enumeration).
   */
  const requestPasswordReset = useCallback(async (emailOrUsername: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
    const trimmed = emailOrUsername.trim();
    if (!trimmed.includes('@')) {
      return {
        error:
          'Password reset needs a real email address. Staff accounts created with a username can only be reset by the owner — ask them in Team & Access.'
      };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed.toLowerCase(), {
      // The recovery link returns to the app root; the client picks the tokens
      // out of the URL hash and fires PASSWORD_RECOVERY (see the effect above).
      // This origin must be allow-listed under Authentication → URL
      // Configuration → Redirect URLs in the Supabase dashboard, or the link
      // lands here with no session.
      redirectTo: `${window.location.origin}/`
    });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      // Leave recovery mode immediately rather than waiting on the
      // USER_UPDATED event, so the app renders on the same tick.
      setPasswordRecovery(false);
    }
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ready,
        session,
        user: session?.user ?? null,
        profile,
        profileLoading,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
        passwordRecovery
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
