import { supabaseAdmin } from '@/lib/supabase-server';
import { createSessionToken, hashSessionToken } from '@/lib/auth/session-token';
import { buildSessionCookie } from '@/lib/auth/cookies';
import { USER_PUBLIC_COLUMNS } from '@/lib/auth/constants';
import { NextResponse } from 'next/server';

export async function sessionPayload(userId: string, token: string) {
  const [{ data: user, error }, { data: access, error: accessError }] = await Promise.all([
    supabaseAdmin.from('users').select(USER_PUBLIC_COLUMNS).eq('id', userId).single(),
    supabaseAdmin.from('restaurant_access').select('restaurant_id,role').eq('user_id', userId),
  ]);
  if (error || accessError || !user) throw error ?? accessError ?? new Error('Account unavailable');
  return { user, restaurantAccess: (access ?? []).map(r => ({ restaurantId: r.restaurant_id, role: r.role })), sessionToken: token };
}

export async function createAuthSessionResponse(userId: string, verifiedVersion: number) {
  const token = createSessionToken();
  const { data, error } = await supabaseAdmin.rpc('hos_action', {
    p_actor_id: null, p_venue: '', p_action: 'auth.session', p_data: { userId, version: verifiedVersion, tokenHash: hashSessionToken(token) },
  });
  if (error) throw error;
  const onboarding = (data as { onboarding: boolean }).onboarding;
  // A challenge token stays HttpOnly and never reaches the browser's Supabase client.
  const response = NextResponse.json(onboarding ? { onboarding: true } : await sessionPayload(userId, token));
  response.headers.set('Set-Cookie', buildSessionCookie(token));
  return response;
}
