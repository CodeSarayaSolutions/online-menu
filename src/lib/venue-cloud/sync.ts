import * as restaurantService from '@/services/restaurantService';
import * as productService from '@/services/productService';
import type { RestaurantData } from '@/store/cmsStore';
import { useCmsStore } from '@/store/cmsStore';
import {
  buildRestaurantData,
  dbCategoriesForSave,
  productToRow,
  restaurantInfoToRow,
} from '@/lib/venue-cloud/mappers';
import type { ThemeCustomization } from '@/store/cmsStore';

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function loadVenueBundle(slug: string): Promise<RestaurantData | null> {
  const [row, menu, pageContent, componentStyles, layoutConfig, themeRows] =
    await Promise.all([
      restaurantService.getRestaurant(slug),
      productService.getFullMenu(slug),
      restaurantService.getPageContent(slug),
      restaurantService.getComponentStyles(slug),
      restaurantService.getLayoutConfig(slug),
      restaurantService.getThemeCustomizations(slug),
    ]);

  if (!row) return null;

  const themeCustomizations: Record<string, ThemeCustomization> = {};
  for (const [themeId, t] of Object.entries(themeRows)) {
    themeCustomizations[themeId] = {
      pageContent: t.page_content,
      componentStyles: t.component_styles,
      layoutConfig: t.layout_config,
    };
  }

  return buildRestaurantData(row, menu, {
    pageContent,
    componentStyles,
    layoutConfig,
    themeCustomizations,
  });
}

export async function saveVenueToCloud(slug: string, data: RestaurantData): Promise<void> {
  const row = restaurantInfoToRow(slug, data.restaurant, data.venueType);
  const existing = await restaurantService.getRestaurant(slug);
  if (existing) {
    await restaurantService.updateRestaurant(slug, row);
  } else {
    await restaurantService.createRestaurant(row);
  }

  await Promise.all([
    restaurantService.savePageContent(slug, data.pageContent),
    restaurantService.saveComponentStyles(slug, data.componentStyles),
    restaurantService.saveLayoutConfig(slug, data.layoutConfig),
  ]);

  for (const [themeId, customization] of Object.entries(data.themeCustomizations ?? {})) {
    await restaurantService.saveThemeCustomization(slug, themeId, {
      componentStyles: customization.componentStyles,
      layoutConfig: customization.layoutConfig,
      pageContent: customization.pageContent,
    });
  }

  const categories = dbCategoriesForSave(data.categories);
  const existingCats = await productService.getCategories(slug);
  const keepCatIds = new Set(categories.map((c) => c.id));
  for (const c of existingCats) {
    if (!keepCatIds.has(c.id)) {
      await productService.deleteCategory(slug, c.id);
    }
  }
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    await productService.upsertCategory({
      id: c.id,
      restaurant_id: slug,
      label: c.label,
      label_bs: c.label_bs ?? null,
      icon: c.icon,
      color: c.color,
      sort_order: i,
    });
  }

  const existingProducts = await productService.getProducts(slug);
  const keepProductIds = new Set(data.products.map((p) => p.id));
  for (const p of existingProducts) {
    if (!keepProductIds.has(p.id)) {
      await productService.deleteProduct(p.id);
    }
  }

  for (const product of data.products) {
    const row = productToRow(product, slug);
    const existing = await productService.getProductById(product.id);
    if (existing) {
      await productService.updateProduct(product.id, row);
    } else {
      await productService.createProduct(row);
    }
    await productService.syncAddons(product.id, product.addons ?? []);
    await productService.syncVariations(product.id, product.variations ?? []);
  }
}

export function queueSaveVenueToCloud(slug: string, data: RestaurantData, delayMs = 600): void {
  const prev = saveTimers.get(slug);
  if (prev) clearTimeout(prev);
  saveTimers.set(
    slug,
    setTimeout(() => {
      saveTimers.delete(slug);
      void saveVenueToCloud(slug, data).catch((err) => {
        console.error(`[venue-cloud] Failed to save ${slug}:`, err);
      });
    }, delayMs)
  );
}

export async function deleteVenueFromCloud(slug: string): Promise<void> {
  const t = saveTimers.get(slug);
  if (t) clearTimeout(t);
  saveTimers.delete(slug);
  await restaurantService.deleteRestaurant(slug);
}

export async function loadAllVenuesIntoStore(): Promise<{ count: number; migrated: boolean }> {
  const rows = await restaurantService.getAllRestaurants();
  let migrated = false;

  if (rows.length === 0) {
    const local = readLegacyLocalCms();
    if (local && Object.keys(local.allRestaurants).length > 0) {
      for (const [id, bundle] of Object.entries(local.allRestaurants)) {
        await saveVenueToCloud(id, bundle);
      }
      useCmsStore.setState({ allRestaurants: local.allRestaurants });
      migrated = true;
      return { count: Object.keys(local.allRestaurants).length, migrated };
    }
    useCmsStore.setState({ allRestaurants: {} });
    return { count: 0, migrated: false };
  }

  const allRestaurants: Record<string, RestaurantData> = {};
  const bundles = await Promise.all(
    rows.map(async (row) => {
      try {
        const bundle = await loadVenueBundle(row.id);
        return bundle ? ([row.id, bundle] as const) : null;
      } catch (e) {
        console.error(`[venue-cloud] Failed to load ${row.id}:`, e);
        return null;
      }
    })
  );
  for (const entry of bundles) {
    if (entry) allRestaurants[entry[0]] = entry[1];
  }

  useCmsStore.setState({ allRestaurants });
  return { count: Object.keys(allRestaurants).length, migrated };
}

function readLegacyLocalCms(): { allRestaurants: Record<string, RestaurantData> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('saraya-cms');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { allRestaurants?: Record<string, RestaurantData> } };
    if (!parsed.state?.allRestaurants) return null;
    return { allRestaurants: parsed.state.allRestaurants };
  } catch {
    return null;
  }
}

/** Load one venue from cloud into the store (public menu pages). */
export async function ensureVenueLoaded(slug: string): Promise<boolean> {
  const store = useCmsStore.getState();
  if (!store.allRestaurants[slug]) {
    const bundle = await loadVenueBundle(slug);
    if (!bundle) return false;
    useCmsStore.setState((s) => ({
      allRestaurants: { ...s.allRestaurants, [slug]: bundle },
    }));
  }
  return useCmsStore.getState().loadVenuePublic(slug);
}
