import { dateRange, mockDailyActivity, toDateKey, type DailyActivity } from '@fittrack/shared';
import type { HealthProvider } from './types';

/**
 * Deterministic simulated activity, used on the web (browsers have no health APIs), in Expo Go
 * (no custom native modules) and in tests. Uses the same generator as the demo-account seed, so
 * numbers line up with what the server already has.
 */
export function createMockProvider(now: () => Date = () => new Date()): HealthProvider {
  return {
    source: 'mock',
    label: 'Simulated health data',
    isMock: true,
    requestPermissions: async () => true,
    getDailyActivity: async (from, to) => {
      const current = now();
      const today = toDateKey(current);
      const dayFraction = (current.getHours() * 60 + current.getMinutes()) / 1440;
      return dateRange(from, to)
        .map((d) => mockDailyActivity(d, { today, dayFraction }))
        .filter((d): d is DailyActivity => d !== null);
    },
  };
}
