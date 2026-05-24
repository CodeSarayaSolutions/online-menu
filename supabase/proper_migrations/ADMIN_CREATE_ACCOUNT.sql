-- ============================================================
-- COPY-PASTE: Create YOUR Saraya platform admin
-- ============================================================
-- Run in SQL editor as postgres. Then log in at /admin/login
--
-- Email:    you@yourcompany.com     ← change this
-- Password: ChangeMeNow123!         ← change after first login
-- ============================================================

-- Generate bcrypt for your password (run in project folder):
--   node -e "const b=require('bcryptjs'); console.log(b.hashSync('ChangeMeNow123!', 10));"
-- Paste the hash below instead of YOUR_BCRYPT_HASH_HERE

INSERT INTO sarayamenu.users (name, email, password_hash, platform_role)
VALUES (
  'Your Name',
  'you@yourcompany.com',
  'YOUR_BCRYPT_HASH_HERE',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  platform_role = 'admin',
  invite_otp_hash = NULL,
  invite_otp_expires_at = NULL;

-- Verify:
-- SELECT id, email, platform_role, password_hash IS NOT NULL AS has_password
-- FROM sarayamenu.users WHERE email = 'you@yourcompany.com';
