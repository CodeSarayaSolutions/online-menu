-- ============================================================
-- Saraya CMS — App-owned accounts (NOT Supabase Auth)
-- ============================================================
-- Run after 003_realtime_triggers_updated_at.sql
-- Safe if you already ran 001 + 002 (removes auth.users link).
-- ============================================================
--
-- How login works:
--   1. Next.js POST /api/auth/login checks email + bcrypt password
--   2. Server inserts a row in sarayamenu.sessions (opaque token, hashed)
--   3. Browser sends header: x-sarayamenu-session: <token>
--   4. RLS helpers resolve sarayamenu.current_app_user_id() from that header
--
-- Supabase Auth (auth.users) is NOT used by this app.
-- ============================================================

-- ─── Step 1: drop policies that reference auth_id (from 002) ─
DROP POLICY IF EXISTS "users_select" ON sarayamenu.users;
DROP POLICY IF EXISTS "users_insert_admin" ON sarayamenu.users;
DROP POLICY IF EXISTS "users_update" ON sarayamenu.users;
DROP POLICY IF EXISTS "users_delete_admin" ON sarayamenu.users;

-- ─── Step 2: drop Supabase Auth column, add password hash ───
ALTER TABLE sarayamenu.users DROP COLUMN IF EXISTS auth_id;

ALTER TABLE sarayamenu.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN sarayamenu.users.password_hash IS
  'bcrypt hash; only readable via service role / login API — never expose to clients.';

-- ─── Sessions (opaque tokens, server-validated) ─────────────
CREATE TABLE IF NOT EXISTS sarayamenu.sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES sarayamenu.users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sarayamenu.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sarayamenu.sessions(expires_at);

COMMENT ON TABLE sarayamenu.sessions IS
  'Login sessions for sarayamenu app only. token_hash = sha256(hex) of secret token.';

-- Sessions are managed by the API (service role), not by anon clients directly
ALTER TABLE sarayamenu.sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON sarayamenu.sessions FROM anon, authenticated;
GRANT ALL ON sarayamenu.sessions TO service_role;

-- ─── Read session token from PostgREST request headers ──────
CREATE OR REPLACE FUNCTION sarayamenu.request_header(header_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.headers', true), '')::json ->> lower(header_name),
    NULLIF(current_setting('request.headers', true), '')::json ->> header_name
  );
$$;

CREATE OR REPLACE FUNCTION sarayamenu.session_token_hash()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN sarayamenu.request_header('x-sarayamenu-session') IS NULL
      OR sarayamenu.request_header('x-sarayamenu-session') = ''
    THEN NULL
    ELSE encode(sha256(sarayamenu.request_header('x-sarayamenu-session')::bytea), 'hex')
  END;
$$;

-- ─── RLS helpers (session-based, NOT auth.uid()) ────────────
CREATE OR REPLACE FUNCTION sarayamenu.current_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
  SELECT s.user_id
  FROM sarayamenu.sessions s
  WHERE s.expires_at > NOW()
    AND s.token_hash = sarayamenu.session_token_hash()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION sarayamenu.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sarayamenu.users
    WHERE id = sarayamenu.current_app_user_id()
      AND platform_role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION sarayamenu.has_restaurant_role(
  p_restaurant_id TEXT,
  p_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sarayamenu.restaurant_access ra
    WHERE ra.user_id = sarayamenu.current_app_user_id()
      AND ra.restaurant_id = p_restaurant_id
      AND (p_role IS NULL OR ra.role = p_role)
  ) OR sarayamenu.is_platform_admin();
$$;

-- ─── Step 3: recreate user policies (session-based) ─────────
CREATE POLICY "users_select"
  ON sarayamenu.users FOR SELECT
  USING (
    id = sarayamenu.current_app_user_id()
    OR sarayamenu.is_platform_admin()
  );

-- New users are created via admin API (service role) or seed SQL
CREATE POLICY "users_insert_admin"
  ON sarayamenu.users FOR INSERT
  WITH CHECK (sarayamenu.is_platform_admin());

CREATE POLICY "users_update"
  ON sarayamenu.users FOR UPDATE
  USING (
    id = sarayamenu.current_app_user_id()
    OR sarayamenu.is_platform_admin()
  );

CREATE POLICY "users_delete_admin"
  ON sarayamenu.users FOR DELETE
  USING (sarayamenu.is_platform_admin());

-- ─── Seed platform admin (change password after first login) ─
INSERT INTO sarayamenu.users (name, email, password_hash, platform_role)
VALUES (
  'Saraya Admin',
  'admin@saraya.dev',
  '$2b$10$jG55ZDsDK06PQdL9hQDOaOxV92/RsCHBsVjBV1WmBjr9lK/tBMVhu',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  platform_role = EXCLUDED.platform_role;

-- Default password for seed row: admin123 — change in production.
