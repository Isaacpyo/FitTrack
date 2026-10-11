import type { ActivitySource, DailyActivity, DateKey } from '@fittrack/shared';

/** One source of daily steps / energy / exercise minutes. */
export interface HealthProvider {
  source: ActivitySource;
  /** Shown in the UI, e.g. "Apple Health". */
  label: string;
  isMock: boolean;
  /** Ask the OS for read access. Resolves false if the user declined. */
  requestPermissions(): Promise<boolean>;
  /** One entry per local day in [from, to]; days without data are omitted. */
  getDailyActivity(from: DateKey, to: DateKey): Promise<DailyActivity[]>;
}

/** Local midnight at the start of a calendar day. */
export function localMidnight(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}
