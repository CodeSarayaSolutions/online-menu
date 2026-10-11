import type { Json } from '@/types/supabase';

export async function performAction<T>(action: string, venue: string, data: Record<string, Json | undefined>): Promise<T> {
  // Keep the key across a transport retry: a lost response must not duplicate a sale.
  const payload = JSON.stringify({ action, venue, data: { requestKey: crypto.randomUUID(), ...data } });
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch('/api/actions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: payload });
      break;
    } catch { if (attempt === 1) throw new Error('Žao nam je, veza je prekinuta. Pokušajte ponovo.'); }
  }
  const body = await response!.json();
  if (!response!.ok) throw new Error(body.error ?? 'Žao nam je, nešto nije uspjelo. Pokušajte ponovo.');
  return body.result as T;
}
