import type { CartItem } from '@/types/cart';
import type { ProductStation } from '@/types/auth';

export type ItemStation = ProductStation;

export function resolveItemStation(
  station: ProductStation | string | null | undefined
): ProductStation {
  if (station === 'kitchen' || station === 'bar' || station === 'both') {
    return station;
  }
  // Unset/legacy rows must still reach both station screens.
  return 'both';
}

export function productStation(
  product: { station?: ProductStation | string | null } | null | undefined
): ProductStation {
  return resolveItemStation(product?.station);
}

/** Line items for kitchen screen (food, no prices). */
export function itemsForKitchen(items: CartItem[]): CartItem[] {
  return items.filter((i) => {
    const station = resolveItemStation(i.station);
    return station === 'kitchen' || station === 'both';
  });
}

/** Line items for bar screen (drinks, with prices). */
export function itemsForBar(items: CartItem[]): CartItem[] {
  return items.filter((i) => {
    const station = resolveItemStation(i.station);
    return station === 'bar' || station === 'both';
  });
}

/** Food lines shown collapsed on bar view (still visible in full order). */
export function itemsFoodOnlyOnBar(items: CartItem[]): CartItem[] {
  return items.filter((i) => resolveItemStation(i.station) === 'kitchen');
}

export function hasKitchenItems(items: CartItem[]): boolean {
  return itemsForKitchen(items).length > 0;
}

export function hasBarItems(items: CartItem[]): boolean {
  return itemsForBar(items).length > 0;
}

export function lineTotal(item: CartItem): number {
  return item.price * item.quantity;
}

export function isFiredTabItem(item: {
  fire_status?: string | null;
}): boolean {
  return item.fire_status !== 'backlog';
}

export function tabItemVisibleOnBar(item: {
  fire_status?: string | null;
  station?: ProductStation | string | null;
}): boolean {
  if (!isFiredTabItem(item)) return false;
  const station = resolveItemStation(item.station);
  return station === 'bar' || station === 'both';
}
