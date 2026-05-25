import { createHash, randomInt } from 'crypto';

const OTP_LENGTH = 6;
const PIN_RESET_MINUTES = 30;

export function generatePinResetOtp(): string {
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(OTP_LENGTH, '0');
}

export function hashPinResetOtp(otp: string): string {
  const normalized = otp.replace(/\D/g, '').padStart(OTP_LENGTH, '0').slice(-OTP_LENGTH);
  return createHash('sha256').update(normalized).digest('hex');
}

export function verifyPinResetOtp(otp: string, hash: string | null): boolean {
  if (!hash || !otp) return false;
  return hashPinResetOtp(otp) === hash;
}

export function pinResetExpiresAt(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + PIN_RESET_MINUTES);
  return d.toISOString();
}
