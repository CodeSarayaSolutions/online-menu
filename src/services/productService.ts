// ─── Product Service ─────────────────────────────────────
// Replaces: cmsStore's products/categories arrays + CRUD methods
// Handles: Categories, Products, Addons, Variations

import { supabase } from '@/lib/supabase';
import type { Tables, InsertDto, UpdateDto } from '@/types/supabase';
import type { ProductItem, CategoryInfo, Addon, Variation, VariationOption } from '@/types/cms';

export type ProductRow = Tables<'products'>;
export type CategoryRow = Tables<'categories'>;

// ─── Categories ──────────────────────────────────────────

export async function getCategories(restaurantId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertCategory(category: InsertDto<'categories'>) {
  const { data, error } = await supabase
    .from('categories')
    .upsert(category, { onConflict: 'restaurant_id,id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(restaurantId: string, categoryId: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', categoryId);

  if (error) throw error;
}

export async function reorderCategories(restaurantId: string, orderedIds: string[]) {
  // Update sort_order for each category in a batch
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('categories')
      .update({ sort_order: index })
      .eq('restaurant_id', restaurantId)
      .eq('id', id)
  );

  await Promise.all(updates);
}

// ─── Products ────────────────────────────────────────────

export async function getProducts(restaurantId: string): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getProductById(productId: string): Promise<ProductRow | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProduct(product: InsertDto<'products'>): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(productId: string, updates: UpdateDto<'products'>): Promise<ProductRow> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(productId: string) {
  // Cascade deletes handle addons, variations, and variation_options
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw error;
}

// ─── Addons ──────────────────────────────────────────────

export async function getAddons(productId: string) {
  const { data, error } = await supabase
    .from('addons')
    .select('*')
    .eq('product_id', productId);

  if (error) throw error;
  return data ?? [];
}

export async function syncAddons(productId: string, addons: Addon[]) {
  // Delete all existing addons for this product
  await supabase.from('addons').delete().eq('product_id', productId);

  if (addons.length === 0) return;

  // Insert new ones
  const rows = addons.map((a) => ({
    id: a.id,
    product_id: productId,
    name: a.name,
    name_bs: a.name_bs ?? null,
    price: a.price,
  }));

  const { error } = await supabase.from('addons').insert(rows);
  if (error) throw error;
}

// ─── Variations & Options ────────────────────────────────

export async function getVariationsWithOptions(productId: string): Promise<Variation[]> {
  const { data: variations, error: vErr } = await supabase
    .from('variations')
    .select('*')
    .eq('product_id', productId);

  if (vErr) throw vErr;
  if (!variations?.length) return [];

  const variationIds = variations.map((v) => v.id);
  const { data: options, error: oErr } = await supabase
    .from('variation_options')
    .select('*')
    .in('variation_id', variationIds);

  if (oErr) throw oErr;

  return variations.map((v) => ({
    id: v.id,
    name: v.name,
    name_bs: v.name_bs ?? undefined,
    required: v.required,
    options: (options ?? [])
      .filter((o) => o.variation_id === v.id)
      .map((o) => ({
        id: o.id,
        label: o.label,
        label_bs: o.label_bs ?? undefined,
        priceAdjustment: Number(o.price_adjustment),
      })),
  }));
}

export async function syncVariations(productId: string, variations: Variation[]) {
  // Get existing variation IDs to clean up options
  const { data: existingVars } = await supabase
    .from('variations')
    .select('id')
    .eq('product_id', productId);

  if (existingVars?.length) {
    const ids = existingVars.map((v) => v.id);
    await supabase.from('variation_options').delete().in('variation_id', ids);
  }

  // Delete existing variations
  await supabase.from('variations').delete().eq('product_id', productId);

  if (variations.length === 0) return;

  // Insert new variations
  const varRows = variations.map((v) => ({
    id: v.id,
    product_id: productId,
    name: v.name,
    name_bs: v.name_bs ?? null,
    required: v.required,
  }));

  const { error: vErr } = await supabase.from('variations').insert(varRows);
  if (vErr) throw vErr;

  // Insert all options
  const optionRows = variations.flatMap((v) =>
    v.options.map((o) => ({
      id: o.id,
      variation_id: v.id,
      label: o.label,
      label_bs: o.label_bs ?? null,
      price_adjustment: o.priceAdjustment,
    }))
  );

  if (optionRows.length > 0) {
    const { error: oErr } = await supabase.from('variation_options').insert(optionRows);
    if (oErr) throw oErr;
  }
}

// ─── Full Product with Relations ─────────────────────────
// Loads a product with all its addons and variations+options.
// Returns data in the same shape as the existing ProductItem type.

export async function getFullProduct(productId: string): Promise<ProductItem | null> {
  const product = await getProductById(productId);
  if (!product) return null;

  const [addons, variations] = await Promise.all([
    getAddons(productId),
    getVariationsWithOptions(productId),
  ]);

  return {
    id: product.id,
    restaurantId: product.restaurant_id,
    name: product.name,
    name_bs: product.name_bs ?? undefined,
    description: product.description,
    description_bs: product.description_bs ?? undefined,
    price: Number(product.price),
    image: product.image,
    category: product.category,
    popular: product.popular,
    sortOrder: product.sort_order,
    addons: addons.map((a) => ({
      id: a.id,
      name: a.name,
      name_bs: a.name_bs ?? undefined,
      price: Number(a.price),
    })),
    variations,
  };
}

// ─── Full Menu (all products + categories for a venue) ───

export async function getFullMenu(restaurantId: string) {
  const [categories, products] = await Promise.all([
    getCategories(restaurantId),
    getProducts(restaurantId),
  ]);

  // For each product, load addons & variations
  const productIds = products.map((p) => p.id);

  // Batch-load all addons
  const { data: allAddons } = await supabase
    .from('addons')
    .select('*')
    .in('product_id', productIds);

  // Batch-load all variations
  const { data: allVariations } = await supabase
    .from('variations')
    .select('*')
    .in('product_id', productIds);

  const variationIds = (allVariations ?? []).map((v) => v.id);
  const { data: allOptions } = variationIds.length
    ? await supabase.from('variation_options').select('*').in('variation_id', variationIds)
    : { data: [] };

  // Assemble ProductItem[]
  const fullProducts: ProductItem[] = products.map((p) => ({
    id: p.id,
    restaurantId: p.restaurant_id,
    name: p.name,
    name_bs: p.name_bs ?? undefined,
    description: p.description,
    description_bs: p.description_bs ?? undefined,
    price: Number(p.price),
    image: p.image,
    category: p.category,
    popular: p.popular,
    sortOrder: p.sort_order,
    addons: (allAddons ?? [])
      .filter((a) => a.product_id === p.id)
      .map((a) => ({
        id: a.id,
        name: a.name,
        name_bs: a.name_bs ?? undefined,
        price: Number(a.price),
      })),
    variations: (allVariations ?? [])
      .filter((v) => v.product_id === p.id)
      .map((v) => ({
        id: v.id,
        name: v.name,
        name_bs: v.name_bs ?? undefined,
        required: v.required,
        options: (allOptions ?? [])
          .filter((o) => o.variation_id === v.id)
          .map((o) => ({
            id: o.id,
            label: o.label,
            label_bs: o.label_bs ?? undefined,
            priceAdjustment: Number(o.price_adjustment),
          })),
      })),
  }));

  const fullCategories: CategoryInfo[] = categories.map((c) => ({
    id: c.id,
    label: c.label,
    label_bs: c.label_bs ?? undefined,
    icon: c.icon,
    color: c.color,
  }));

  return { categories: fullCategories, products: fullProducts };
}
