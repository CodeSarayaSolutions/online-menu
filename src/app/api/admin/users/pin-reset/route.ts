import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import {
  generatePinResetOtp,
  hashPinResetOtp,
  pinResetExpiresAt,
} from '@/lib/auth/pin-reset-otp';
export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string; restaurantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, restaurantId } = body;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (sessionUser.platform_role !== 'admin') {
    if (!restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data: callerAccess } = await supabaseAdmin
      .from('restaurant_access')
      .select('role')
      .eq('user_id', sessionUser.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (!callerAccess || callerAccess.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: targetAccess } = await supabaseAdmin
      .from('restaurant_access')
      .select('user_id')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!targetAccess) {
      return NextResponse.json({ error: 'User not in this venue' }, { status: 403 });
    }
  }

  const code = generatePinResetOtp();
  const expiresAt = pinResetExpiresAt();

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      pin_reset_otp_hash: hashPinResetOtp(code),
      pin_reset_otp_expires_at: expiresAt,
    })
    .eq('id', userId);

  if (error) {
    const message = error.message.includes('pin_reset_otp')
      ? 'PIN reset columns missing — run scripts/add-pin-reset-otp-columns.sql'
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    code,
    expiresAt,
    userId,
  });
}
