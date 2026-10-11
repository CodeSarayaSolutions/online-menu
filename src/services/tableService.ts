import { performAction } from './actionService';
import { supabase } from '@/lib/supabase';
import type { Tables, UpdateDto } from '@/types/supabase';

export type RestaurantTableRow = Tables<'restaurant_tables'>;

async function listTables(restaurantId: string, activeOnly: boolean): Promise<RestaurantTableRow[]> {
 const rows:RestaurantTableRow[]=[];
 for(let offset=0;;offset+=500){
  let query=supabase.from('restaurant_tables').select('*').eq('restaurant_id',restaurantId).order('position').order('id').range(offset,offset+499);
  if(activeOnly)query=query.eq('is_active',true);
  const {data,error}=await query;if(error)throw error;rows.push(...data??[]);if(!data||data.length<500)return rows;
 }
}
export async function getTables(restaurantId:string){return listTables(restaurantId,true);}
export async function getAllTables(restaurantId:string){return listTables(restaurantId,false);}

export async function createTable(restaurantId: string, label: string, capacity: number, position: number): Promise<RestaurantTableRow> {
  return performAction('table.create', restaurantId, { label, capacity, position });
}

export async function updateTable(id: string, updates: UpdateDto<'restaurant_tables'>): Promise<RestaurantTableRow> {
  const { data, error } = await supabase.from('restaurant_tables').select('*').eq('id', id).single();
  if (error) throw error;
  return performAction('table.update', data.restaurant_id, { id, label: updates.label ?? data.label, capacity: updates.capacity ?? data.capacity, position: updates.position ?? data.position });
}

export async function deleteTable(id: string): Promise<void> {
  const { data, error } = await supabase.from('restaurant_tables').select('restaurant_id').eq('id', id).single();
  if (error) throw error;
  await performAction('table.retire', data.restaurant_id, { id });
}
