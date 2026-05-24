import { supabaseAdmin } from '@/lib/supabase-server';
import { createSessionToken, hashSessionToken } from '@/lib/auth/session-token';
import { buildSessionCookie } from '@/lib/auth/cookies';
import { SESSION_MAX_AGE_DAYS, USER_PUBLIC_COLUMNS } from '@/lib/auth/constants';
import { NextResponse } from 'next/server';

export async function createAuthSessionResponse(userId: string) {
  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select(USER_PUBLIC_COLUMNS)
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 500 });
  }

  const { data: accessRows } = await supabaseAdmin
    .from('restaurant_access')
    .select('restaurant_id, role')
    .eq('user_id', userId);

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);

  const { error: sessionError } = await supabaseAdmin.from('sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (sessionError) {
    return NextResponse.json({ error: 'Could not create session' }, { status: 500 });
  }

  const response = NextResponse.json({
    user,
    restaurantAccess: (accessRows ?? []).map((r) => ({
      restaurantId: r.restaurant_id,
      role: r.role,
    })),
    sessionToken: token,
  });

  response.headers.set('Set-Cookie', buildSessionCookie(token));
  return response;
}
