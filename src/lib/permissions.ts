import type { AppUser, PlatformRole, RestaurantRole } from '@/types/auth';

export type AdminNavId =
  | 'venues'
  | 'restaurant'
  | 'products'
  | 'page-content'
  | 'orders'
  | 'kitchen'
  | 'bar'
  | 'tables'
  | 'inventory'
  | 'waiter'
  | 'users';

/** Saraya platform admin — all venues */
export function isPlatformAdmin(user: AppUser | null): boolean {
  return user?.platformRole === 'admin';
}

export function getRestaurantRole(
  user: AppUser | null,
  restaurantId: string
): RestaurantRole | null {
  if (!user) return null;
  if (isPlatformAdmin(user)) return 'owner';
  return user.restaurantAccess.find((a) => a.restaurantId === restaurantId)?.role ?? null;
}

export function canAccessRestaurant(user: AppUser | null, restaurantId: string): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return user.restaurantAccess.some((a) => a.restaurantId === restaurantId);
}

export function getAccessibleRestaurantIds(
  user: AppUser | null,
  allIds: string[]
): string[] {
  if (!user) return [];
  if (isPlatformAdmin(user)) return allIds;
  return user.restaurantAccess.map((a) => a.restaurantId);
}

/** Full platform dashboard (/admin) */
export function canAccessPlatformAdmin(user: AppUser | null): boolean {
  return isPlatformAdmin(user);
}

/** CMS pages (restaurant, products, page content) */
export function canManageVenueCms(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return role === 'owner' || role === 'manager' || isPlatformAdmin(user);
}

export function canManageVenueStaff(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return role === 'owner' || isPlatformAdmin(user);
}

export function canViewKitchenStation(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return (
    isPlatformAdmin(user) ||
    role === 'owner' ||
    role === 'manager' ||
    role === 'kitchen'
  );
}

export function canViewBarStation(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return (
    isPlatformAdmin(user) ||
    role === 'owner' ||
    role === 'manager' ||
    role === 'bar'
  );
}

export function canViewOrdersList(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return (
    isPlatformAdmin(user) ||
    role === 'owner' ||
    role === 'manager' ||
    role === 'employee'
  );
}

export function canManageTables(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return isPlatformAdmin(user) || role === 'owner' || role === 'manager';
}

export function canViewWaiterMode(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return (
    isPlatformAdmin(user) ||
    role === 'owner' ||
    role === 'manager' ||
    role === 'employee'
  );
}

export function canManageInventory(user: AppUser | null, restaurantId: string): boolean {
  const role = getRestaurantRole(user, restaurantId);
  return isPlatformAdmin(user) || role === 'owner';
}

/** Default landing after venue login */
export function getDefaultVenuePath(user: AppUser | null, venueSlug: string): string {
  const role = getRestaurantRole(user, venueSlug);
  if (role === 'kitchen') return `/admin/${venueSlug}/kitchen`;
  if (role === 'bar') return `/admin/${venueSlug}/bar`;
  if (role === 'employee') return `/admin/${venueSlug}/waiter`;
  if (canManageVenueCms(user, venueSlug)) return `/admin/${venueSlug}/restaurant`;
  return `/admin/${venueSlug}/orders`;
}

/** Default landing after platform login */
export function getDefaultPlatformPath(user: AppUser | null): string {
  if (isPlatformAdmin(user)) return '/admin';
  const first = user?.restaurantAccess[0]?.restaurantId;
  if (first) return `/admin/${first}`;
  return '/admin/login';
}

export function visibleVenueNavItems(
  user: AppUser | null,
  restaurantId: string
): AdminNavId[] {
  const items: AdminNavId[] = [];
  if (isPlatformAdmin(user)) items.push('venues');
  if (canManageVenueCms(user, restaurantId)) {
    items.push('restaurant', 'products', 'page-content');
  }
  if (canViewOrdersList(user, restaurantId)) items.push('orders');
  if (canManageTables(user, restaurantId)) items.push('tables');
  if (canManageInventory(user, restaurantId)) items.push('inventory');
  if (canViewWaiterMode(user, restaurantId)) items.push('waiter');
  if (canViewKitchenStation(user, restaurantId)) items.push('kitchen');
  if (canViewBarStation(user, restaurantId)) items.push('bar');
  if (canManageVenueStaff(user, restaurantId) || isPlatformAdmin(user)) items.push('users');
  return items;
}

export function platformRoleLabel(role: PlatformRole): string {
  return role === 'admin' ? 'Platform Admin' : 'Client';
}

export function restaurantRoleLabel(role: RestaurantRole): string {
  const labels: Record<RestaurantRole, string> = {
    owner: 'Owner',
    manager: 'Manager',
    kitchen: 'Kitchen',
    bar: 'Bar',
    employee: 'Staff',
  };
  return labels[role];
}
