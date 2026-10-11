import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { readSessionTokenFromCookie } from '@/lib/auth/cookies';
import { sessionPayload } from '@/lib/auth/create-session';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ user: null, sessionToken: null }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(await sessionPayload(user.id, readSessionTokenFromCookie(request.headers.get('cookie'))!), { headers: { 'Cache-Control': 'no-store' } });
}
