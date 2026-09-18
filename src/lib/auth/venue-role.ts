import { supabaseAdmin } from '@/lib/supabase-server';
import type { RestaurantRole } from '@/types/auth';

const STAFF_ROLES = new Set<RestaurantRole>([
  'owner',
  'manager',
  'kitchen',
  'bar',
  'employee',
]);

export async function getVenueRole(
  userId: string,
  restaurantId: string
): Promise<RestaurantRole | null> {
  const { data, error } = await supabaseAdmin
    .from('restaurant_access')
    .select('role')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  const role = data?.role;
  if (
    role === 'owner' ||
    role === 'manager' ||
    role === 'kitchen' ||
    role === 'bar' ||
    role === 'employee'
  ) {
    return role;
  }
  return null;
}

export function canAccessStationFeed(
  platformRole: string,
  venueRole: RestaurantRole | null
): boolean {
  if (platformRole === 'admin') return true;
  return !!venueRole && STAFF_ROLES.has(venueRole);
}

export function canAdvanceStationOrders(
  platformRole: string,
  venueRole: RestaurantRole | null
): boolean {
  return canAccessStationFeed(platformRole, venueRole);
}
