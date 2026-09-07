import { supabaseAdmin } from '@/lib/supabase-server';
import type { SessionUser } from '@/lib/auth/require-session';
import type { RestaurantRole } from '@/types/auth';

const SHIFT_ROLES = new Set<RestaurantRole>(['owner', 'manager']);

async function getRestaurantRole(
  userId: string,
  platformRole: string,
  restaurantId: string
): Promise<RestaurantRole | null> {
  if (platformRole === 'admin') return 'owner';
  const { data, error } = await supabaseAdmin
    .from('restaurant_access')
    .select('role')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as RestaurantRole | undefined) ?? null;
}

export async function canManageShifts(
  user: SessionUser,
  restaurantId: string
): Promise<boolean> {
  const role = await getRestaurantRole(user.id, user.platform_role, restaurantId);
  return !!role && SHIFT_ROLES.has(role);
}

export async function canViewShiftSummary(
  user: SessionUser,
  restaurantId: string
): Promise<boolean> {
  return canManageShifts(user, restaurantId);
}
