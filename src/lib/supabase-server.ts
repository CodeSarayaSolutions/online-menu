import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { supabasePostgrestSchema } from '@/lib/supabase-schema';

// ─── Server-side Supabase client ────────────────────────
// Uses the service_role key, which BYPASSES Row Level Security.
// Only use this in:
//   • API routes (app/api/...)
//   • Server components
//   • Server actions
// NEVER import this file from client components.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase server env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
    '(.env or .env.local; see .env.example).'
  );
}

export const supabaseAdmin = createClient<Database, 'sarayamenu'>(supabaseUrl, supabaseServiceKey, {
  // Next.js can cache Supabase's internal fetch even inside a dynamic route.
  // Operational reads and session/role checks must always reach PostgreSQL.
  global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  db: { schema: supabasePostgrestSchema as 'sarayamenu' },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
