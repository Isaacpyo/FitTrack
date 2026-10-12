import { diffDays, isoWeekday, type DateKey } from '../dates';
import type { DailyActivity } from '../schemas';
import { hashString, mulberry32 } from './random';

/** Recent days the mock user is guaranteed to hit a typical 8k step goal (keeps a visible streak). */
export const MOCK_ACTIVE_RECENT_DAYS = 11;

/**
 * Deterministic "health data" for one day. Used by the web/Expo Go mock health provider and by
 * the demo-account seed, so both agree on the numbers for any given date.
 *
 * @param dayFraction share of `today` that has elapsed (0..1) — today's totals grow during the day.
 */
export function mockDailyActivity(
  date: DateKey,
  opts: { today: DateKey; dayFraction?: number },
): DailyActivity | null {
  const daysAgo = diffDays(date, opts.today);
  if (daysAgo < 0) return null;

  const rand = mulberry32(hashString(`fittrack:${date}`));
  const weekend = isoWeekday(date) >= 5;
  let steps = 3500 + rand() * 9500;
  if (weekend) steps *= 0.85;
  if (daysAgo >= 1 && daysAgo <= MOCK_ACTIVE_RECENT_DAYS)
    steps = Math.max(steps, 8600 + rand() * 3200);
  if (daysAgo === 0) steps *= Math.min(1, Math.max(0, opts.dayFraction ?? 1));

  const activeMinutes = Math.round(steps / 230 + rand() * 12);
  return {
    date,
    steps: Math.round(steps),
    activeMinutes,
    energyKcal: Math.round(steps * 0.045 + activeMinutes * 3.5),
    source: 'mock',
  };
}
