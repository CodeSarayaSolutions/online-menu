import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { verifyPassword, hashPassword, isBcryptHash } from '@/lib/auth/password';
import { verifyInviteOtp } from '@/lib/auth/invite-otp';
import { createAuthSessionResponse } from '@/lib/auth/create-session';

export async function POST(request: Request) {
  let body: {
    email?: string;
    password?: string;
    otp?: string;
    newPassword?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, password_hash, invite_otp_hash, invite_otp_expires_at')
    .eq('email', email)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ error: 'Invalid email or credentials' }, { status: 401 });
  }

  // ─── Invite activation: OTP + set password ─────────────────
  if (!isBcryptHash(user.password_hash)) {
    const otp = body.otp?.trim() ?? '';
    const newPassword = body.newPassword ?? '';

    if (!otp || !newPassword) {
      return NextResponse.json(
        { error: 'Enter the invite code from your admin and choose a password' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (
      !user.invite_otp_expires_at ||
      new Date(user.invite_otp_expires_at) <= new Date()
    ) {
      return NextResponse.json(
        { error: 'Invite code expired. Ask your admin for a new one.' },
        { status: 401 }
      );
    }

    if (!verifyInviteOtp(otp, user.invite_otp_hash)) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 401 });
    }

    const password_hash = await hashPassword(newPassword);
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({
        password_hash,
        invite_otp_hash: null,
        invite_otp_expires_at: null,
      })
      .eq('id', user.id);

    if (updateErr) {
      return NextResponse.json({ error: 'Could not activate account' }, { status: 500 });
    }

    return createAuthSessionResponse(user.id);
  }

  // ─── Normal login: password ──────────────────────────────
  const password = body.password ?? '';
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  const hash = user.password_hash!;
  const valid = await verifyPassword(password, hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  return createAuthSessionResponse(user.id);
}
