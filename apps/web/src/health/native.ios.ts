import { addDays, toDateKey, type DailyActivity } from '@fittrack/shared';
import { localMidnight, type HealthProvider } from './types';

/**
 * Apple Health via @kingstinct/react-native-healthkit. Requires a development build
 * (`npx expo run:ios` or EAS); Expo Go falls back to the mock provider.
 */
export async function loadNativeProvider(): Promise<HealthProvider | null> {
  try {
    const HK = await import('@kingstinct/react-native-healthkit');
    if (!HK.isHealthDataAvailable()) return null;

    return {
      source: 'healthkit',
      label: 'Apple Health',
      isMock: false,
      requestPermissions: () =>
        HK.requestAuthorization({
          toRead: [
            'HKQuantityTypeIdentifierStepCount',
            'HKQuantityTypeIdentifierActiveEnergyBurned',
            'HKQuantityTypeIdentifierAppleExerciseTime',
          ],
        }),
      getDailyActivity: async (from, to) => {
        const anchor = localMidnight(from);
        const filter = { date: { startDate: anchor, endDate: localMidnight(addDays(to, 1)) } };
        const [steps, energy, exercise] = await Promise.all([
          HK.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], anchor, { day: 1 }, { filter, unit: 'count' }),
          HK.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], anchor, { day: 1 }, { filter, unit: 'kcal' }),
          HK.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierAppleExerciseTime', ['cumulativeSum'], anchor, { day: 1 }, { filter, unit: 'min' }),
        ]);

        const days = new Map<string, DailyActivity>();
        const day = (date: Date | undefined) => {
          if (!date) return null;
          const key = toDateKey(date);
          if (key < from || key > to) return null;
          let entry = days.get(key);
          if (!entry) {
            entry = { date: key, steps: 0, activeMinutes: 0, energyKcal: 0, source: 'healthkit' };
            days.set(key, entry);
          }
          return entry;
        };
        for (const s of steps) {
          const e = day(s.startDate);
          if (e) e.steps = Math.round(s.sumQuantity?.quantity ?? 0);
        }
        for (const s of energy) {
          const e = day(s.startDate);
          if (e) e.energyKcal = Math.round(s.sumQuantity?.quantity ?? 0);
        }
        for (const s of exercise) {
          const e = day(s.startDate);
          if (e) e.activeMinutes = Math.round(s.sumQuantity?.quantity ?? 0);
        }
        return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
      },
    };
  } catch {
    return null; // native module missing (e.g. Expo Go)
  }
}
