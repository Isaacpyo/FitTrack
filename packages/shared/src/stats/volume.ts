import { addDays, startOfWeek, type DateKey } from '../dates';
import type { WorkoutSet } from '../schemas';
import { chronological, round1, workoutDay, type WorkoutLike } from './common';
import { estimateOneRepMax } from './records';

export function workoutVolume(w: WorkoutLike): number {
  let total = 0;
  for (const ex of w.exercises) for (const s of ex.sets) total += s.weightKg * s.reps;
  return round1(total);
}

export function workoutSetCount(w: WorkoutLike): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
}

export interface WeekVolume {
  weekStart: DateKey;
  volumeKg: number;
  workouts: number;
}

/** Total lifted volume per week for the last `weeks` weeks (oldest first, zero-filled). */
export function weeklyVolume(
  workouts: Iterable<WorkoutLike>,
  today: DateKey,
  weeks = 12,
): WeekVolume[] {
  const thisWeek = startOfWeek(today);
  const buckets = new Map<DateKey, WeekVolume>();
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(thisWeek, -7 * i);
    buckets.set(weekStart, { weekStart, volumeKg: 0, workouts: 0 });
  }
  for (const w of chronological(workouts)) {
    const bucket = buckets.get(startOfWeek(workoutDay(w)));
    if (!bucket) continue;
    bucket.volumeKg = round1(bucket.volumeKg + workoutVolume(w));
    bucket.workouts += 1;
  }
  return [...buckets.values()];
}

export interface ProgressPoint {
  date: DateKey;
  workoutId: string;
  topWeightKg: number;
  bestE1rm: number | null;
  volumeKg: number;
  bestReps: number;
}

/** Per-session progress for one exercise, oldest first. */
export function exerciseProgress(
  workouts: Iterable<WorkoutLike>,
  exerciseId: string,
): ProgressPoint[] {
  const points: ProgressPoint[] = [];
  for (const w of chronological(workouts)) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets);
    if (sets.length === 0) continue;
    let topWeightKg = 0;
    let bestE1rm: number | null = null;
    let volumeKg = 0;
    let bestReps = 0;
    for (const s of sets) {
      topWeightKg = Math.max(topWeightKg, s.reps > 0 ? s.weightKg : 0);
      const e = estimateOneRepMax(s.weightKg, s.reps);
      if (e !== null && (bestE1rm === null || e > bestE1rm)) bestE1rm = e;
      volumeKg += s.weightKg * s.reps;
      bestReps = Math.max(bestReps, s.reps);
    }
    points.push({
      date: workoutDay(w),
      workoutId: w.id,
      topWeightKg,
      bestE1rm,
      volumeKg: round1(volumeKg),
      bestReps,
    });
  }
  return points;
}

export interface PeriodSummary {
  workouts: number;
  sets: number;
  volumeKg: number;
  minutes: number;
}

/** Totals for workouts whose local day falls within [from, to]. */
export function periodSummary(
  workouts: Iterable<WorkoutLike>,
  from: DateKey,
  to: DateKey,
): PeriodSummary {
  const out: PeriodSummary = { workouts: 0, sets: 0, volumeKg: 0, minutes: 0 };
  for (const w of chronological(workouts)) {
    const day = workoutDay(w);
    if (day < from || day > to) continue;
    out.workouts += 1;
    out.sets += workoutSetCount(w);
    out.volumeKg = round1(out.volumeKg + workoutVolume(w));
    out.minutes += w.durationMin ?? 0;
  }
  return out;
}

export interface ExerciseUsage {
  exerciseId: string;
  sessions: number;
  lastDate: DateKey;
}

/** Exercises the user has logged, most frequent first. */
export function exerciseUsage(workouts: Iterable<WorkoutLike>): ExerciseUsage[] {
  const map = new Map<string, ExerciseUsage>();
  for (const w of chronological(workouts)) {
    const day = workoutDay(w);
    for (const id of new Set(w.exercises.map((e) => e.exerciseId))) {
      const u = map.get(id) ?? { exerciseId: id, sessions: 0, lastDate: day };
      u.sessions += 1;
      u.lastDate = day;
      map.set(id, u);
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.sessions - a.sessions ||
      b.lastDate.localeCompare(a.lastDate) ||
      a.exerciseId.localeCompare(b.exerciseId),
  );
}

/** The most recent sets logged for an exercise, for "last time" hints and prefilling. */
export function lastPerformance(
  workouts: Iterable<WorkoutLike>,
  exerciseId: string,
  excludeWorkoutId?: string,
): { date: DateKey; sets: WorkoutSet[] } | null {
  const list = chronological(workouts);
  for (let i = list.length - 1; i >= 0; i--) {
    const w = list[i]!;
    if (w.id === excludeWorkoutId) continue;
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets);
    if (sets.length > 0) return { date: workoutDay(w), sets };
  }
  return null;
}
