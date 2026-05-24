import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!isBcryptHash(hash)) return false;
  return bcrypt.compare(plain, hash);
}

/** True only for real bcrypt hashes — empty or junk values mean "no password yet". */
export function isBcryptHash(hash: string | null | undefined): boolean {
  return !!hash && /^\$2[aby]\$\d{2}\$/.test(hash);
}
