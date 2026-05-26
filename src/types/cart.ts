export interface SelectedVariation {
  variationName: string;
  optionLabel: string;
  priceAdjustment: number;
}

export interface SelectedAddon {
  id: string;
  name: string;
  quantity: number;
  price: number;
  groupId?: string;
  groupLabel?: string;
}

import type { ProductStation } from '@/types/auth';

export interface CartItem {
  id: string;
  cartKey: string;         // unique key: productId + variation combo
  name: string;
  price: number;
  quantity: number;
  image: string;
  /** kitchen / bar / both — copied from product when added to cart */
  station?: ProductStation;
  selectedVariations?: SelectedVariation[];
  selectedAddons?: SelectedAddon[];
  addonQuantities?: Record<string, number>;
}
