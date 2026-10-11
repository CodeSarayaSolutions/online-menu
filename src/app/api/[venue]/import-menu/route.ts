import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { actionFailure, sameOrigin } from '@/lib/hos-server';
import type { CategoryInfo, ProductItem } from '@/types/cms';
import type { Json } from '@/types/supabase';

export async function POST(request: Request, { params }: { params: { venue: string } }) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) return NextResponse.json({}, { status: 401 });
  const slug = params.venue;
  try {
    const { data: role, error: roleError } = await supabaseAdmin.rpc('hos_role', { p_actor: user.id, p_venue: slug });
    if (roleError) throw roleError;
    if (!['admin', 'owner', 'manager'].includes(role ?? '')) return NextResponse.json({}, { status: 403 });
    const body = await request.json() as { categories: CategoryInfo[]; products: ProductItem[]; mode?: 'merge' | 'replace'; revision: number; requestKey: string };
    if (!Array.isArray(body.categories) || !Array.isArray(body.products) || !Number.isSafeInteger(body.revision) || !body.requestKey || (body.mode && !['merge', 'replace'].includes(body.mode))) return NextResponse.json({}, { status: 400 });
    const importHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const recover=async()=>{const {data,error}=await supabaseAdmin.rpc('hos_import_receipt',{p_actor:user.id,p_venue:slug,p_key:body.requestKey,p_hash:importHash});if(error)throw error;return data;};
    const recovered=await recover();if(recovered)return NextResponse.json({ok:true,result:recovered});
    const { data: categories, error: categoryError } = await supabaseAdmin.from('categories').select('id,label').eq('restaurant_id', slug);
    if (categoryError) throw categoryError;
    const products: { id: string; name: string; category: string; category_id: string | null }[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('products').select('id,name,category,category_id').eq('restaurant_id', slug).order('id').range(offset, offset + 499);
      if (error) throw error;
      products.push(...(data ?? [])); if (!data || data.length < 500) break;
    }
    const replace = body.mode === 'replace';
    const incomingCategories = body.categories.filter(c => !['all', 'popular'].includes(c.id));
    const addedCategories = incomingCategories.filter(c => replace || !categories?.some(old => old.id === c.id));
    const availableCategories = [...(replace ? [] : categories ?? []), ...incomingCategories.filter(c => replace || !categories?.some(old => old.id === c.id))];
    const categoryIdentity = (product: { categoryId?: string; category: string }) => {
      const exact = availableCategories.find(c => c.id === (product.categoryId ?? product.category));
      if (exact) return exact.id;
      const matches = availableCategories.filter(c => c.label === product.category);
      if (matches.length !== 1) throw new Error('Import requires an unambiguous category ID');
      return matches[0].id;
    };
    const keys = new Set(products.map(p => `${p.name.toLowerCase()}|${p.category_id ?? p.category}`));
    const addedProducts = body.products.filter(p => {
      const key = `${p.name.toLowerCase()}|${categoryIdentity(p)}`;
      if (!replace && keys.has(key)) return false;
      keys.add(key); return true;
    }).map((p, i) => ({ ...p, categoryId: categoryIdentity(p), id: `import-${createHash('sha256').update(`${slug}:${body.requestKey}:${i}`).digest('hex').slice(0, 32)}`, restaurantId: slug, station: p.station ?? 'bar', initialInventory: { tracked: false, quantity: 0 } }));
    const patch = {
      importMetadata: {hash:importHash},
      categoriesUpsert: addedCategories.map((c, i) => ({ ...c, sort_order: (replace ? 0 : categories?.length ?? 0) + i })),
      categoriesDelete: replace ? (categories ?? []).filter(c => !incomingCategories.some(n => n.id === c.id)).map(c => c.id) : [],
      productsUpsert: addedProducts,
      productsDelete: replace ? products.map(p => p.id) : [],
    };
    const { data, error } = await supabaseAdmin.rpc('hos_menu_save', { p_actor: user.id, p_venue: slug, p_revision: body.revision, p_patch: patch as unknown as Json, p_request_key: body.requestKey });
    if (error) {const recovered=await recover();if(recovered)return NextResponse.json({ok:true,result:recovered});throw error;}
    return NextResponse.json({ ok: true, result: data, imported: { categories: replace ? addedCategories.length : (categories?.length ?? 0) + addedCategories.length, products: replace ? addedProducts.length : products.length + addedProducts.length, newCategories: addedCategories.length, newProducts: addedProducts.length }, inventory: { initialized: addedProducts.length, failed: 0 } });
  } catch (error) { return actionFailure(error, 'menu.import', user.id, slug); }
}
