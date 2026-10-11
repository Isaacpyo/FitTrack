import { addDays, toDateKey, type DailyActivity } from '@fittrack/shared';
import { localMidnight, type HealthProvider } from './types';

/**
 * Android Health Connect via react-native-health-connect. Requires a development build
 * (`npx expo run:android` or EAS) and the Health Connect app; Expo Go falls back to the mock.
 */
export async function loadNativeProvider(): Promise<HealthProvider | null> {
  try {
    const HC = await import('react-native-health-connect');
    const status = await HC.getSdkStatus();
    if (status !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) return null;
    if (!(await HC.initialize())) return null;

    return {
      source: 'health_connect',
      label: 'Health Connect',
      isMock: false,
      requestPermissions: async () => {
        const granted = await HC.requestPermission([
          { accessType: 'read', recordType: 'Steps' },
          { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
          { accessType: 'read', recordType: 'ExerciseSession' },
        ]);
        return granted.some((p) => 'recordType' in p && p.recordType === 'Steps');
      },
      getDailyActivity: async (from, to) => {
        const timeRangeFilter = {
          operator: 'between' as const,
          startTime: localMidnight(from).toISOString(),
          endTime: localMidnight(addDays(to, 1)).toISOString(),
        };
        const timeRangeSlicer = { period: 'DAYS' as const, length: 1 };
        const [steps, energy, exercise] = await Promise.all([
          HC.aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter, timeRangeSlicer }),
          HC.aggregateGroupByPeriod({ recordType: 'ActiveCaloriesBurned', timeRangeFilter, timeRangeSlicer }),
          HC.aggregateGroupByPeriod({ recordType: 'ExerciseSession', timeRangeFilter, timeRangeSlicer }),
        ]);

        const days = new Map<string, DailyActivity>();
        const day = (startTime: string) => {
          const key = toDateKey(startTime);
          let entry = days.get(key);
          if (!entry) {
            entry = { date: key, steps: 0, activeMinutes: 0, energyKcal: 0, source: 'health_connect' };
            days.set(key, entry);
          }
          return entry;
        };
        for (const g of steps) day(g.startTime).steps = Math.round(g.result.COUNT_TOTAL ?? 0);
        for (const g of energy) day(g.startTime).energyKcal = Math.round(g.result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0);
        for (const g of exercise) day(g.startTime).activeMinutes = Math.round((g.result.EXERCISE_DURATION_TOTAL?.inSeconds ?? 0) / 60);
        return [...days.values()].filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date));
      },
    };
  } catch {
    return null;
  }
}
