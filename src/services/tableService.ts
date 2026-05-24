import { supabase } from '@/lib/supabase';
import type { InsertDto, Tables, UpdateDto } from '@/types/supabase';

export type RestaurantTableRow = Tables<'restaurant_tables'>;

export async function getTables(restaurantId: string): Promise<RestaurantTableRow[]> {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('position', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getAllTables(restaurantId: string): Promise<RestaurantTableRow[]> {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createTable(
  restaurantId: string,
  label: string,
  capacity: number,
  position: number
): Promise<RestaurantTableRow> {
  const row: InsertDto<'restaurant_tables'> = {
    restaurant_id: restaurantId,
    label,
    capacity,
    position,
    is_active: true,
  };
  const { data, error } = await supabase.from('restaurant_tables').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateTable(
  id: string,
  updates: UpdateDto<'restaurant_tables'>
): Promise<RestaurantTableRow> {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTable(id: string): Promise<void> {
  const { error } = await supabase
    .from('restaurant_tables')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}
