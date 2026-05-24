import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { clearSessionCookie, readSessionTokenFromCookie } from '@/lib/auth/cookies';
import { hashSessionToken } from '@/lib/auth/session-token';

export async function POST(request: Request) {
  const token = readSessionTokenFromCookie(request.headers.get('cookie'));
  if (token) {
    const tokenHash = hashSessionToken(token);
    await supabaseAdmin.from('sessions').delete().eq('token_hash', tokenHash);
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', clearSessionCookie());
  return response;
}
