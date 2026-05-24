import type { CartItem } from '@/types/cart';
import type { ProductStation } from '@/types/auth';

export type ItemStation = ProductStation;

/** Line items for kitchen screen (food, no prices). */
export function itemsForKitchen(items: CartItem[]): CartItem[] {
  return items.filter((i) => i.station === 'kitchen' || i.station === 'both');
}

/** Line items for bar screen (drinks, with prices). */
export function itemsForBar(items: CartItem[]): CartItem[] {
  return items.filter((i) => i.station === 'bar' || i.station === 'both');
}

/** Food lines shown collapsed on bar view (still visible in full order). */
export function itemsFoodOnlyOnBar(items: CartItem[]): CartItem[] {
  return items.filter((i) => i.station === 'kitchen');
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
