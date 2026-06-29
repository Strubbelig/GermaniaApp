// =============================================================================
// GermaniaApp — Supabase client
// Single shared client instance, typed against the schema (database.types.ts).
// =============================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Vite exposes env vars prefixed with VITE_ on import.meta.env.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when real Supabase credentials are present. */
export const supabaseConfigured = !!(url && anonKey);

// When configured, a real client. When not (demo mode), a proxy that throws if
// anything actually tries to use it — so importing this module never crashes the
// app, but a stray real call in demo mode fails loudly.
export const supabase: SupabaseClient<Database> = supabaseConfigured
  ? createClient<Database>(url!, anonKey!, {
      auth: {
        persistSession: true, // keep the member signed in across visits (PWA)
        autoRefreshToken: true,
        detectSessionInUrl: true, // needed for magic-link sign-in
      },
    })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error('Supabase is not configured (running in demo mode).');
        },
      },
    ) as unknown as SupabaseClient<Database>);
