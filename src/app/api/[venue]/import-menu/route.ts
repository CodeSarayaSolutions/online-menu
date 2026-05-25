import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { loadVenueBundle, saveVenueToCloud } from '@/lib/venue-cloud/sync';
import { upsertInventoryItem } from '@/services/inventoryService';
import type { CategoryInfo, ProductItem } from '@/types/cms';

interface ImportPayload {
  categories: CategoryInfo[];
  products: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    category: string;
    addons: never[];
    popular: boolean;
    sortOrder: number;
  }>;
  mode?: 'merge' | 'replace';
}

function toProductItems(slug: string, products: ImportPayload['products']): ProductItem[] {
  return products.map((p) => ({
    ...p,
    restaurantId: slug,
    addons: p.addons ?? [],
  }));
}

export async function POST(
  request: Request,
  { params }: { params: { venue: string } }
) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = params.venue;
  if (!slug) {
    return NextResponse.json({ error: 'venue slug required' }, { status: 400 });
  }

  let body: ImportPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { categories: incomingCats, products: incomingProducts, mode = 'merge' } = body;

  if (!Array.isArray(incomingCats) || !Array.isArray(incomingProducts)) {
    return NextResponse.json({ error: 'categories and products arrays required' }, { status: 400 });
  }

  const existing = await loadVenueBundle(slug);
  if (!existing) {
    return NextResponse.json({ error: `Venue "${slug}" not found` }, { status: 404 });
  }

  let finalCategories: CategoryInfo[];
  let finalProducts: ProductItem[];
  let newProducts: ProductItem[];

  if (mode === 'replace') {
    const systemCats = existing.categories.filter((c) => c.id === 'all' || c.id === 'popular');
    finalCategories = [...systemCats, ...incomingCats];
    finalProducts = toProductItems(slug, incomingProducts);
    newProducts = finalProducts;
  } else {
    const existingCatIds = new Set(existing.categories.map((c) => c.id));
    const newCats = incomingCats.filter((c) => !existingCatIds.has(c.id));
    finalCategories = [...existing.categories, ...newCats];

    const existingKeys = new Set(
      existing.products.map((p) => `${p.name.toLowerCase()}|${p.category.toLowerCase()}`)
    );
    const filtered = toProductItems(slug, incomingProducts).filter(
      (p) => !existingKeys.has(`${p.name.toLowerCase()}|${p.category.toLowerCase()}`)
    );
    const offset = existing.products.length;
    newProducts = filtered.map((p, i) => ({
      ...p,
      id: `import-${Date.now()}-${offset + i}`,
      restaurantId: slug,
    }));
    finalProducts = [...existing.products, ...newProducts];
  }

  const updatedBundle = { ...existing, categories: finalCategories, products: finalProducts };

  try {
    await saveVenueToCloud(slug, updatedBundle, supabaseAdmin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Init inventory directly — no HTTP round-trip, no auth issues
  const inventoryResults = await Promise.allSettled(
    newProducts.map((p) =>
      upsertInventoryItem(slug, p.id, p.name, 0, 'kom', null, supabaseAdmin)
    )
  );

  const inventoryFailed = inventoryResults.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({
    ok: true,
    imported: {
      categories: finalCategories.length,
      products: finalProducts.length,
      newCategories: mode === 'replace' ? incomingCats.length : finalCategories.length - existing.categories.length,
      newProducts: newProducts.length,
    },
    inventory: {
      initialized: newProducts.length - inventoryFailed,
      failed: inventoryFailed,
    },
  });
}
