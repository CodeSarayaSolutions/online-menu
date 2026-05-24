import { supabase } from '@/lib/supabase';
import type { InsertDto, Tables, UpdateDto } from '@/types/supabase';

export type InventoryRow = Tables<'inventory'>;
export type InventoryMovementRow = Tables<'inventory_movements'>;

export async function getInventory(restaurantId: string): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('product_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertInventoryItem(
  restaurantId: string,
  productId: string,
  productName: string,
  quantity: number,
  unit: string,
  lowStockThreshold?: number | null
): Promise<InventoryRow> {
  const row: InsertDto<'inventory'> = {
    restaurant_id: restaurantId,
    product_id: productId,
    product_name: productName,
    quantity,
    unit,
    low_stock_threshold: lowStockThreshold ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('inventory')
    .upsert(row, { onConflict: 'restaurant_id,product_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function adjustInventory(
  restaurantId: string,
  productId: string,
  productName: string,
  delta: number,
  reason: string,
  tabId?: string | null,
  waiterId?: string | null
): Promise<InventoryRow | null> {
  const { data: existing } = await supabase
    .from('inventory')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('product_id', productId)
    .maybeSingle();

  if (!existing) {
    if (delta > 0) {
      return upsertInventoryItem(restaurantId, productId, productName, delta, 'kom');
    }
    await supabase.from('inventory_movements').insert({
      restaurant_id: restaurantId,
      product_id: productId,
      product_name: productName,
      quantity_delta: delta,
      reason,
      tab_id: tabId ?? null,
      waiter_id: waiterId ?? null,
    });
    return null;
  }

  const nextQty = Number(existing.quantity) + delta;
  const { data: updated, error: upErr } = await supabase
    .from('inventory')
    .update({ quantity: nextQty, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .select()
    .single();

  if (upErr) throw upErr;

  const { error: movErr } = await supabase.from('inventory_movements').insert({
    restaurant_id: restaurantId,
    product_id: productId,
    product_name: productName,
    quantity_delta: delta,
    reason,
    tab_id: tabId ?? null,
    waiter_id: waiterId ?? null,
  });
  if (movErr) throw movErr;

  return updated;
}

export async function deductTabFromInventory(
  tab: { id: string; restaurant_id: string; waiter_id: string },
  items: { product_id: string; product_name: string; quantity: number }[]
): Promise<void> {
  for (const item of items) {
    const { data: row } = await supabase
      .from('inventory')
      .select('id')
      .eq('restaurant_id', tab.restaurant_id)
      .eq('product_id', item.product_id)
      .maybeSingle();

    if (!row) continue;

    await adjustInventory(
      tab.restaurant_id,
      item.product_id,
      item.product_name,
      -item.quantity,
      'order',
      tab.id,
      tab.waiter_id
    );
  }
}

export async function getMovements(
  restaurantId: string,
  from?: string,
  to?: string
): Promise<InventoryMovementRow[]> {
  let q = supabase
    .from('inventory_movements')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from('inventory').delete().eq('id', id);
  if (error) throw error;
}

export async function updateInventoryRow(
  id: string,
  updates: UpdateDto<'inventory'>
): Promise<InventoryRow> {
  const { data, error } = await supabase
    .from('inventory')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
