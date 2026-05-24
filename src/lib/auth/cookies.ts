import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_DAYS } from '@/lib/auth/constants';

export function sessionCookieOptions() {
  const maxAge = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function buildSessionCookie(token: string): string {
  const opts = sessionCookieOptions();
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    `SameSite=${opts.sameSite}`,
    'HttpOnly',
  ];
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=lax`;
}

export function readSessionTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
