-- ============================================================
-- Invite OTP (no email server) — first login sets password
-- ============================================================
-- Run after 005_roles_and_stations.sql
-- ============================================================
--
-- Admin creates user without password → invite_otp_hash + expiry set.
-- User logs in with email + OTP + chooses password → password_hash set, OTP cleared.
-- ============================================================

ALTER TABLE sarayamenu.users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE sarayamenu.users
  ADD COLUMN IF NOT EXISTS invite_otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS invite_otp_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN sarayamenu.users.invite_otp_hash IS
  'sha256(hex) of 6-digit invite code; cleared after first password is set.';
COMMENT ON COLUMN sarayamenu.users.invite_otp_expires_at IS
  'Invite code valid until this time (default 7 days from admin invite).';

-- ─── Your platform admin (change email/password after first login) ─
-- Password: admin123
INSERT INTO sarayamenu.users (name, email, password_hash, platform_role, invite_otp_hash, invite_otp_expires_at)
VALUES (
  'Saraya Admin',
  'admin@saraya.dev',
  '$2b$10$jG55ZDsDK06PQdL9hQDOaOxV92/RsCHBsVjBV1WmBjr9lK/tBMVhu',
  'admin',
  NULL,
  NULL
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  platform_role = 'admin',
  invite_otp_hash = NULL,
  invite_otp_expires_at = NULL;
