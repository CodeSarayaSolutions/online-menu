import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { canManageShifts, canViewShiftSummary } from '@/lib/auth/shift-access';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  getEligibleShiftStaff,
  getWeeklySchedule,
  saveDaySchedule,
} from '@/services/shiftService';
import type { SaveDayScheduleInput } from '@/types/shift';

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId')?.trim();
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
  }

  try {
    const canView = await canViewShiftSummary(user, restaurantId);
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [schedule, eligibleStaff] = await Promise.all([
      getWeeklySchedule(restaurantId, supabaseAdmin),
      getEligibleShiftStaff(restaurantId, supabaseAdmin),
    ]);

    return NextResponse.json({ schedule, eligibleStaff }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load schedule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { restaurantId?: string; day?: SaveDayScheduleInput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim();
  const day = body.day;
  if (!restaurantId || !day) {
    return NextResponse.json({ error: 'restaurantId and day are required' }, { status: 400 });
  }

  try {
    const allowed = await canManageShifts(user, restaurantId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const schedule = await saveDaySchedule(restaurantId, day, supabaseAdmin);
    return NextResponse.json({ schedule }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save day schedule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
