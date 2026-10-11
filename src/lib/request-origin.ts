/** Use the configured public origin when TLS terminates at a reverse proxy. */
export function isSameOrigin(request: Pick<Request, 'headers' | 'url'>, publicOrigin?: string): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const expected = new URL(publicOrigin || request.url);
    return ['http:', 'https:'].includes(expected.protocol) && origin === expected.origin;
  } catch {
    return false;
  }
}
