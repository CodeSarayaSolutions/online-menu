import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';

const PIN_RE = /^\d{3}$/;

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  try {
    const hash = await bcrypt.hash(pin, 10);
    const { error } = await supabaseAdmin.from('users').update({ pin_hash: hash }).eq('id', userId);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Set PIN failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
