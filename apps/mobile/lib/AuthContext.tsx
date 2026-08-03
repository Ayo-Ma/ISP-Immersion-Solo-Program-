import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserRole, UserStatus } from '@isp-app/shared-types';

import { log } from '@isp-app/logger';

import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  status: UserStatus;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  /** True while the initial session/profile is still being resolved. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session persistence and token refresh are handled by supabase-js itself
 * (lib/supabase.ts: persistSession + autoRefreshToken via AsyncStorage) —
 * this provider's job is just to expose that state reactively and resolve
 * the caller's role, since RLS (and this app's whole navigation shell)
 * decides everything based on public.users.role, not just "is signed in."
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(currentSession: Session | null) {
      if (!currentSession) {
        if (mounted) setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, role, name, email, status')
        .eq('id', currentSession.user.id)
        .single();

      if (error) {
        log.error('auth.profile_load_failed', {
          userId: currentSession.user.id,
          context: { message: error.message },
        });
        if (mounted) setProfile(null);
        return;
      }

      if (mounted) setProfile(data as UserProfile);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (mounted) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      loadProfile(newSession);
      log.info('auth.state_changed', {
        userId: newSession?.user.id,
        context: { event },
      });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      log.warn('auth.sign_in_failed', { context: { message: error.message } });
      return { error: error.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
