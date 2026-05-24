import type { ImagePlacement } from '@/lib/storage/constants';

/** Safe folder name = restaurant slug (DB id). */
export function sanitizeRestaurantFolder(restaurantId: string): string {
  return restaurantId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sanitizeFileName(name: string): string {
  const parts = name.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const base = parts
    .join('.')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const stem = base || 'file';
  return ext ? `${stem}.${ext}` : stem;
}

/** `{restaurantSlug}/{placement}-{originalFileName}` */
export function buildStorageObjectPath(
  restaurantId: string,
  placement: ImagePlacement,
  originalFileName: string
): string {
  const folder = sanitizeRestaurantFolder(restaurantId);
  const file = sanitizeFileName(originalFileName);
  return `${folder}/${placement}-${file}`;
}
