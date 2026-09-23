/**
 * Supabase Auth session. STATUS: PRÉPARÉ - type-checked, not exercised
 * against a live project. Without configuration the provider stays signed out.
 */
import type {Session} from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {getSupabase} from '../services/backend.ts';
import {isValidUsername} from '../social/friends/tag.ts';

export interface AuthContextValue {
  readonly session: Session | null;
  readonly loading: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signUp(
    email: string,
    password: string,
    username: string
  ): Promise<string | null>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: {readonly children: ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(getSupabase() !== null);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return undefined;
    client.auth.getSession().then(({data}) => {
      setSession(data.session);
      setLoading(false);
    });
    const {data} = client.auth.onAuthStateChange((_event, next) =>
      setSession(next)
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      async signIn(email, password) {
        const client = getSupabase();
        if (!client) return 'Supabase non configuré';
        const {error} = await client.auth.signInWithPassword({email, password});
        return error ? error.message : null;
      },
      async signUp(email, password, username) {
        const client = getSupabase();
        if (!client) return 'Supabase non configuré';
        if (!isValidUsername(username))
          return 'Pseudo : 3 à 16 lettres, chiffres ou _';
        // The server sanitises the username again (handle_new_user trigger).
        const {error} = await client.auth.signUp({
          email,
          password,
          options: {data: {username}},
        });
        return error ? error.message : null;
      },
      async signOut() {
        await getSupabase()?.auth.signOut();
      },
    }),
    [session, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
