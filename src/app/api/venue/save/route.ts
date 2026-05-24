import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import type { RestaurantData } from '@/store/cmsStore';
import { saveVenueToCloud } from '@/lib/venue-cloud/sync';

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { slug?: string; data?: RestaurantData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { slug, data } = body;
  if (!slug || !data) {
    return NextResponse.json({ error: 'slug and data are required' }, { status: 400 });
  }

  try {
    await saveVenueToCloud(slug, data, supabaseAdmin);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
