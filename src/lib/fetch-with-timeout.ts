/** Reject if fetch does not complete within `ms` (avoids infinite spinners). */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  ms = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Request timed out after ${ms / 1000}s — check Supabase URL and schema sarayamenu`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
