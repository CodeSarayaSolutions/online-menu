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

  const objectPath = buildStorageObjectPath(restaurantId, placement, file.name || 'upload.bin');
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(objectPath, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    path: objectPath,
    url: publicStorageUrl(objectPath),
  });
}
