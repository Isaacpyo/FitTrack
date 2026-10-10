/**
 * Calendar-day helpers. A "date key" is a local calendar day formatted as YYYY-MM-DD.
 * Arithmetic on keys is done in UTC so it is immune to DST shifts; only `toDateKey`
 * looks at the runtime's local time zone.
 */
export type DateKey = string;

const DAY_MS = 86_400_000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false;
  const ms = keyToUtcMs(value);
  return !Number.isNaN(ms) && utcMsToKey(ms) === value;
}

/** Local calendar day of an instant (ISO string or Date) in the runtime's time zone. */
export function toDateKey(instant: string | Date): DateKey {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Calendar day of an instant for a fixed UTC offset (minutes east of UTC, e.g. BST = 60). */
export function toDateKeyAtOffset(instant: string | Date, utcOffsetMinutes: number): DateKey {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  return utcMsToKey(d.getTime() + utcOffsetMinutes * 60_000);
}

function keyToUtcMs(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function utcMsToKey(ms: number): DateKey {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  return utcMsToKey(keyToUtcMs(key) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday (ISO weekday order). */
export function isoWeekday(key: DateKey): number {
  return (new Date(keyToUtcMs(key)).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -isoWeekday(key));
}

/** Inclusive list of keys from `from` to `to`. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** UTC instant for a wall-clock time on a calendar day at a fixed UTC offset. */
export function instantAt(
  key: DateKey,
  hours: number,
  minutes: number,
  utcOffsetMinutes: number,
): string {
  const ms = keyToUtcMs(key) + (hours * 60 + minutes - utcOffsetMinutes) * 60_000;
  return new Date(ms).toISOString();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Mon 6 Oct" */
export function formatDateKey(key: DateKey): string {
  const [, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${WEEKDAYS[isoWeekday(key)]} ${d} ${MONTHS[m - 1]}`;
}

/** "6 Oct" */
export function formatShortDate(key: DateKey): string {
  const [, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}
