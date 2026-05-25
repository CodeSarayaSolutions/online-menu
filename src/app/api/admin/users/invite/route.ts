import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import {
  generateInviteOtp,
  hashInviteOtp,
  inviteExpiresAt,
} from '@/lib/auth/invite-otp';
import { USER_PUBLIC_COLUMNS } from '@/lib/auth/constants';
import { isBcryptHash } from '@/lib/auth/password';

type RestaurantRole =
  | 'owner'
  | 'manager'
  | 'kitchen'
  | 'bar'
  | 'employee';

/**
 * Platform admin (or venue owner/manager) invites a user.
 * Returns a one-time OTP code to copy — no email sent.
 */
// TODO: invite accept page should prompt user to set both password and PIN during first login
export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  let body: {
    email?: string;
    name?: string;
    platformRole?: 'admin' | 'user';
    restaurantId?: string;
    restaurantRole?: RestaurantRole;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const platformRole = body.platformRole ?? 'user';
  const restaurantId = body.restaurantId?.trim();
  const restaurantRole = body.restaurantRole ?? 'manager';

  if (!email || !name) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  if (platformRole === 'admin' && sessionUser.platform_role !== 'admin') {
    return NextResponse.json({ error: 'Only platform admins can create platform admins' }, { status: 403 });
  }

  if (restaurantId && sessionUser.platform_role !== 'admin') {
    const { data: access } = await supabaseAdmin
      .from('restaurant_access')
      .select('role')
      .eq('user_id', sessionUser.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (!access || !['owner', 'manager'].includes(access.role)) {
      return NextResponse.json({ error: 'No permission to invite for this venue' }, { status: 403 });
    }
  }

  const otpPlain = generateInviteOtp();
  const invite_otp_hash = hashInviteOtp(otpPlain);
  const invite_otp_expires_at = inviteExpiresAt();

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, password_hash')
    .eq('email', email)
    .maybeSingle();

  let userId: string;

  if (existing) {
    if (isBcryptHash(existing.password_hash)) {
      return NextResponse.json(
        { error: 'This email already has a password. They should sign in normally.' },
        { status: 409 }
      );
    }
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('users')
      .update({
        name,
        platform_role: platformRole,
        invite_otp_hash,
        invite_otp_expires_at,
        password_hash: null,
      })
      .eq('id', existing.id)
      .select(USER_PUBLIC_COLUMNS)
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ error: 'Could not update invite' }, { status: 500 });
    }
    userId = updated.id;
  } else {
    const { data: created, error: insErr } = await supabaseAdmin
      .from('users')
      .insert({
        name,
        email,
        platform_role: platformRole,
        password_hash: null,
        invite_otp_hash,
        invite_otp_expires_at,
      })
      .select(USER_PUBLIC_COLUMNS)
      .single();

    if (insErr || !created) {
      return NextResponse.json({ error: insErr?.message ?? 'Could not create user' }, { status: 500 });
    }
    userId = created.id;
  }

  if (restaurantId) {
    await supabaseAdmin.from('restaurant_access').upsert(
      {
        user_id: userId,
        restaurant_id: restaurantId,
        role: restaurantRole,
      },
      { onConflict: 'user_id,restaurant_id' }
    );
  }

  return NextResponse.json({
    user: { id: userId, email, name, platform_role: platformRole },
    restaurantId: restaurantId ?? null,
    restaurantRole: restaurantId ? restaurantRole : null,
    inviteCode: otpPlain,
    inviteExpiresAt: invite_otp_expires_at,
    message: 'Copy the invite code and send it to the user (valid 7 days).',
  });
}
