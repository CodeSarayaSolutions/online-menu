/** Supabase Storage bucket for menu / venue assets */
export const STORAGE_BUCKET = 'sarayamenu';

/** Prefix in object path: `{restaurantId}/{placement}-{filename}` */
export type ImagePlacement =
  | 'hero'
  | 'logo'
  | 'product'
  | 'page-hero'
  | 'category'
  | 'video';

export function publicStorageUrl(objectPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return objectPath;
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`;
}
