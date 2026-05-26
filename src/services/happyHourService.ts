import { supabase } from '@/lib/supabase';
import type { InsertDto, Tables } from '@/types/supabase';

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

function normalizeTime(value: string): string {
  const [hours = '00', minutes = '00'] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
}

function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function isTimeWithinSchedule(now: Date, startTime: string, endTime: string): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= timeToMinutes(startTime) && current < timeToMinutes(endTime);
}

async function fetchSchedules(
  restaurantId: string,
  activeOnly: boolean
): Promise<HappyHourSchedule[]> {
  let query = supabase
    .from('happy_hour_schedules')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('start_time', { ascending: true });

  if (activeOnly) query = query.eq('active', true);

  const { data: schedules, error } = await query;
  if (error) throw error;
  if (!schedules?.length) return [];

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const { data: products, error: productsError } = await supabase
    .from('happy_hour_products')
    .select('*')
    .in('schedule_id', scheduleIds);

  if (productsError) throw productsError;

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
  if (timeToMinutes(input.startTime) >= timeToMinutes(input.endTime)) {
    throw new Error('Vrijeme početka mora biti prije vremena završetka.');
  }

  const invalidProduct = input.products.find((product) => !product.overridePrice || product.overridePrice <= 0);
  if (invalidProduct) {
    throw new Error('Happy hour cijena mora biti veća od 0 za svaki odabrani proizvod.');
  }

  const scheduleRow: InsertDto<'happy_hour_schedules'> = {
    ...(input.id ? { id: input.id } : {}),
    restaurant_id: restaurantId,
    label: input.label?.trim() || null,
    start_time: normalizeTime(input.startTime),
    end_time: normalizeTime(input.endTime),
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  const { data: schedule, error: scheduleError } = await supabase
    .from('happy_hour_schedules')
    .upsert(scheduleRow, { onConflict: 'id' })
    .select()
    .single();

  if (scheduleError) throw scheduleError;

  const { error: deleteError } = await supabase
    .from('happy_hour_products')
    .delete()
    .eq('schedule_id', schedule.id);

  if (deleteError) throw deleteError;

  if (input.products.length > 0) {
    const rows: InsertDto<'happy_hour_products'>[] = input.products.map((product) => ({
      schedule_id: schedule.id,
      product_id: product.productId,
      override_price: product.overridePrice,
    }));

    const { error: productsError } = await supabase.from('happy_hour_products').insert(rows);
    if (productsError) throw productsError;
  }

  const [saved] = await getHappyHourSchedules(restaurantId).then((rows) =>
    rows.filter((row) => row.id === schedule.id)
  );
  return saved ?? { ...schedule, products: [] };
}

export async function deleteHappyHourSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('happy_hour_schedules')
    .delete()
    .eq('id', scheduleId);
  if (error) throw error;
}

export function getActiveHappyHourPriceMap(
  schedules: HappyHourSchedule[],
  now = new Date()
): Map<string, ActiveHappyHourPrice> {
  const prices = new Map<string, ActiveHappyHourPrice>();
  for (const schedule of schedules) {
    if (!schedule.active || !isTimeWithinSchedule(now, schedule.start_time, schedule.end_time)) continue;
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
