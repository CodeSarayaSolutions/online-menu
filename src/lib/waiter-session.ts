export type WaiterSession = {
  waiterId: string;
  waiterName: string;
  waiterAvatar: string | null;
  venueSlug: string;
  loginTime: string;
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_HISTORY = 5;

function sessionKey(venueSlug: string) {
  return `sarayamenu_waiter_${venueSlug}`;
}

function historyKey(venueSlug: string) {
  return `sarayamenu_waiter_history_${venueSlug}`;
}

export function getWaiterSession(venueSlug: string): WaiterSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(sessionKey(venueSlug));
    if (!raw) return null;
    const session = JSON.parse(raw) as WaiterSession;
    const age = Date.now() - new Date(session.loginTime).getTime();
    if (age > SESSION_TTL_MS) {
      localStorage.removeItem(sessionKey(venueSlug));
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setWaiterSession(session: WaiterSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(sessionKey(session.venueSlug), JSON.stringify(session));

  const key = historyKey(session.venueSlug);
  let history: string[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) history = JSON.parse(raw) as string[];
  } catch {
    history = [];
  }
  const next = [session.waiterId, ...history.filter((id) => id !== session.waiterId)].slice(
    0,
    MAX_HISTORY
  );
  localStorage.setItem(key, JSON.stringify(next));
}

export function clearWaiterSession(venueSlug: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(sessionKey(venueSlug));
}

export function getWaiterHistory(venueSlug: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(historyKey(venueSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
