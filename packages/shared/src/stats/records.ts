import type { DateKey } from '../dates';
import { EXERCISES_BY_ID } from '../exercises';
import { chronological, round1, workoutDay, type WorkoutLike } from './common';

/** Rep counts above this give unreliable one-rep-max estimates, so they are ignored. */
export const MAX_REPS_FOR_E1RM = 12;

/** Epley estimate of a one-rep max, rounded to 0.1 kg. Null when it is not meaningful. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (reps < 1 || weightKg <= 0 || reps > MAX_REPS_FOR_E1RM) return null;
  if (reps === 1) return round1(weightKg);
  return round1(weightKg * (1 + reps / 30));
}

export type RecordKind = 'weight' | 'e1rm' | 'volume' | 'reps';

export const RECORD_LABELS: Record<RecordKind, string> = {
  weight: 'Heaviest weight',
  e1rm: 'Best est. 1RM',
  volume: 'Best set volume',
  reps: 'Most reps',
};

export interface RecordEntry {
  value: number;
  weightKg: number;
  reps: number;
  workoutId: string;
  date: DateKey;
}

export interface ExerciseRecords {
  exerciseId: string;
  records: Partial<Record<RecordKind, RecordEntry>>;
  sessions: number;
  lastPerformed: DateKey;
}

export interface RecordEvent {
  workoutId: string;
  exerciseId: string;
  kind: RecordKind;
  value: number;
  previous: number;
  date: DateKey;
}

/**
 * Which records make sense for an exercise: load-based records for weighted lifts,
 * rep records (plus any added load) for bodyweight movements.
 */
export function recordKindsFor(exerciseId: string): RecordKind[] {
  return EXERCISES_BY_ID.get(exerciseId)?.bodyweight
    ? ['reps', 'weight']
    : ['weight', 'e1rm', 'volume'];
}

function candidateValue(kind: RecordKind, weightKg: number, reps: number): number | null {
  switch (kind) {
    case 'weight':
      return reps >= 1 && weightKg > 0 ? weightKg : null;
    case 'e1rm':
      return estimateOneRepMax(weightKg, reps);
    case 'volume':
      return reps >= 1 && weightKg > 0 ? round1(weightKg * reps) : null;
    case 'reps':
      return reps >= 1 ? reps : null;
  }
}

type SetLike = { weightKg: number; reps: number };

/** An exercise may appear more than once in a workout; merge its sets. */
function setsByExercise(workout: WorkoutLike): Map<string, SetLike[]> {
  const out = new Map<string, SetLike[]>();
  for (const ex of workout.exercises) {
    const list = out.get(ex.exerciseId) ?? [];
    list.push(...ex.sets);
    out.set(ex.exerciseId, list);
  }
  return out;
}

function bestOf(
  kind: RecordKind,
  sets: SetLike[],
  workoutId: string,
  date: DateKey,
): RecordEntry | null {
  let best: RecordEntry | null = null;
  for (const set of sets) {
    const value = candidateValue(kind, set.weightKg, set.reps);
    if (value !== null && (best === null || value > best.value)) {
      best = { value, weightKg: set.weightKg, reps: set.reps, workoutId, date };
    }
  }
  return best;
}

/**
 * Replays history oldest-first and returns the current records per exercise plus every
 * moment a record was broken. The first time an exercise is performed establishes a
 * baseline and is not reported as a PR; equalling a record does not count either.
 */
export function analyzeRecords(workouts: Iterable<WorkoutLike>): {
  records: Map<string, ExerciseRecords>;
  events: RecordEvent[];
} {
  const records = new Map<string, ExerciseRecords>();
  const events: RecordEvent[] = [];

  for (const workout of chronological(workouts)) {
    const date = workoutDay(workout);
    for (const [exerciseId, sets] of setsByExercise(workout)) {
      const existing = records.get(exerciseId);
      const entry: ExerciseRecords = existing ?? {
        exerciseId,
        records: {},
        sessions: 0,
        lastPerformed: date,
      };

      for (const kind of recordKindsFor(exerciseId)) {
        const best = bestOf(kind, sets, workout.id, date);
        if (!best) continue;
        const previous = entry.records[kind];
        if (previous && best.value > previous.value) {
          events.push({
            workoutId: workout.id,
            exerciseId,
            kind,
            value: best.value,
            previous: previous.value,
            date,
          });
        }
        if (!previous || best.value > previous.value) entry.records[kind] = best;
      }

      entry.sessions += 1;
      entry.lastPerformed = date;
      records.set(exerciseId, entry);
    }
  }

  return { records, events };
}

/** Records grouped by workout, for "2 PRs" badges in history. */
export function recordEventsByWorkout(events: RecordEvent[]): Map<string, RecordEvent[]> {
  const out = new Map<string, RecordEvent[]>();
  for (const e of events) {
    const list = out.get(e.workoutId) ?? [];
    list.push(e);
    out.set(e.workoutId, list);
  }
  return out;
}

/**
 * PRs a workout sets against every *other* workout in history — used to celebrate a
 * workout as it is saved (it may be a back-dated or edited one).
 */
export function detectNewRecords(
  history: Iterable<WorkoutLike>,
  workout: WorkoutLike,
): RecordEvent[] {
  const { records } = analyzeRecords([...history].filter((w) => w.id !== workout.id));
  const date = workoutDay(workout);
  const events: RecordEvent[] = [];
  for (const [exerciseId, sets] of setsByExercise(workout)) {
    const existing = records.get(exerciseId);
    if (!existing) continue;
    for (const kind of recordKindsFor(exerciseId)) {
      const best = bestOf(kind, sets, workout.id, date);
      const previous = existing.records[kind];
      if (best && previous && best.value > previous.value) {
        events.push({
          workoutId: workout.id,
          exerciseId,
          kind,
          value: best.value,
          previous: previous.value,
          date,
        });
      }
    }
  }
  return events;
}

const HEADLINE_PRIORITY: RecordKind[] = ['weight', 'e1rm', 'reps', 'volume'];

/**
 * One record per exercise per workout — the most meaningful kind (heaviest weight, then
 * estimated 1RM, reps, volume) — so a progressive session reads "3 PRs", not "9".
 */
export function headlineRecords(events: RecordEvent[]): RecordEvent[] {
  const best = new Map<string, RecordEvent>();
  for (const e of events) {
    const key = `${e.workoutId}:${e.exerciseId}`;
    const current = best.get(key);
    if (!current || HEADLINE_PRIORITY.indexOf(e.kind) < HEADLINE_PRIORITY.indexOf(current.kind))
      best.set(key, e);
  }
  return events.filter((e) => best.get(`${e.workoutId}:${e.exerciseId}`) === e);
}
