import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-server';
import { verifyPinResetOtp } from '@/lib/auth/pin-reset-otp';

const PIN_RE = /^\d{3}$/;

export async function POST(request: Request) {
  let body: { userId?: string; otp?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, otp, pin } = body;
  if (!userId || !otp || !pin || !PIN_RE.test(pin)) {
    return NextResponse.json(
      { error: 'userId, otp (6 digits), and pin (3 digits) are required' },
      { status: 400 }
    );
  }

  const { data: user, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, pin_reset_otp_hash, pin_reset_otp_expires_at')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!user.pin_reset_otp_hash || !user.pin_reset_otp_expires_at) {
    return NextResponse.json({ error: 'Nema aktivnog PIN koda. Zatražite novi od administratora.' }, { status: 400 });
  }

  if (new Date(user.pin_reset_otp_expires_at) < new Date()) {
    return NextResponse.json({ error: 'PIN kod je istekao. Zatražite novi od administratora.' }, { status: 400 });
  }

  if (!verifyPinResetOtp(otp, user.pin_reset_otp_hash)) {
    return NextResponse.json({ error: 'Pogrešan PIN kod' }, { status: 400 });
  }

  const hash = await bcrypt.hash(pin, 10);
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      pin_hash: hash,
      pin_reset_otp_hash: null,
      pin_reset_otp_expires_at: null,
    })
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
