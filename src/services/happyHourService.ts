import { supabase } from '@/lib/supabase';
import { DEFAULT_TIMEZONE } from '@/lib/venue-time';
import { isTimeWithinSchedule } from '@/lib/happy-hour';
export { isTimeWithinSchedule } from '@/lib/happy-hour';
import { performAction } from './actionService';
import type { Tables } from '@/types/supabase';

export type HappyHourProduct = Tables<'happy_hour_products'>;
export type HappyHourSchedule = Tables<'happy_hour_schedules'> & {
  products: HappyHourProduct[];
};

export interface HappyHourScheduleInput {
  id?: string;
  label?: string | null;
  startTime: string;
  endTime: string;
  active: boolean;
  products: {
    productId: string;
    overridePrice: number;
  }[];
}

export interface ActiveHappyHourPrice {
  productId: string;
  overridePrice: number;
  label: string;
  scheduleId: string;
}

async function fetchSchedules(
  restaurantId: string,
  activeOnly: boolean
): Promise<HappyHourSchedule[]> {
  const schedules: Tables<'happy_hour_schedules'>[] = [];
  for(let offset=0;;offset+=500){
    let query=supabase.from('happy_hour_schedules').select('*').eq('restaurant_id',restaurantId).order('start_time').order('id').range(offset,offset+499);
    if(activeOnly)query=query.eq('active',true);
    const {data,error}=await query;if(error)throw error;schedules.push(...data??[]);if(!data||data.length<500)break;
  }
  if(!schedules.length)return [];
  const products: HappyHourProduct[]=[];
  for(let batch=0;batch<schedules.length;batch+=100){
    for(let offset=0;;offset+=500){
      const {data,error}=await supabase.from('happy_hour_products').select('*').in('schedule_id',schedules.slice(batch,batch+100).map(s=>s.id)).order('schedule_id').order('product_id').range(offset,offset+499);
      if(error)throw error;products.push(...data??[]);if(!data||data.length<500)break;
    }
  }

  return schedules.map((schedule) => ({
    ...schedule,
    products: (products ?? []).filter((product) => product.schedule_id === schedule.id),
  }));
}

export async function getHappyHourSchedules(restaurantId: string): Promise<HappyHourSchedule[]> {
  return fetchSchedules(restaurantId, false);
}

export async function getActiveHappyHourSchedules(restaurantId: string): Promise<HappyHourSchedule[]> {
  return fetchSchedules(restaurantId, true);
}

export async function saveHappyHourSchedule(
  restaurantId: string,
  input: HappyHourScheduleInput
): Promise<HappyHourSchedule> {
  return performAction<HappyHourSchedule>('happyhour.save', restaurantId, { ...input });
}

export async function deleteHappyHourSchedule(scheduleId: string): Promise<void> {
  const { data, error } = await supabase.from('happy_hour_schedules').select('restaurant_id').eq('id', scheduleId).single();
  if (error) throw error;
  await performAction('happyhour.delete', data.restaurant_id, { id: scheduleId });
}

export function getActiveHappyHourPriceMap(
  schedules: HappyHourSchedule[],
  now = new Date(),
  timezone = DEFAULT_TIMEZONE
): Map<string, ActiveHappyHourPrice> {
  const prices = new Map<string, ActiveHappyHourPrice>();
  for (const schedule of schedules) {
    if (!schedule.active || !isTimeWithinSchedule(now, schedule.start_time, schedule.end_time, timezone)) continue;
    for (const product of schedule.products) {
      prices.set(product.product_id, {
        productId: product.product_id,
        overridePrice: Number(product.override_price),
        label: schedule.label || 'Happy Hour',
        scheduleId: schedule.id,
      });
    }
  }
  return prices;
}
