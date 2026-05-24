import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { adjustInventory, upsertInventoryItem } from '@/services/inventoryService';

export async function POST(request: Request) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    restaurantId?: string;
    productId?: string;
    productName?: string;
    delta?: number;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { restaurantId, productId, productName, delta, reason } = body;
  if (
    !restaurantId ||
    !productId ||
    !productName ||
    reason === undefined ||
    delta === undefined ||
    typeof delta !== 'number' ||
    Number.isNaN(delta)
  ) {
    return NextResponse.json(
      { error: 'restaurantId, productId, productName, delta, and reason are required' },
      { status: 400 }
    );
  }

  if (delta === 0 && reason === 'init') {
    try {
      await upsertInventoryItem(
        restaurantId,
        productId,
        productName,
        0,
        'kom',
        null,
        supabaseAdmin
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inventory init failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (delta === 0) {
    return NextResponse.json({ error: 'delta must be non-zero' }, { status: 400 });
  }

  try {
    await adjustInventory(
      restaurantId,
      productId,
      productName,
      delta,
      reason,
      null,
      null,
      supabaseAdmin
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Inventory adjust failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
