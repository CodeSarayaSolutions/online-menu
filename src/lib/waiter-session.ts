export type WaiterSession = {
  waiterId: string;
  waiterName: string;
  waiterAvatar: string | null;
  venueSlug: string;
  loginTime: string;
};

export type LoginHistoryEntry = {
  userId: string;
  name: string;
  avatar: string | null;
  email: string;
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_HISTORY = 5;
const GLOBAL_HISTORY_KEY = 'sarayamenu_login_history';

function sessionKey(venueSlug: string) {
  return `sarayamenu_waiter_${venueSlug}`;
}

function readHistory(): LoginHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GLOBAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === 'string') {
          return { userId: item, name: '', avatar: null, email: '' };
        }
        if (item && typeof item === 'object' && 'userId' in item) {
          const e = item as LoginHistoryEntry;
          return {
            userId: e.userId,
            name: e.name ?? '',
            avatar: e.avatar ?? null,
            email: e.email ?? '',
          };
        }
        return null;
      })
      .filter((e): e is LoginHistoryEntry => !!e && !!e.userId);
  } catch {
    return [];
  }
}

function writeHistory(entries: LoginHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
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

  saveLoginToHistory({
    userId: session.waiterId,
    name: session.waiterName,
    avatar: session.waiterAvatar,
    email: '',
  });
}

export function clearWaiterSession(venueSlug: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(sessionKey(venueSlug));
}

export function getWaiterHistory(): string[] {
  return readHistory().map((e) => e.userId);
}

export function getLoginHistory(): { userId: string }[] {
  return readHistory().map((e) => ({ userId: e.userId }));
}

export function getLoginHistoryEntries(): LoginHistoryEntry[] {
  return readHistory();
}

export function saveLoginToHistory(entry: LoginHistoryEntry): void {
  if (typeof window === 'undefined') return;
  const history = readHistory();
  const next = [entry, ...history.filter((e) => e.userId !== entry.userId)].slice(0, MAX_HISTORY);
  writeHistory(next);
}
