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
    let query = supabaseAdmin.from('table_tabs').select('id,restaurant_id').eq('status', 'open');
    if (typeof body.tabId === 'string') query = query.eq('id', body.tabId);
    else if (typeof body.restaurantId === 'string') {
      // Automatic cleanup is limited to the caller's abandoned empty bills.
      query = query.eq('restaurant_id', body.restaurantId).eq('waiter_id', user.id).lt('created_at', new Date(Date.now() - 120000).toISOString());
    } else return NextResponse.json({}, { status: 400 });
    const { data: tabs, error } = await query.limit(100);
    if (error) throw error;
    let discarded = 0;
    for (const tab of tabs ?? []) {
      const { count, error: countError } = await supabaseAdmin.from('tab_items').select('id', { count: 'exact', head: true }).eq('tab_id', tab.id);
      if (countError) throw countError;
      if (count) continue;
      // The transaction rechecks emptiness under the same lock used by additions.
      try { await runAction(user.id, 'tab.discard', tab.restaurant_id, { tabId: tab.id, intervention: body.intervention === true }); discarded++; }
      catch (error) { if (body.tabId) throw error; }
    }
    return NextResponse.json({ ok: true, discarded });
  } catch (error) { return actionFailure(error, 'tab.discard', user.id); }
}
