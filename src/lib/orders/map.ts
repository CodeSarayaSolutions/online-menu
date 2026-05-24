import type { Tables } from '@/types/supabase';
import type { Order } from '@/types/order';
import type { CartItem } from '@/types/cart';

export function orderRowToOrder(row: Tables<'orders'>): Order {
  return {
    id: row.id,
    items: (row.items as unknown as CartItem[]) ?? [],
    tableNumber: row.table_number,
    kitchenNote: row.kitchen_note,
    total: Number(row.total),
    itemCount: row.item_count,
    status: row.status,
    createdAt: row.created_at,
    paymentMethod: row.payment_method ?? "cash",
  };
}
