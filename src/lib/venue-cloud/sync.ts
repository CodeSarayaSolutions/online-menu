import * as restaurantService from '@/services/restaurantService';
import * as productService from '@/services/productService';
import type { RestaurantData } from '@/store/cmsStore';
import { useCmsStore } from '@/store/cmsStore';
import {
  buildRestaurantData,
} from '@/lib/venue-cloud/mappers';
import type { ThemeCustomization } from '@/store/cmsStore';
import { menuPatch } from './patch';
import { useVenueSaveStore } from '@/store/venueSaveStore';

const saveChains = new Map<string, Promise<void>>();
const confirmed = new Map<string, RestaurantData>();

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

  const bundle = buildRestaurantData(row, menu, {
    pageContent,
    componentStyles,
    layoutConfig,
    themeCustomizations,
  });
  confirmed.set(slug, structuredClone(bundle));
  return bundle;
}

export async function saveVenueToCloud(slug: string, data: RestaurantData): Promise<void> {
  const snapshot = structuredClone(data);
  const previous = saveChains.get(slug) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(() => postSaveVenueToCloud(slug, snapshot));
  saveChains.set(slug, task);
  try { await task; } finally { if (saveChains.get(slug) === task) saveChains.delete(slug); }
}

async function postSaveVenueToCloud(slug: string, data: RestaurantData): Promise<void> {
  const setStatus = useVenueSaveStore.getState().setStatus;
  const base = confirmed.get(slug);
  const patch = menuPatch(slug, data, base);
  if (!Object.keys(patch).length) return;
  setStatus(slug, { state: 'saving' });
  try {
    const payload = JSON.stringify({ slug, revision: base?.revision ?? data.revision ?? null, patch, requestKey: crypto.randomUUID() });
    let res: Response;
    try { res = await fetch('/api/venue/save', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: payload }); }
    catch { res = await fetch('/api/venue/save', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: payload }); }
    const body = await res.json();
    if (!res.ok) {
      setStatus(slug, { state: 'error', conflict: res.status === 409 });
      throw new Error(body.error ?? 'Sačuvajte izmjene ponovo.');
    }
    confirmed.set(slug, { ...data, revision: body.revision });
    useCmsStore.setState(s => ({ allRestaurants: { ...s.allRestaurants, [slug]: { ...(s.allRestaurants[slug] ?? data), revision: body.revision } } }));
    setStatus(slug, { state: 'saved' });
  } catch (error) {
    if (useVenueSaveStore.getState().venues[slug]?.state !== 'error') setStatus(slug, { state: 'error' });
    throw error;
  }
}

export async function queueSaveVenueToCloud(slug: string, data: RestaurantData): Promise<boolean> {
  try { await saveVenueToCloud(slug, data); return true; }
  catch { return false; } // The shared save banner retains the draft and offers recovery.
}

export async function deleteVenueFromCloud(slug: string): Promise<void> {
  await saveChains.get(slug);
  await restaurantService.deleteRestaurant(slug);
  confirmed.delete(slug);
}

export async function loadAllVenuesIntoStore(): Promise<{ count: number; migrated: boolean }> {
  const rows = await restaurantService.getAllRestaurants();
  let migrated = false;

  if (rows.length === 0) {
    const local = readLegacyLocalCms();
    if (local && Object.keys(local.allRestaurants).length > 0) {
      for (const [id, bundle] of Object.entries(local.allRestaurants)) {
        await postSaveVenueToCloud(id, bundle);
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
        const previous = useCmsStore.getState().allRestaurants[row.id];
        if (previous) return [row.id, previous] as const;
        throw e;
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
