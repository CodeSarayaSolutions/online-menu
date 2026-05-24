import type { AppUser, RestaurantAccess, RestaurantRole } from '@/types/auth';
import type { PublicUser } from '@/services/authService';

const RESTAURANT_ROLES: RestaurantRole[] = [
  'owner',
  'manager',
  'kitchen',
  'bar',
  'employee',
];

function normalizeRole(role: string): RestaurantRole {
  if (RESTAURANT_ROLES.includes(role as RestaurantRole)) {
    return role as RestaurantRole;
  }
  if (role === 'manager') return 'manager';
  return 'employee';
}

export function mapApiUserToAppUser(
  user: PublicUser,
  restaurantAccess: { restaurantId: string; role: string }[]
): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? undefined,
    platformRole: user.platform_role,
    restaurantAccess: restaurantAccess.map(
      (a): RestaurantAccess => ({
        restaurantId: a.restaurantId,
        role: normalizeRole(a.role),
      })
    ),
    createdAt: user.created_at,
  };
}
