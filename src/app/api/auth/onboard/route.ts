import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { readSessionTokenFromCookie, buildSessionCookie } from '@/lib/auth/cookies';
import { createSessionToken, hashSessionToken } from '@/lib/auth/session-token';
import { hashPassword } from '@/lib/auth/password';
import { sessionPayload } from '@/lib/auth/create-session';
import { actionFailure, sameOrigin } from '@/lib/hos-server';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  try {
    const { pin, confirmation } = await request.json();
    if (typeof pin !== 'string' || !/^\d{3}$/.test(pin) || pin !== confirmation) return NextResponse.json({ error: 'Unesite isti trocifreni PIN oba puta.' }, { status: 400 });
    const token = readSessionTokenFromCookie(request.headers.get('cookie'));
    if (!token) return NextResponse.json({}, { status: 401 });
    const nextToken = createSessionToken();
    const { data, error } = await supabaseAdmin.rpc('hos_action', { p_actor_id: null, p_venue: '', p_action: 'auth.onboard', p_data: { tokenHash: hashSessionToken(token), newTokenHash: hashSessionToken(nextToken), pinHash: await hashPassword(pin) } });
    if (error) throw error;
    const response = NextResponse.json(await sessionPayload((data as { userId: string }).userId, nextToken));
    response.headers.set('Set-Cookie', buildSessionCookie(nextToken));
    return response;
  } catch (error) { return actionFailure(error, 'auth.onboard'); }
}
