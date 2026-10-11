import { actionFailure, sameOrigin } from '@/lib/hos-server';
import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { canManageShifts, canViewShiftSummary } from '@/lib/auth/shift-access';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getDateRoster, saveDateRoster } from '@/services/shiftService';
import type { SaveDateRosterInput } from '@/types/shift';

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId')?.trim();
  const date = url.searchParams.get('date')?.trim();
  if (!restaurantId || !date) {
    return NextResponse.json({ error: 'restaurantId and date are required' }, { status: 400 });
  }

  try {
    const canView = await canViewShiftSummary(user, restaurantId);
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roster = await getDateRoster(restaurantId, date, supabaseAdmin);
    return NextResponse.json({ roster }, { status: 200 });
  } catch (err) {
    return actionFailure(err, 'shift.roster', user.id, restaurantId);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { restaurantId?: string; roster?: SaveDateRosterInput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim();
  const roster = body.roster;
  if (!restaurantId || !roster?.date) {
    return NextResponse.json({ error: 'restaurantId and roster are required' }, { status: 400 });
  }

  try {
    const allowed = await canManageShifts(user, restaurantId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const saved = await saveDateRoster(restaurantId, roster, user.id, supabaseAdmin);
    return NextResponse.json({ roster: saved }, { status: 200 });
  } catch (err) {
    return actionFailure(err, 'shift.roster', user.id, restaurantId);
  }
}
