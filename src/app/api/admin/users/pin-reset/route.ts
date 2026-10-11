import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { hashPassword } from '@/lib/auth/password';
import { runAction, actionFailure, sameOrigin } from '@/lib/hos-server';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({}, { status: 401 });
  try {
    const body = await request.json();
    const code = String(randomInt(0, 1000)).padStart(3, '0');
    await runAction(user.id, 'staff.temporary-pin', body.restaurantId ?? '', { userId: body.userId, pinHash: await hashPassword(code) });
    return NextResponse.json({ code, userId: body.userId, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return actionFailure(error, 'staff.temporary-pin', user.id); }
}
