import { actionFailure, sameOrigin } from '@/lib/hos-server';
import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { canViewShiftSummary } from '@/lib/auth/shift-access';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getRosterHistory } from '@/services/shiftService';

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId')?.trim();
  const from = url.searchParams.get('from')?.trim();
  const to = url.searchParams.get('to')?.trim();
  if (!restaurantId || !from || !to) {
    return NextResponse.json({ error: 'restaurantId, from, and to are required' }, { status: 400 });
  }

  try {
    const allowed = await canViewShiftSummary(user, restaurantId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const history = await getRosterHistory(restaurantId, from, to, supabaseAdmin);
    return NextResponse.json({ history }, { status: 200 });
  } catch (err) {
    return actionFailure(err, 'shift.history', user.id, restaurantId);
  }
}
