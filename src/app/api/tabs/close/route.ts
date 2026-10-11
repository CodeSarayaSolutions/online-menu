import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { runAction, actionFailure, sameOrigin } from '@/lib/hos-server';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({}, { status: 401 });
  try {
    const body = await request.json();
    const { data: tab } = await supabaseAdmin.from('table_tabs').select('restaurant_id').eq('id', body.tabId).maybeSingle();
    if (!tab) return NextResponse.json({}, { status: 404 });
    return NextResponse.json({ ok: true, tab: await runAction(user.id, 'tab.close', tab.restaurant_id, body) });
  } catch (error) { return actionFailure(error, 'tab.close', user.id); }
}
