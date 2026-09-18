import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { canAccessStationFeed, getVenueRole } from '@/lib/auth/venue-role';
import { createOrder, getOrders } from '@/services/orderService';
import type { CartItem } from '@/types/cart';
import { productStation } from '@/lib/order-stations';
import { isCloneSale } from '@/lib/orders/clones';

type PaymentMethod = 'cash' | 'card';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeItem(raw: unknown): CartItem | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) return null;
  const quantity = Math.max(1, Math.round(asNumber(raw.quantity, 1)));
  return {
    id,
    cartKey: asString(raw.cartKey) || id,
    name,
    price: asNumber(raw.price),
    quantity,
    image: asString(raw.image),
    station: productStation({ station: asString(raw.station) || undefined }),
    selectedVariations: Array.isArray(raw.selectedVariations)
      ? (raw.selectedVariations as CartItem['selectedVariations'])
      : undefined,
    selectedAddons: Array.isArray(raw.selectedAddons)
      ? (raw.selectedAddons as CartItem['selectedAddons'])
      : undefined,
    addonQuantities:
      isRecord(raw.addonQuantities)
        ? (raw.addonQuantities as CartItem['addonQuantities'])
        : undefined,
  };
}

function newOrderId() {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

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

    const orders = await getOrders(restaurantId, supabaseAdmin);
    return NextResponse.json(
      { orders: orders.filter((order) => !isCloneSale(order)) },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Orders list failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const restaurantId = asString(body.restaurantId).trim();
  const tableNumber = asString(body.tableNumber).trim();
  const kitchenNote = asString(body.kitchenNote).trim();
  const paymentMethod = asString(body.paymentMethod, 'cash') as PaymentMethod;
  const items = Array.isArray(body.items)
    ? body.items.map(normalizeItem).filter((item): item is CartItem => !!item)
    : [];

  if (!restaurantId || !tableNumber || items.length === 0) {
    return NextResponse.json(
      { error: 'restaurantId, tableNumber and items are required' },
      { status: 400 }
    );
  }

  if (paymentMethod !== 'cash' && paymentMethod !== 'card') {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
  }

  const requestedId = asString(body.id).trim();
  if (isCloneSale({ id: requestedId, kitchen_note: kitchenNote })) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  try {
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .maybeSingle();

    if (restaurantError) throw restaurantError;
    if (!restaurant) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const order = await createOrder(
      {
        id: requestedId || newOrderId(),
        restaurantId,
        items,
        tableNumber,
        kitchenNote,
        paymentMethod,
        total,
        itemCount,
      },
      supabaseAdmin
    );

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create order failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
