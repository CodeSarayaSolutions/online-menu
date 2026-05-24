import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-server';
import { createAuthSessionResponse } from '@/lib/auth/create-session';

const PIN_RE = /^\d{3}$/;

export async function POST(request: Request) {
  let body: { userId?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, pin } = body;
  if (!userId || !pin || !PIN_RE.test(pin)) {
    return NextResponse.json(
      { error: 'userId and pin (exactly 3 digits) are required' },
      { status: 400 }
    );
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, avatar, platform_role, pin_hash')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!user.pin_hash) {
    return NextResponse.json({ ok: false, reason: 'no_pin' }, { status: 200 });
  }

  const match = await bcrypt.compare(pin, user.pin_hash);
  if (!match) {
    return NextResponse.json({ ok: false, reason: 'wrong_pin' }, { status: 200 });
  }

  return createAuthSessionResponse(user.id);
}
