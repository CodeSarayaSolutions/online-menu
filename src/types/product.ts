export interface Addon {
  id: string;
  name: string;
  name_bs?: string;
  price: number;
  groupId?: string;
  groupLabel?: string;
  minSelect?: number;
  maxSelect?: number;
  dependsOn?: {
    variationId: string;
    optionId: string;
  };
}

export interface VariationOption {
  id: string;
  label: string;
  label_bs?: string;
  priceAdjustment: number;
  dependsOn?: {
    variationId: string;
    optionId: string;
  };
}

export interface Variation {
  id: string;
  name: string;
  name_bs?: string;
  required: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: VariationOption[];
}

import type { ProductStation } from '@/types/auth';

export interface Product {
  id: string;
  restaurantId: string;
  name: string;
  name_bs?: string;
  description: string;
  description_bs?: string;
  price: number;
  originalPrice?: number;
  happyHourPrice?: number;
  happyHourLabel?: string;
  image: string;
  category: string;
  /** Which station screen shows this item (default kitchen) */
  station?: ProductStation;
  addons?: Addon[];
  variations?: Variation[];
  popular?: boolean;
  sortOrder?: number;
}
