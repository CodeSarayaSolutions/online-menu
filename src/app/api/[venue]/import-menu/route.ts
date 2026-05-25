import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { loadVenueBundle, saveVenueToCloud } from '@/lib/venue-cloud/sync';
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
  mode?: 'merge' | 'replace'; // default: merge
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

  // Load existing venue data
  const existing = await loadVenueBundle(slug);
  if (!existing) {
    return NextResponse.json({ error: `Venue "${slug}" not found` }, { status: 404 });
  }

  let finalCategories: CategoryInfo[];
  let finalProducts: ProductItem[];

  if (mode === 'replace') {
    // Keep system categories (all, popular), replace everything else
    const systemCats = existing.categories.filter((c) => c.id === 'all' || c.id === 'popular');
    finalCategories = [...systemCats, ...incomingCats];
    finalProducts = toProductItems(slug, incomingProducts);
  } else {
    // Merge: add categories that don't exist yet (by id)
    const existingCatIds = new Set(existing.categories.map((c) => c.id));
    const newCats = incomingCats.filter((c) => !existingCatIds.has(c.id));
    finalCategories = [...existing.categories, ...newCats];

    // Merge: add products that don't exist yet (by name+category combo)
    const existingKeys = new Set(
      existing.products.map((p) => `${p.name.toLowerCase()}|${p.category.toLowerCase()}`)
    );
    const newProducts = toProductItems(slug, incomingProducts).filter(
      (p) => !existingKeys.has(`${p.name.toLowerCase()}|${p.category.toLowerCase()}`)
    );
    // Re-assign IDs to avoid collisions with existing
    const offset = existing.products.length;
    const remappedProducts = newProducts.map((p, i) => ({
      ...p,
      id: `import-${Date.now()}-${offset + i}`,
      restaurantId: slug,
    }));
    finalProducts = [...existing.products, ...remappedProducts];
  }

  // Build updated bundle
  const updatedBundle = {
    ...existing,
    categories: finalCategories,
    products: finalProducts,
  };

  try {
    await saveVenueToCloud(slug, updatedBundle, supabaseAdmin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Auto-init inventory for all new products at stock 0
  // (fire and forget — don't block the response)
  const newProductIds = mode === 'replace'
    ? finalProducts.map((p) => ({ id: p.id, name: p.name }))
    : finalProducts.slice(existing.products.length).map((p) => ({ id: p.id, name: p.name }));

  void Promise.allSettled(
    newProductIds.map(({ id, name }) =>
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') ?? '' },
        body: JSON.stringify({ restaurantId: slug, productId: id, productName: name, delta: 0, reason: 'import-init' }),
      })
    )
  );

  return NextResponse.json({
    ok: true,
    imported: {
      categories: finalCategories.length,
      products: finalProducts.length,
      newCategories: mode === 'replace' ? incomingCats.length : finalCategories.length - existing.categories.length,
      newProducts: mode === 'replace' ? incomingProducts.length : finalProducts.length - existing.products.length,
    },
  });
}
