import { performAction } from './actionService';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/supabase';
export type InventoryRow = Tables<'inventory'>;
export type InventoryMovementRow = Tables<'inventory_movements'>;
export interface InventoryTrackedResult { row: InventoryRow; auditWarning?: string }
export async function getInventory(restaurantId: string): Promise<InventoryRow[]> {
 const rows: InventoryRow[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await supabase.from('inventory').select('*').eq('restaurant_id',restaurantId).order('id').range(offset,offset+499);
  if(error)throw error;rows.push(...data??[]);if(!data||data.length<500)return rows;
 }
}
export async function setInventoryTracked(productId:string,restaurantId:string,tracked:boolean,_changedBy?:{id:string;name:string}):Promise<InventoryTrackedResult>{
 return {row:await performAction<InventoryRow>('inventory.tracked',restaurantId,{productId,tracked})};
}
export type StockProduct={id:string;name:string;inventory_id:string|null;quantity:number|null;unit:string|null;tracked:boolean;sold:number;revenue:number};
export type InventoryPage<T>={rows:T[];next:{id:string;at?:string}|null;asOf:string;timezone:string;from:string;to:string};
export async function readInventoryPage<T>(venue:string,options:Record<string,unknown>):Promise<InventoryPage<T>>{
 const response=await fetch('/api/inventory?'+new URLSearchParams({venue,options:JSON.stringify(options)}),{credentials:'include',cache:'no-store'});
 if(!response.ok)throw new Error('Inventory unavailable');return response.json();
}
