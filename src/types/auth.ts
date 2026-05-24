// ─── Role groups ─────────────────────────────────────────
//
// Platform (Saraya): users.platform_role
//   admin — all venues, /admin dashboard
//
// Restaurant workspace: restaurant_access.role (one row per user × venue)
//   owner    — full CMS + staff + all views
//   manager  — CMS + orders + kitchen + bar
//   kitchen  — kitchen station only
//   bar      — bar station only
//   employee — orders list only (legacy / general staff)

export type VenueType =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'bakery'
  | 'food-truck'
  | 'pizzeria'
  | 'pub'
  | 'lounge';

/** Saraya platform */
export type PlatformRole = 'admin' | 'user';

/** Per-restaurant (client) roles */
export type RestaurantRole = 'owner' | 'manager' | 'kitchen' | 'bar' | 'employee';

export type ProductStation = 'kitchen' | 'bar' | 'both';

export interface RestaurantAccess {
  restaurantId: string;
  role: RestaurantRole;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  platformRole: PlatformRole;
  restaurantAccess: RestaurantAccess[];
  createdAt: string;
}

export interface RestaurantMeta {
  id: string;
  name: string;
  logo: string;
  venueType: VenueType;
  createdAt: string;
}
