import type { Workout } from '../src';

let counter = 0;

/** Deterministic RFC-4122-shaped ids for tests. */
export function testId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
}

/** Build a workout on a calendar day (TZ is pinned to UTC in vitest.config.ts). */
export function workout(
  day: string,
  sets: Record<string, [weightKg: number, reps: number][]>,
  extra: Partial<Workout> = {},
): Workout {
  return {
    id: testId(),
    name: 'Session',
    startedAt: `${day}T18:00:00.000Z`,
    durationMin: 60,
    notes: '',
    routineId: null,
    updatedAt: `${day}T19:00:00.000Z`,
    deletedAt: null,
    exercises: Object.entries(sets).map(([exerciseId, list]) => ({
      exerciseId,
      sets: list.map(([weightKg, reps]) => ({ id: testId(), weightKg, reps })),
    })),
    ...extra,
  };
}
