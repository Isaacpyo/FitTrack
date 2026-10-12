import { addDays, formatDateKey, type WorkoutSet } from '@fittrack/shared';

const numberFormat = new Intl.NumberFormat('en-GB');

export const formatNumber = (n: number) => numberFormat.format(Math.round(n));

export function formatKg(kg: number): string {
  return `${Number.isInteger(kg) ? kg : kg.toFixed(kg * 10 === Math.round(kg * 10) ? 1 : 2)} kg`;
}

/** Large volumes read better in tonnes. */
export function formatVolume(kg: number): string {
  return kg >= 10_000 ? `${(kg / 1000).toFixed(1)} t` : `${formatNumber(kg)} kg`;
}

export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${m ? `${m} min` : ''}`.trim() : `${m} min`;
}

export function relativeDay(key: string, today: string): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return formatDateKey(key);
}

/** "3 × 8 @ 60 kg" for straight sets, otherwise "8, 8, 6 @ 60–62.5 kg". */
export function summariseSets(sets: Pick<WorkoutSet, 'reps' | 'weightKg'>[]): string {
  if (sets.length === 0) return 'No sets';
  const reps = sets.map((s) => s.reps);
  const weights = sets.map((s) => s.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const load =
    max === 0
      ? 'bodyweight'
      : min === max
        ? formatKg(max)
        : `${formatKg(min).replace(' kg', '')}–${formatKg(max)}`;
  const uniform = reps.every((r) => r === reps[0]);
  return `${uniform ? `${sets.length} × ${reps[0]}` : reps.join(', ')} @ ${load}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
