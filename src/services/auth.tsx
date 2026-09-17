import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import type { UserRole } from '../types';

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
  patch: { role?: UserRole; hub_id?: string | null; allowed_screens?: string[] | null }
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
  allowedScreens: string[] | null
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      email,
      role,
      hub_id: hubId,
      allowed_screens: allowedScreens,
      redirectTo: `${window.location.origin}/`
    }
  });
  if (error) return { error: error.message };
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
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Supabase is not configured for this deployment.' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
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
        signUp,
        signOut
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
