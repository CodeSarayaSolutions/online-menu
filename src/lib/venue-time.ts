export const DEFAULT_TIMEZONE = 'Europe/Sarajevo';

export function isTimeZone(value: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; }
  catch { return false; }
}

export function localParts(now: Date, timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: +get('hour'), minute: +get('minute'), second: +get('second') };
}

export function addCalendarDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Resolve a venue wall-clock time, independent of browser/server timezone.
 * Reject nonexistent DST times; choose the first occurrence of ambiguous times.
 */
export function venueInstant(date: string, time = '00:00', zone = DEFAULT_TIMEZONE): Date {
  addCalendarDays(date, 0);
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time) || !isTimeZone(zone)) throw new Error('Invalid time');
  const target = Date.parse(`${date}T${time.length === 5 ? time + ':00' : time}Z`);
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const instant = new Date(target + hours * 3600000);
    const p = localParts(instant, zone);
    offsets.add(Date.parse(`${p.date}T${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}:${String(p.second).padStart(2,'0')}Z`) - instant.getTime());
  }
  const matches = Array.from(offsets).map(offset => new Date(target - offset)).filter(d => {
    const p = localParts(d, zone);
    return p.date === date && p.hour === +time.slice(0,2) && p.minute === +time.slice(3,5) && p.second === +(time.slice(6,8) || '0');
  }).sort((a,b) => +a - +b);
  if (!matches.length) throw new Error('Time does not exist in this timezone');
  return matches[0];
}

export function reportWindow(kind: 'today' | 'week' | 'custom', zone = DEFAULT_TIMEZONE, now = new Date(), customFrom?: string, customTo?: string) {
  let start = localParts(now, zone).date;
  let last = start;
  if (kind === 'week') {
    const day = new Date(`${start}T12:00:00Z`).getUTCDay() || 7;
    start = addCalendarDays(start, 1 - day);
    last = addCalendarDays(start, 6);
  } else if (kind === 'custom') {
    if (!customFrom || !customTo || customFrom > customTo) throw new Error('Choose a valid date range');
    start = customFrom; last = customTo;
  }
  return { from: venueInstant(start, '00:00', zone).toISOString(), to: venueInstant(addCalendarDays(last, 1), '00:00', zone).toISOString() };
}
