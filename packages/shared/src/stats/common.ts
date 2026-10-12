import { toDateKey, type DateKey } from '../dates';
import type { WorkoutExercise } from '../schemas';

/** The subset of a workout the stats functions need (drafts and server copies both fit). */
export interface WorkoutLike {
  id: string;
  startedAt: string;
  exercises: WorkoutExercise[];
  durationMin?: number | null;
  deletedAt?: string | null;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Live (non-deleted) workouts, oldest first; ties broken by id for determinism. */
export function chronological<W extends WorkoutLike>(workouts: Iterable<W>): W[] {
  return [...workouts]
    .filter((w) => !w.deletedAt)
    .sort((a, b) =>
      a.startedAt === b.startedAt ? a.id.localeCompare(b.id) : a.startedAt < b.startedAt ? -1 : 1,
    );
}

export function workoutDay(w: WorkoutLike): DateKey {
  return toDateKey(w.startedAt);
}
