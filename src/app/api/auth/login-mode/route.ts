import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { isBcryptHash } from '@/lib/auth/password';

/**
 * After user enters email: tell UI whether to show password or invite OTP fields.
 */
export async function POST(request: Request) {
  let body: { email?: string };
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
    .select('id, name, email, password_hash, invite_otp_hash, invite_otp_expires_at')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    const isSchemaNotExposed =
      error.code === 'PGRST106' || error.message?.includes('Invalid schema');
    return NextResponse.json(
      {
        mode: 'not_found' as const,
        hint: isSchemaNotExposed
          ? 'API cannot see schema "sarayamenu". Add it to PostgREST exposed schemas (PGRST_DB_SCHEMAS) and restart the API.'
          : error.message,
      },
      { status: isSchemaNotExposed ? 503 : 500 }
    );
  }

  if (!user) {
    return NextResponse.json({ mode: 'not_found' as const });
  }

  const hasPassword = isBcryptHash(user.password_hash);
  const hasValidInvite =
    !hasPassword &&
    !!user.invite_otp_hash &&
    !!user.invite_otp_expires_at &&
    new Date(user.invite_otp_expires_at) > new Date();

  if (hasPassword) {
    return NextResponse.json({
      mode: 'password' as const,
      name: user.name,
    });
  }

  if (hasValidInvite) {
    return NextResponse.json({
      mode: 'invite' as const,
      name: user.name,
    });
  }

  return NextResponse.json({
    mode: 'not_found' as const,
    hint: 'No account or invite expired. Ask your admin for a new code.',
  });
}
