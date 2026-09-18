// ─── Order Service ───────────────────────────────────────
// Replaces: orderStore's localStorage-backed orders array
// Uses: Supabase table + Realtime subscription for live updates

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { supabasePostgrestSchema } from '@/lib/supabase-schema';
import type { Database, Tables } from '@/types/supabase';
import type { OrderStatus } from '@/types/order';
import type { CartItem } from '@/types/cart';
import { isCloneSale } from '@/lib/orders/clones';

type DbClient = SupabaseClient<Database, 'sarayamenu'>;

const realtimeSchema = supabasePostgrestSchema;

export type OrderRow = Tables<'orders'>;

// ─── CRUD ────────────────────────────────────────────────

export async function getOrders(
  restaurantId: string,
  client?: DbClient
): Promise<OrderRow[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).filter((row) => !isCloneSale(row));
}

export async function getOrdersByStatus(
  restaurantId: string,
  status: OrderStatus
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).filter((row) => !isCloneSale(row));
}

export async function createOrder(
  order: {
    id: string;
    restaurantId: string;
    items: CartItem[];
    tableNumber: string;
    kitchenNote: string;
    paymentMethod: string;
    total: number;
    itemCount: number;
  },
  client?: DbClient
): Promise<OrderRow> {
  if (isCloneSale({ id: order.id, kitchen_note: order.kitchenNote })) {
    throw new Error('Refusing to persist a station clone as an order');
  }

  const db = client ?? supabase;
  const { data, error } = await db
    .from('orders')
    .insert({
      id: order.id,
      restaurant_id: order.restaurantId,
      items: order.items as any,
      table_number: order.tableNumber,
      kitchen_note: order.kitchenNote,
      payment_method: order.paymentMethod,
      total: order.total,
      item_count: order.itemCount,
      status: 'pending' as const,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  client?: DbClient
) {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrder(orderId: string) {
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) throw error;
}

export async function clearAllOrders(restaurantId: string) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('restaurant_id', restaurantId);

  if (error) throw error;
}

// ─── Realtime Subscription ───────────────────────────────
// Subscribe to live order changes for a restaurant.
// Perfect for the admin orders dashboard.

export function subscribeToOrders(
  restaurantId: string,
  callbacks: {
    onInsert?: (order: OrderRow) => void;
    onUpdate?: (order: OrderRow) => void;
    onDelete?: (oldOrder: { id: string }) => void;
  }
) {
  const channel = supabase
    .channel(`orders:${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: realtimeSchema,
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => callbacks.onInsert?.(payload.new as OrderRow)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: realtimeSchema,
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => callbacks.onUpdate?.(payload.new as OrderRow)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: realtimeSchema,
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => callbacks.onDelete?.(payload.old as { id: string })
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Analytics helpers ───────────────────────────────────

export async function getTodayOrderStats(restaurantId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('orders')
    .select('id, total, status, created_at, kitchen_note')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', today.toISOString());

  if (error) throw error;

  const orders = (data ?? []).filter((order) => !isCloneSale(order));
  return {
    totalOrders: orders.length,
    activeOrders: orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status)).length,
    todayRevenue: orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total), 0),
  };
}
