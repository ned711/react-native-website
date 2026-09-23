/**
 * Supabase client factory. Only the public URL and the anon key are read on
 * the client (both are designed to be public; security relies on RLS). The
 * service role key must NEVER be shipped in the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';

export type BackendStatus =
  | {readonly configured: false; readonly reason: string}
  | {readonly configured: true; readonly url: string};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function backendStatus(): BackendStatus {
  if (!url || !anonKey) {
    return {
      configured: false,
      reason:
        'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY ne sont pas définis.',
    };
  }
  return {configured: true, url};
}

let client: SupabaseClient | null = null;

/** Returns the client, or null when the backend is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!backendStatus().configured) return null;
  client ??= createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
