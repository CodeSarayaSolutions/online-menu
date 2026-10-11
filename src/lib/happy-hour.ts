import { localParts, DEFAULT_TIMEZONE } from './venue-time';

/** Half-open venue-local interval; a late start may continue past midnight. */
export function isTimeWithinSchedule(now: Date, startTime: string, endTime: string, timezone = DEFAULT_TIMEZONE): boolean {
  const minutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  const local = localParts(now, timezone);
  const current = local.hour * 60 + local.minute;
  const start = minutes(startTime), end = minutes(endTime);
  return start < end ? current >= start && current < end : start > end && (current >= start || current < end);
}
