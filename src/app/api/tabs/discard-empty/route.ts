import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  discardEmptyTab,
  discardStaleEmptyOpenTabs,
  getTabWithItems,
} from '@/services/tabService';

type RequestBody = {
  tabId?: unknown;
  restaurantId?: unknown;
  olderThanMs?: unknown;
};

async function getRestaurantRole(userId: string, restaurantId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('restaurant_access')
    .select('role')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return data?.role ?? null;
}

function canCleanVenue(platformRole: string, restaurantRole: string | null): boolean {
  return platformRole === 'admin' || restaurantRole === 'owner' || restaurantRole === 'manager';
}

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tabId = typeof body.tabId === 'string' ? body.tabId : '';
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId : '';
  const olderThanMs =
    typeof body.olderThanMs === 'number' &&
    Number.isFinite(body.olderThanMs) &&
    body.olderThanMs > 0
      ? body.olderThanMs
      : undefined;

  if (!tabId && !restaurantId) {
    return NextResponse.json({ error: 'tabId or restaurantId is required' }, { status: 400 });
  }

  try {
    if (tabId) {
      const tab = await getTabWithItems(tabId, supabaseAdmin);
      if (!tab) {
        return NextResponse.json({ error: 'Tab not found' }, { status: 404 });
      }

      const role = await getRestaurantRole(user.id, tab.restaurant_id);
      const isOwnTab = tab.waiter_id === user.id;
      if (!isOwnTab && !canCleanVenue(user.platform_role, role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      await discardEmptyTab(
        tabId,
        canCleanVenue(user.platform_role, role) ? undefined : user.id,
        supabaseAdmin
      );
      return NextResponse.json({ ok: true, discarded: 1 }, { status: 200 });
    }

    const role = await getRestaurantRole(user.id, restaurantId);
    if (user.platform_role !== 'admin' && !role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const discarded = await discardStaleEmptyOpenTabs(
      restaurantId,
      {
        olderThanMs,
        waiterId: canCleanVenue(user.platform_role, role) ? undefined : user.id,
      },
      supabaseAdmin
    );
    return NextResponse.json({ ok: true, discarded }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discard empty tab failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
