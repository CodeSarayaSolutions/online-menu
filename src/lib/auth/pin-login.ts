import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashSessionToken } from '@/lib/auth/session-token';
import { verifyPassword } from '@/lib/auth/password';
import { createAuthSessionResponse } from '@/lib/auth/create-session';
import { actionFailure, sameOrigin } from '@/lib/hos-server';

export async function loginWithPin(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!email || email.length > 254 || !/^\d{3}$/.test(pin)) return NextResponse.json({ error: 'Provjerite email i trocifreni PIN.' }, { status: 400 });
    // One account-wide bucket prevents bypass through changing IP addresses or API routes.
    const { data: limit, error: limitError } = await supabaseAdmin.rpc('hos_action', {
      p_actor_id: null, p_action: 'auth.attempt', p_venue: '', p_data: { key: hashSessionToken('login:' + email) },
    });
    if (limitError) throw limitError;
    if (!(limit as { allowed: boolean }).allowed) return NextResponse.json({ error: 'Sačekajte 15 minuta prije sljedećeg pokušaja.' }, { status: 429 });
    const { data: user, error } = await supabaseAdmin.from('users').select('id,pin_hash,credential_version').eq('email', email).maybeSingle();
    if (error) throw error;
    // Same public response for missing accounts and incorrect PINs.
    if (!user?.pin_hash || !await verifyPassword(pin, user.pin_hash)) return NextResponse.json({ error: 'Provjerite email i PIN. Za privremeni PIN obratite se voditelju.' }, { status: 401 });
    return createAuthSessionResponse(user.id, user.credential_version);
  } catch (error) { return actionFailure(error, 'auth.login'); }
}
