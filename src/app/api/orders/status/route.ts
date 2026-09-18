import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { canAdvanceStationOrders, getVenueRole } from '@/lib/auth/venue-role';
import { updateOrderStatus } from '@/services/orderService';
import type { OrderStatus } from '@/types/order';
import { isCloneSale, isViewTicketId } from '@/lib/orders/clones';

const STATUSES: OrderStatus[] = [
  'pending',
  'preparing',
  'ready',
  'served',
  'cancelled',
];

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && STATUSES.includes(value as OrderStatus);
}

export async function PATCH(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { orderId?: unknown; status?: unknown };
  try {
    body = (await request.json()) as { orderId?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  if (!orderId || !isOrderStatus(body.status)) {
    return NextResponse.json(
      { error: 'orderId and status are required' },
      { status: 400 }
    );
  }

  if (isViewTicketId(orderId) || isCloneSale({ id: orderId })) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  try {
    const { data: existing, error } = await supabaseAdmin
      .from('orders')
      .select('id, restaurant_id, kitchen_note')
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;
    if (!existing || isCloneSale(existing)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const venueRole = await getVenueRole(user.id, existing.restaurant_id);
    if (!canAdvanceStationOrders(user.platform_role, venueRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await updateOrderStatus(orderId, body.status, supabaseAdmin);
    return NextResponse.json({ order }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update order failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
