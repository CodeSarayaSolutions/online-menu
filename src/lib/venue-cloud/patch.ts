import type { RestaurantData } from '@/store/cmsStore';
import { dbCategoriesForSave, restaurantInfoToRow } from './mappers';
import type { Json } from '@/types/supabase';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Build a change set from the last confirmed save, never from another venue's flat UI state. */
export function menuPatch(slug: string, next: RestaurantData, base?: RestaurantData): Record<string, Json | undefined> {
  const patch: Record<string, Json | undefined> = {};
  if (!base) patch.platformConfig = { language: next.restaurant.language ?? 'bs', timezone: next.restaurant.timezone ?? 'Europe/Sarajevo', kitchenEnabled: next.restaurant.kitchenEnabled ?? false };
  const restaurant = restaurantInfoToRow(slug, next.restaurant, next.venueType);
  if (!base || !same(restaurant, restaurantInfoToRow(slug, base.restaurant, base.venueType))) patch.restaurant = restaurant as unknown as Json;
  const categories = dbCategoriesForSave(next.categories).map((c, sort_order) => ({ ...c, sort_order }));
  const oldCategories = dbCategoriesForSave(base?.categories ?? []).map((c, sort_order) => ({ ...c, sort_order }));
  const categoriesUpsert = categories.filter(c => !same(c, oldCategories.find(old => old.id === c.id)));
  const categoriesDelete = oldCategories.filter(c => !categories.some(next => next.id === c.id)).map(c => c.id);
  if (categoriesUpsert.length) patch.categoriesUpsert = categoriesUpsert;
  if (categoriesDelete.length) patch.categoriesDelete = categoriesDelete;
  const productsUpsert = next.products.filter(p => !same(p, base?.products.find(old => old.id === p.id))).map(p => {
    const old = base?.products.find(old => old.id === p.id);
    const result = { ...p };
    if (old && same(p.addons, old.addons)) delete result.addons;
    if (old && same(p.variations, old.variations)) delete result.variations;
    return result;
  });
  const productsDelete = (base?.products ?? []).filter(p => !next.products.some(next => next.id === p.id)).map(p => p.id);
  if (productsUpsert.length) patch.productsUpsert = productsUpsert as unknown as Json;
  if (productsDelete.length) patch.productsDelete = productsDelete;
  for (const key of ['pageContent', 'componentStyles', 'layoutConfig', 'themeCustomizations'] as const) {
    if (!base || !same(next[key], base[key])) patch[key] = next[key] as unknown as Json;
  }
  return patch;
}
