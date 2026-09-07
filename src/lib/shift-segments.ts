/** Helpers for deriving shift segments from work hours + change times. */

function normalizeTime(value: string): string {
  const parts = value.trim().split(':');
  const h = parts[0]?.padStart(2, '0') ?? '00';
  const m = (parts[1] ?? '00').padStart(2, '0');
  return `${h}:${m}`;
}

export function parseTimeToMinutes(value: string): number {
  const [h, m] = normalizeTime(value).split(':').map(Number);
  return h * 60 + m;
}

export function segmentLabel(index: number, total: number): string {
  if (total === 1) return 'Cjelodnevna smjena';
  if (total === 2) return index === 0 ? 'Prva smjena' : 'Druga smjena';
  return `Smjena ${index + 1}`;
}

/** Internal boundaries between consecutive shifts (not including open/close). */
export function segmentsToChangeTimes(
  segments: Array<{ startsAt: string; endsAt: string }>
): string[] {
  if (segments.length <= 1) return [];
  const sorted = [...segments].sort(
    (a, b) => parseTimeToMinutes(a.startsAt) - parseTimeToMinutes(b.startsAt)
  );
  return sorted.slice(0, -1).map((s) => normalizeTime(s.endsAt));
}

export function buildSegmentsFromChangeTimes(
  opensAt: string,
  closesAt: string,
  changeTimes: string[],
  existingSegments: Array<{ id?: string; label?: string }> = []
): Array<{ id?: string; label: string; startsAt: string; endsAt: string }> {
  const open = normalizeTime(opensAt);
  const close = normalizeTime(closesAt);
  const sortedChanges = Array.from(new Set(changeTimes.map(normalizeTime))).sort(
    (a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)
  );
  const boundaries = [open, ...sortedChanges, close];
  const total = boundaries.length - 1;

  return boundaries.slice(0, -1).map((start, i) => ({
    id: existingSegments[i]?.id,
    label: existingSegments[i]?.label?.trim() || segmentLabel(i, total),
    startsAt: start,
    endsAt: boundaries[i + 1],
  }));
}

export function validateChangeTimes(
  opensAt: string,
  closesAt: string,
  changeTimes: string[]
): string | null {
  const openMin = parseTimeToMinutes(opensAt);
  const closeMin = parseTimeToMinutes(closesAt);
  if (closeMin <= openMin) {
    return 'Radno vrijeme: kraj mora biti poslije početka.';
  }

  const normalized = changeTimes.map(normalizeTime).filter(Boolean);
  let prev = openMin;
  for (const time of normalized) {
    const min = parseTimeToMinutes(time);
    if (min <= openMin || min >= closeMin) {
      return 'Vrijeme promjene smjene mora biti između otvaranja i zatvaranja.';
    }
    if (min <= prev) {
      return 'Vremena promjene smjene moraju biti u rastućem redoslijedu.';
    }
    prev = min;
  }
  return null;
}

export function previewSegmentsFromChangeTimes(
  opensAt: string,
  closesAt: string,
  changeTimes: string[]
): Array<{ label: string; startsAt: string; endsAt: string }> {
  return buildSegmentsFromChangeTimes(opensAt, closesAt, changeTimes).map(
    ({ label, startsAt, endsAt }) => ({ label, startsAt, endsAt })
  );
}
