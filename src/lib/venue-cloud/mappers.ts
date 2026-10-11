import type { InsertDto, Tables } from '@/types/supabase';
import type {
  CategoryInfo,
  ComponentStyles,
  LayoutConfig,
  PageContent,
  ProductItem,
  RestaurantInfo,
} from '@/types/cms';
import type { RestaurantData, ThemeCustomization, VenueType } from '@/store/cmsStore';
import {
  defaultComponentStyles,
  defaultLayoutConfig,
  defaultPageContent,
} from '@/store/cmsStore';

type RestaurantRow = Tables<'restaurants'>;

const VIRTUAL_CATEGORY_IDS = new Set(['all', 'popular']);

export function ensureVirtualCategories(categories: CategoryInfo[]): CategoryInfo[] {
  const out = [...categories];
  if (!out.some((c) => c.id === 'all')) {
    out.unshift({
      id: 'all',
      label: 'All',
      label_bs: 'Sve',
      icon: '🍽️',
      color: 'from-amber-400 to-orange-500',
    });
  }
  if (!out.some((c) => c.id === 'popular')) {
    const allIdx = out.findIndex((c) => c.id === 'all');
    out.splice(allIdx + 1, 0, {
      id: 'popular',
      label: 'Popular',
      label_bs: 'Popularno',
      icon: '🔥',
      color: 'from-red-400 to-pink-500',
    });
  }
  return out;
}

export function dbCategoriesForSave(categories: CategoryInfo[]): CategoryInfo[] {
  return categories.filter((c) => !VIRTUAL_CATEGORY_IDS.has(c.id));
}

export function restaurantRowToInfo(row: RestaurantRow): RestaurantInfo {
  return {
    language: row.language ?? 'bs',
    timezone: row.timezone ?? 'Europe/Sarajevo',
    kitchenEnabled: row.kitchen_enabled ?? false,
    name: row.name,
    name_bs: row.name_bs ?? undefined,
    tagline: row.tagline,
    tagline_bs: row.tagline_bs ?? undefined,
    image: row.image,
    logo: row.logo,
    address: row.address,
    address_bs: row.address_bs ?? undefined,
    openHours: row.open_hours,
    openHours_bs: row.open_hours_bs ?? undefined,
    wifi: row.wifi,
    phone: row.phone,
  };
}

export function restaurantInfoToRow(
  id: string,
  info: RestaurantInfo,
  venueType: VenueType
): InsertDto<'restaurants'> {
  return {
    id,
    name: info.name,
    name_bs: info.name_bs ?? null,
    tagline: info.tagline,
    tagline_bs: info.tagline_bs ?? null,
    image: info.image,
    logo: info.logo,
    address: info.address,
    address_bs: info.address_bs ?? null,
    open_hours: info.openHours,
    open_hours_bs: info.openHours_bs ?? null,
    wifi: info.wifi,
    phone: info.phone,
    venue_type: venueType,
  };
}

export function productToRow(p: ProductItem, restaurantId: string): InsertDto<'products'> {
  return {
    id: p.id,
    restaurant_id: restaurantId,
    category: p.category,
    category_id: p.categoryId ?? null,
    name: p.name,
    name_bs: p.name_bs ?? null,
    description: p.description,
    description_bs: p.description_bs ?? null,
    price: p.price,
    image: p.image,
    popular: p.popular ?? false,
    sort_order: p.sortOrder ?? 0,
    station: p.station ?? 'bar',
  };
}

export function buildRestaurantData(
  row: RestaurantRow,
  menu: { categories: CategoryInfo[]; products: ProductItem[] },
  cms: {
    pageContent: PageContent | null;
    componentStyles: ComponentStyles | null;
    layoutConfig: LayoutConfig | null;
    themeCustomizations: Record<string, ThemeCustomization>;
  }
): RestaurantData {
  return {
    revision: row.revision ?? 0,
    venueType: row.venue_type as VenueType,
    restaurant: restaurantRowToInfo(row),
    categories: ensureVirtualCategories(menu.categories),
    products: menu.products,
    pageContent: cms.pageContent ?? { ...defaultPageContent },
    componentStyles: cms.componentStyles ?? { ...defaultComponentStyles },
    layoutConfig: cms.layoutConfig ?? { ...defaultLayoutConfig },
    themeCustomizations: cms.themeCustomizations,
    createdAt: row.created_at,
  };
}
