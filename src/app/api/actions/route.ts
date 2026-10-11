import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { runAction, actionFailure, sameOrigin } from '@/lib/hos-server';
import { supabaseAdmin } from '@/lib/supabase-server';
import type { Json } from '@/types/supabase';

const ALLOWED = new Set([
  'tab.open', 'tab.enter', 'tab.claim', 'tab.add', 'tab.remove', 'tab.fire', 'tab.discard', 'tab.close',
  'station.done', 'inventory.adjust', 'inventory.tracked', 'inventory.initialize', 'venue.configure',
  'table.create','table.update','table.retire','happyhour.save','happyhour.delete','venue.delete',
  'staff.role', 'staff.remove', 'staff.platform-role',
]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Prijavite se ponovo.' }, { status: 401 });
  let action = ''; let venue = '';
  try {
    const body = await request.json();
    action = typeof body.action === 'string' ? body.action : '';
    venue = typeof body.venue === 'string' ? body.venue : '';
    if (!ALLOWED.has(action) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return NextResponse.json({ error: 'Nevažeći zahtjev.' }, { status: 400 });
    }
    const data: Record<string, Json | undefined> = body.data;
    // Derive the venue from the target bill; never trust a caller's ownership claim.
    if (typeof data.tabId === 'string') {
      const { data: tab, error } = await supabaseAdmin.from('table_tabs').select('restaurant_id').eq('id', data.tabId).maybeSingle();
      if (error) throw error;
      if (!tab || (venue && venue !== tab.restaurant_id)) return NextResponse.json({ error: 'Nije dostupno.' }, { status: 404 });
      venue = tab.restaurant_id;
    }
    if (!venue && !(user.platform_role === 'admin' && action === 'staff.platform-role')) return NextResponse.json({ error: 'Nevažeći zahtjev.' }, { status: 400 });
    return NextResponse.json({ result: await runAction(user.id, action, venue, data) });
  } catch (error) { return actionFailure(error, action, user.id, venue); }
}
