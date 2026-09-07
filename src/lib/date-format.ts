const MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;

const WEEKDAYS_LONG = [
  "nedjelja",
  "ponedjeljak",
  "utorak",
  "srijeda",
  "četvrtak",
  "petak",
  "subota",
] as const;

function parseIsoDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

/** e.g. 7.9. */
export function formatDateShort(dateStr: string): string {
  const d = parseIsoDate(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

/** e.g. 7. sep */
export function formatDateMedium(dateStr: string): string {
  const d = parseIsoDate(dateStr);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}

/** e.g. ponedjeljak, 7. sep 2026. */
export function formatDateLong(dateStr: string): string {
  const d = parseIsoDate(dateStr);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}.`;
}

/** e.g. 7. sep – 13. sep 2026. */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = parseIsoDate(weekStart);
  const end = parseIsoDate(weekEnd);
  const startLabel = `${start.getDate()}. ${MONTHS_SHORT[start.getMonth()]}`;
  const endLabel = `${end.getDate()}. ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}.`;
  return `${startLabel} – ${endLabel}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}
