// Local-calendar date helpers. Everything in the app is keyed by the device's
// local calendar day ("YYYY-MM-DD") so that a 11:58 PM movement counts for the
// day Indra actually experienced it.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(y: number, m: number): string {
  return `${y}-${pad(m + 1)}`;
}

export function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function keyToDate(key: string): Date {
  const { y, m, d } = parseKey(key);
  return new Date(y, m, d);
}

/** Whole calendar days from a to b (b - a). DST-safe because it uses UTC math on Y/M/D. */
export function daysBetween(a: string, b: string): number {
  const pa = parseKey(a);
  const pb = parseKey(b);
  return Math.round((Date.UTC(pb.y, pb.m, pb.d) - Date.UTC(pa.y, pa.m, pa.d)) / 86400000);
}

export function addDays(key: string, n: number): string {
  const { y, m, d } = parseKey(key);
  return dayKey(new Date(y, m, d + n));
}

export function weekdayOf(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m, d)).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** US Thanksgiving: fourth Thursday of November. */
export function thanksgivingDay(y: number): number {
  const first = new Date(y, 10, 1).getDay();
  const firstThu = 1 + ((4 - first + 7) % 7);
  return firstThu + 21;
}

/** Mother's-day-style helpers are intentionally absent: we only use public, universal dates. */

export function fmtClock(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(mm)} ${ampm}`;
}

export function fmtHour(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

export function fmtHourRange(h: number): string {
  return `${fmtHour(h)}–${fmtHour((h + 1) % 24)}`;
}

export function fmtDay(key: string): string {
  const { y, m, d } = parseKey(key);
  return `${WEEKDAYS_SHORT[weekdayOf(key)]}, ${MONTHS_SHORT[m]} ${d}, ${y}`;
}

export function fmtDayShort(key: string): string {
  const { m, d } = parseKey(key);
  return `${MONTHS_SHORT[m]} ${d}`;
}

export function fmtMonth(y: number, m: number): string {
  return `${MONTHS[m]} ${y}`;
}

export function fmtDuration(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function relativeDay(key: string, todayKey: string): string {
  const diff = daysBetween(key, todayKey);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WEEKDAYS[weekdayOf(key)];
  return fmtDayShort(key);
}
