import { DEFAULT_TIMEZONE } from './venue-time';
type Language = 'bs' | 'en';
function calendar(value: string) { return new Date(`${value}T12:00:00Z`); }
const locale = (language: Language) => language === 'bs' ? 'bs-BA' : 'en-GB';
export function formatDateShort(date: string, language: Language = 'bs'): string {
 return new Intl.DateTimeFormat(locale(language), {day:'numeric',month:'numeric',timeZone:'UTC'}).format(calendar(date));
}
export function formatDateMedium(date: string, language: Language = 'bs'): string {
 return new Intl.DateTimeFormat(locale(language), {day:'numeric',month:'short',timeZone:'UTC'}).format(calendar(date));
}
export function formatDateLong(date: string, language: Language = 'bs'): string {
 return new Intl.DateTimeFormat(locale(language), {weekday:'long',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(calendar(date));
}
export function formatWeekRange(start: string,end: string,language: Language = 'bs'): string {
 return `${formatDateMedium(start,language)} – ${new Intl.DateTimeFormat(locale(language),{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(calendar(end))}`;
}
export function formatDateTime(iso: string,language: Language = 'bs',timezone=DEFAULT_TIMEZONE): string {
 return new Intl.DateTimeFormat(locale(language),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:timezone}).format(new Date(iso));
}
