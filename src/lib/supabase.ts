import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { supabasePostgrestSchema } from '@/lib/supabase-schema';
import { SESSION_HEADER_NAME } from '@/lib/auth/constants';

// ─── Browser Supabase client (anon key + RLS) ───────────
// Auth is app-owned (sarayamenu.sessions), NOT Supabase Auth.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env or .env.local ' +
    '(see .env.example).'
  );
}

let appSessionToken: string | null = null;

/** Set after login or session restore so RLS sees the logged-in user. */
export function setAppSessionToken(token: string | null) {
  appSessionToken = token;
}

export function getAppSessionToken() {
  return appSessionToken;
}

export const supabase = createClient<Database, 'sarayamenu'>(supabaseUrl, supabaseAnonKey, {
  db: { schema: supabasePostgrestSchema as 'sarayamenu' },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, options = {}) => {
      const headers = new Headers(options.headers);
      if (appSessionToken) {
        headers.set(SESSION_HEADER_NAME, appSessionToken);
      }
      return fetch(url, { ...options, headers });
    },
  },
});
