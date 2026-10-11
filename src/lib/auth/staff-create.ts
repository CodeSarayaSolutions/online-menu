import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { hashPassword } from '@/lib/auth/password';
import { runAction, actionFailure, sameOrigin } from '@/lib/hos-server';

export async function createStaff(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({}, { status: 401 });
  let venue = '';
  try {
    const body = await request.json();
    venue = typeof body.restaurantId === 'string' ? body.restaurantId : '';
    const pin = String(randomInt(0, 1000)).padStart(3, '0');
    const result = await runAction(user.id, 'staff.create', venue, {
      firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone,
      role: body.restaurantRole ?? 'employee', platformRole: body.platformRole ?? 'user', pinHash: await hashPassword(pin),
    }) as { id: string };
    return NextResponse.json({ user: { id: result.id, name: `${body.firstName} ${body.lastName}`, email: body.email }, inviteCode: pin, inviteExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return actionFailure(error, 'staff.create', user.id, venue); }
}
