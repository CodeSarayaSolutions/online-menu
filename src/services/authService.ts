import { performAction } from './actionService';
// ─── Auth Service ────────────────────────────────────────
// App-owned accounts in sarayamenu.users + sarayamenu.sessions
// Does NOT use Supabase Auth (auth.users).

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { supabase, setAppSessionToken } from '@/lib/supabase';
import type { Tables, InsertDto, UpdateDto } from '@/types/supabase';
import type { AppUser, RestaurantRole } from '@/types/auth';
import { mapApiUserToAppUser } from '@/lib/auth/map-user';
import { USER_PUBLIC_COLUMNS } from '@/lib/auth/constants';

export type AppUserRow = Tables<'users'>;
export type RestaurantAccessRow = Tables<'restaurant_access'>;

export type PublicUser = Pick<
  AppUserRow,
  'id' | 'name' | 'email' | 'avatar' | 'platform_role' | 'created_at'
>;

export type SessionPayload = {
  user: PublicUser;
  restaurantAccess: { restaurantId: string; role: string }[];
  sessionToken: string;
};

// ─── Authentication (Next.js API + session header) ───────

export type LoginResult = SessionPayload | { onboarding: true };
export class LoginRateLimitError extends Error {
  constructor() { super('Login temporarily limited'); this.name = 'LoginRateLimitError'; }
}
export async function signIn(email: string, creds: { pin: string }): Promise<LoginResult> {
  const res = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, pin: creds.pin }) });
  const body = await res.json();
  if (res.status === 429) throw new LoginRateLimitError();
  if (!res.ok) throw new Error(body.error ?? 'Prijava nije uspjela. Pokušajte ponovo.');
  if (body.sessionToken) setAppSessionToken(body.sessionToken);
  return body as LoginResult;
}
export async function completeOnboarding(pin: string, confirmation: string): Promise<SessionPayload> {
  const res = await fetch('/api/auth/onboard', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, confirmation }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Pokušajte ponovo.');
  setAppSessionToken(body.sessionToken);
  return body as SessionPayload;
}

export type InviteUserPayload = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  platformRole?: 'admin' | 'user';
  restaurantId?: string;
  restaurantRole?: 'owner' | 'manager' | 'kitchen' | 'bar' | 'employee';
};

export type InviteUserResult = {
  inviteCode: string;
  inviteExpiresAt: string;
  user: { id: string; email: string; name: string };
  message: string;
};

export async function inviteUser(payload: InviteUserPayload): Promise<InviteUserResult> {
  const res = await fetch('/api/admin/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      platformRole: payload.platformRole ?? 'user',
      restaurantId: payload.restaurantId,
      restaurantRole: payload.restaurantRole ?? 'owner',
    }),
    credentials: 'include',
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Invite failed');
  return body as InviteUserResult;
}

export type PinResetOtpResult = {
  code: string;
  expiresAt: string;
  userId: string;
};

export async function generatePinResetOtp(
  userId: string,
  restaurantId?: string
): Promise<PinResetOtpResult> {
  const res = await fetch('/api/admin/users/pin-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, restaurantId }),
    credentials: 'include',
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Generiranje PIN koda nije uspjelo');
  return body as PinResetOtpResult;
}

export async function resetPinWithOtp(userId: string, otp: string, pin: string): Promise<void> {
  const res = await fetch('/api/auth/reset-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, otp, pin }),
    credentials: 'include',
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Promjena PIN-a nije uspjela');
}

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  setAppSessionToken(null);
}

export type PinSignInResult =
  | SessionPayload
  | { ok: false; reason: 'no_pin' | 'wrong_pin' | string };

export async function pinSignIn(userId: string, pin: string): Promise<PinSignInResult> {
  const res = await fetch('/api/waiter/pin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin }),
    credentials: 'include',
  });

  const body = await res.json();

  if (body.user && body.sessionToken) {
    setAppSessionToken(body.sessionToken);
    return body as SessionPayload;
  }

  if (body.reason === 'no_pin' || body.reason === 'wrong_pin') {
    return { ok: false, reason: body.reason };
  }

  if (!res.ok) {
    throw new Error(body.error ?? 'PIN login failed');
  }

  return { ok: false, reason: body.reason ?? 'unknown' };
}

/** Restore session from httpOnly cookie on page load. */
export async function restoreSession(): Promise<SessionPayload | null> {
  const res = await fetchWithTimeout('/api/auth/session', { credentials: 'include' }, 12000);
  if (!res.ok) return null;

  const body = await res.json();
  if (!body.sessionToken || !body.user) {
    setAppSessionToken(null);
    return null;
  }

  setAppSessionToken(body.sessionToken);
  return body as SessionPayload;
}

// ─── User profile (sarayamenu.users) ─────────────────────

export async function getCurrentUserProfile(): Promise<SessionPayload | null> {
  return restoreSession();
}

export async function getAllUsers(): Promise<PublicUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_PUBLIC_COLUMNS)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function updateUserProfile(userId: string, updates: UpdateDto<'users'>) {
  const { password_hash: _pw, ...safe } = updates as UpdateDto<'users'> & {
    password_hash?: string;
  };

  const { data, error } = await supabase
    .from('users')
    .update(safe)
    .eq('id', userId)
    .select(USER_PUBLIC_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw error;
}

// ─── Restaurant access ───────────────────────────────────

export async function getUserRestaurantAccess(userId: string): Promise<RestaurantAccessRow[]> {
  const { data, error } = await supabase
    .from('restaurant_access')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function getRestaurantStaff(
  restaurantId: string
): Promise<(RestaurantAccessRow & { user: PublicUser })[]> {
  const { data, error } = await supabase
    .from('restaurant_access')
    .select(`*, user:users(${USER_PUBLIC_COLUMNS})`)
    .eq('restaurant_id', restaurantId);

  if (error) throw error;
  return (data ?? []) as (RestaurantAccessRow & { user: PublicUser })[];
}

export async function fetchAllUsersForAdmin(): Promise<AppUser[]> {
  const [{ data: users, error: uErr }, { data: access, error: aErr }] = await Promise.all([
    supabase.from('users').select(USER_PUBLIC_COLUMNS).order('created_at', { ascending: true }),
    supabase.from('restaurant_access').select('user_id, restaurant_id, role'),
  ]);
  if (uErr) throw uErr;
  if (aErr) throw aErr;

  const accessByUser = new Map<string, { restaurantId: string; role: string }[]>();
  for (const row of access ?? []) {
    const list = accessByUser.get(row.user_id) ?? [];
    list.push({ restaurantId: row.restaurant_id, role: row.role });
    accessByUser.set(row.user_id, list);
  }

  return (users ?? []).map((u) =>
    mapApiUserToAppUser(u, accessByUser.get(u.id) ?? [])
  );
}

export async function assignRestaurantRole(
  userId: string,
  restaurantId: string,
  role: RestaurantRole
) {
  return performAction('staff.role', restaurantId, { userId, role });
}

export async function removeRestaurantAccess(userId: string, restaurantId: string) {
  await performAction('staff.remove', restaurantId, { userId });
}
