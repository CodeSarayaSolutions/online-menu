import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { readSessionTokenFromCookie } from '@/lib/auth/cookies';
import { hashSessionToken } from '@/lib/auth/session-token';
import { USER_PUBLIC_COLUMNS } from '@/lib/auth/constants';

export async function GET(request: Request) {
  const token = readSessionTokenFromCookie(request.headers.get('cookie'));
  if (!token) {
    return NextResponse.json({ user: null, sessionToken: null });
  }

  const tokenHash = hashSessionToken(token);
  const { data: session, error } = await supabaseAdmin
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ user: null, sessionToken: null });
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select(USER_PUBLIC_COLUMNS)
    .eq('id', session.user_id)
    .maybeSingle();

  if (userError || !user) {
    return NextResponse.json({ user: null, sessionToken: null });
  }

  const { data: accessRows } = await supabaseAdmin
    .from('restaurant_access')
    .select('restaurant_id, role')
    .eq('user_id', session.user_id);

  return NextResponse.json({
    user,
    restaurantAccess: (accessRows ?? []).map((r) => ({
      restaurantId: r.restaurant_id,
      role: r.role,
    })),
    sessionToken: token,
  });
}
