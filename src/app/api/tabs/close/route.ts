import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { closeTab } from '@/services/tabService';

const PAYMENT_METHODS = ['cash', 'card'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && PAYMENT_METHODS.includes(value as PaymentMethod);
}

export async function POST(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { tabId?: string; paymentMethod?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tabId, paymentMethod } = body;
  if (!tabId || !isPaymentMethod(paymentMethod)) {
    return NextResponse.json(
      { error: 'tabId and paymentMethod (cash | card) are required' },
      { status: 400 }
    );
  }

  try {
    const tab = await closeTab(tabId, paymentMethod, supabaseAdmin);
    return NextResponse.json({ ok: true, tab }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Close tab failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
