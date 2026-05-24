/**
 * PostgREST schema for app tables (must match Postgres + exposed API schemas).
 * Types are generated for `sarayamenu`; set the same value in env unless you
 * regenerate types for another schema name.
 */
export const supabasePostgrestSchema =
  (process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA ?? 'sarayamenu').trim() || 'sarayamenu';
