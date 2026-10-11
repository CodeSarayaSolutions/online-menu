import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import type { Json } from '@/types/supabase';

export async function runAction(actorId: string, action: string, venue: string, data: Record<string, Json | undefined>) {
  const { data: result, error } = await supabaseAdmin.rpc('hos_action', {
    p_actor_id: actorId, p_action: action, p_venue: venue, p_data: data,
  });
  if (error) throw error;
  return result;
}

/** Operational details stay server-side. Never log request bodies or credentials. */
export async function actionFailure(error: unknown, action: string, actorId?: string, venue?: string) {
  const detail = error as { code?: string; message?: string; details?: string };
  const reference = crypto.randomUUID();
  const status = detail?.code === '42501' ? 403 : ['23505', '40001'].includes(detail?.code ?? '') ? 409 : 500;
  const { error: logError } = await supabaseAdmin.rpc('hos_record_incident', {
    p_id: reference, p_actor: actorId ?? null, p_venue: venue ?? null,
    p_code: action, p_context: { code: detail?.code ?? 'unknown', message: (detail?.message ?? 'Unknown failure').slice(0, 1000) },
  });
  if (logError) console.error('Incident persistence failed', { reference, action, code: logError.code });
  return NextResponse.json({ error: 'Žao nam je, nešto nije uspjelo. Pokušajte ponovo.', reference }, { status });
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
