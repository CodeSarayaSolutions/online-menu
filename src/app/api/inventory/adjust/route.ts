import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { runAction, actionFailure, sameOrigin } from '@/lib/hos-server';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({}, { status: 401 });
  let venue = '';
  try {
    const body = await request.json(); venue = body.restaurantId;
    if (typeof venue !== 'string' || !venue || typeof body.delta !== 'number' || !Number.isFinite(body.delta)) return NextResponse.json({}, { status: 400 });
    const action = body.delta === 0 && body.reason === 'init' ? 'inventory.initialize' : 'inventory.adjust';
    await runAction(user.id, action, venue, body);
    return NextResponse.json({ ok: true });
  } catch (error) { return actionFailure(error, 'inventory.adjust', user.id, venue); }
}
