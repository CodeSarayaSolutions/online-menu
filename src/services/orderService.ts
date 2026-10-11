// ─── Order Service ───────────────────────────────────────
// Replaces: orderStore's localStorage-backed orders array
// Uses: Supabase table + Realtime subscription for live updates

import { supabase } from '@/lib/supabase';
import { supabasePostgrestSchema } from '@/lib/supabase-schema';
import type { Tables, InsertDto } from '@/types/supabase';
import type { OrderStatus } from '@/types/order';
import type { CartItem } from '@/types/cart';

const realtimeSchema = supabasePostgrestSchema;

export type OrderRow = Tables<'orders'>;

// ─── CRUD ────────────────────────────────────────────────

export async function getOrders(restaurantId:string):Promise<OrderRow[]>{
 const rows:OrderRow[]=[];
 for(let offset=0;;offset+=100){
  const {data,error}=await supabase.from('orders').select('*').eq('restaurant_id',restaurantId).eq('status','pending').order('created_at').order('id').range(offset,offset+99);
  if(error)throw error;rows.push(...data??[]);if(!data||data.length<100)return rows;
 }
}
export async function decideOrder(venue:string,orderId:string,accept:boolean,minutes:number){
 const response=await fetch('/api/orders/decision',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({venue,orderId,accept,minutes})});
 if(!response.ok)throw new Error('Order decision unavailable');return response.json();
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

