import { actionFailure, sameOrigin } from '@/lib/hos-server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getSessionUserFromRequest } from '@/lib/auth/require-session';
import { STORAGE_BUCKET, publicStorageUrl, type ImagePlacement } from '@/lib/storage/constants';
import { buildStorageObjectPath } from '@/lib/storage/paths';

const PLACEMENTS = new Set<ImagePlacement>([
  'hero',
  'logo',
  'product',
  'page-hero',
  'category',
  'video',
]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({}, { status: 403 });
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  const restaurantId = String(form.get('restaurantId') ?? '').trim();
  const placement = String(form.get('placement') ?? '').trim() as ImagePlacement;

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
  }
  if (!PLACEMENTS.has(placement)) {
    return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
  }

  try {
    const { data: role, error: roleError } = await supabaseAdmin.rpc('hos_role', { p_actor: user.id, p_venue: restaurantId });
    if (roleError) throw roleError;
    if (!['admin', 'owner', 'manager'].includes(role ?? '')) return NextResponse.json({}, { status: 403 });
    const allowedTypes = placement === 'video' ? ['video/mp4', 'video/webm'] : ['image/jpeg','image/png','image/webp','image/gif','image/avif'];
    if (!allowedTypes.includes(file.type) || file.size > (placement === 'video' ? 50 : 10) * 1024 * 1024) return NextResponse.json({ error: 'Odaberite podržanu sliku ili manji fajl.' }, { status: 400 });
    // Unique object names prevent an image edit from overwriting a file used by other products.
    const objectPath = buildStorageObjectPath(restaurantId, placement, `${crypto.randomUUID()}-${file.name}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(objectPath, buffer, { contentType: file.type, upsert: false });
    if (error) throw error;
    const {error:auditError}=await supabaseAdmin.rpc('hos_action',{p_actor_id:user.id,p_action:'media.upload',p_venue:restaurantId,p_data:{path:objectPath,bytes:file.size,placement}});
    if(auditError)throw auditError;
    return NextResponse.json({ path: objectPath, url: publicStorageUrl(objectPath) });
  } catch (error) { return actionFailure(error,'media.upload',user.id,restaurantId); }
}
