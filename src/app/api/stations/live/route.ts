import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { canAccessStationFeed, getVenueRole } from '@/lib/auth/venue-role';
import { getOrders } from '@/services/orderService';
import { getOpenTabs } from '@/services/tabService';
import { isCloneSale } from '@/lib/orders/clones';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const venueRole = await getVenueRole(user.id, restaurantId);
    if (!canAccessStationFeed(user.platform_role, venueRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [orders, tabs] = await Promise.all([
      getOrders(restaurantId, supabaseAdmin),
      getOpenTabs(restaurantId, supabaseAdmin),
    ]);

    return NextResponse.json(
      {
        orders: orders.filter((order) => !isCloneSale(order)),
        tabs,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Station feed failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
