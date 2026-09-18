/**
 * Route Supabase Storage *display* reads through the edge-cached CDN.
 * Only swaps the host for public object/render storage paths; the Supabase
 * client (auth/db/realtime/upload) keeps using saraya.deployer3000.halvooo.com.
 */
export function toCdn(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (
      u.host === 'saraya.deployer3000.halvooo.com' &&
      (u.pathname.includes('/storage/v1/object/public/') ||
        u.pathname.includes('/storage/v1/render/image/public/'))
    ) {
      u.host = 'cdn.halvooo.com';
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}
