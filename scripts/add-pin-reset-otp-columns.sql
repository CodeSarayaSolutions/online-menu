-- Run once in Supabase SQL editor (schema: sarayamenu)
ALTER TABLE sarayamenu.users
  ADD COLUMN IF NOT EXISTS pin_reset_otp_hash text,
  ADD COLUMN IF NOT EXISTS pin_reset_otp_expires_at timestamptz;
