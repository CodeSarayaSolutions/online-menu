import { createHash, randomInt } from 'crypto';

const OTP_LENGTH = 6;
const INVITE_DAYS = 7;

/** 6-digit code for admin to copy to the client */
export function generateInviteOtp(): string {
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(OTP_LENGTH, '0');
}

export function hashInviteOtp(otp: string): string {
  const normalized = otp.replace(/\D/g, '').padStart(OTP_LENGTH, '0').slice(-OTP_LENGTH);
  return createHash('sha256').update(normalized).digest('hex');
}

export function verifyInviteOtp(otp: string, hash: string | null): boolean {
  if (!hash || !otp) return false;
  return hashInviteOtp(otp) === hash;
}

export function inviteExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_DAYS);
  return d.toISOString();
}
