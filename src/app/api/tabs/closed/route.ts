import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getClosedTabs } from '@/services/tabService';

const ORDER_ROLES = new Set(['owner', 'manager', 'employee']);

async function canViewVenueOrders(userId: string, platformRole: string, restaurantId: string) {
  if (platformRole === 'admin') return true;

  const { data, error } = await supabaseAdmin
    .from('restaurant_access')
    .select('role')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return !!data?.role && ORDER_ROLES.has(data.role);
}

function normalizeDateParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

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
    const allowed = await canViewVenueOrders(user.id, user.platform_role, restaurantId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const from = normalizeDateParam(url.searchParams.get('from'));
    const to = normalizeDateParam(url.searchParams.get('to'));
    const tabs = await getClosedTabs(restaurantId, from, to, supabaseAdmin);

    return NextResponse.json({ tabs }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Closed tabs failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
