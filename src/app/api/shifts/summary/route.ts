import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { canViewShiftSummary } from '@/lib/auth/shift-access';
import { supabaseAdmin } from '@/lib/supabase-server';
import { buildSegmentSummary } from '@/services/shiftService';

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId')?.trim();
  const date = url.searchParams.get('date')?.trim();
  const segmentId = url.searchParams.get('segmentId')?.trim();

  if (!restaurantId || !date || !segmentId) {
    return NextResponse.json(
      { error: 'restaurantId, date, and segmentId are required' },
      { status: 400 }
    );
  }

  try {
    const allowed = await canViewShiftSummary(user, restaurantId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const summary = await buildSegmentSummary(restaurantId, date, segmentId, supabaseAdmin);
    if (!summary) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    return NextResponse.json({ summary }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
