import {
  EXERCISES_BY_ID,
  lastPerformance,
  toDateKey,
  workoutInputSchema,
  type Routine,
  type Workout,
  type WorkoutInput,
} from '@fittrack/shared';

/**
 * The workout editor works on a draft with string inputs (so "62." can be typed) that is
 * validated and converted to a WorkoutInput on save. Drafts are persisted, so an in-progress
 * workout survives the app being closed.
 */
export interface DraftSet {
  id: string;
  weightKg: string;
  reps: string;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  sets: DraftSet[];
}

export interface Draft {
  id: string;
  isNew: boolean;
  name: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** Original start instant; its time of day is kept if the date is changed. */
  startedAt: string;
  durationMin: string;
  notes: string;
  routineId: string | null;
  exercises: DraftExercise[];
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

function defaultName(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Morning workout' : h < 17 ? 'Afternoon workout' : 'Evening workout';
}

/** Sets for an exercise, prefilled from the last time it was performed (or the routine targets). */
export function prefillSets(
  exerciseId: string,
  history: Workout[],
  newId: () => string,
  target?: { sets: number; reps: number; weightKg: number | null },
): DraftSet[] {
  const last = lastPerformance(history, exerciseId);
  const count = target?.sets ?? last?.sets.length ?? 3;
  return Array.from({ length: count }, (_, i) => {
    const previous = last?.sets[Math.min(i, last.sets.length - 1)];
    const weight = previous?.weightKg ?? target?.weightKg ?? (EXERCISES_BY_ID.get(exerciseId)?.bodyweight ? 0 : null);
    const reps = target?.reps ?? previous?.reps ?? null;
    return { id: newId(), weightKg: weight === null ? '' : fmt(weight), reps: reps === null ? '' : String(reps) };
  });
}

export function newDraft(opts: {
  id: string;
  now: Date;
  history: Workout[];
  newId: () => string;
  routine?: Routine | null;
}): Draft {
  const { routine, now } = opts;
  return {
    id: opts.id,
    isNew: true,
    name: routine?.name ?? defaultName(now),
    date: toDateKey(now),
    startedAt: now.toISOString(),
    durationMin: '',
    notes: '',
    routineId: routine?.id ?? null,
    exercises: (routine?.exercises ?? []).map((re) => ({
      key: opts.newId(),
      exerciseId: re.exerciseId,
      sets: prefillSets(re.exerciseId, opts.history, opts.newId, {
        sets: re.targetSets,
        reps: re.targetReps,
        weightKg: re.targetWeightKg,
      }),
    })),
  };
}

export function draftFromWorkout(w: Workout, newId: () => string): Draft {
  return {
    id: w.id,
    isNew: false,
    name: w.name,
    date: toDateKey(w.startedAt),
    startedAt: w.startedAt,
    durationMin: w.durationMin === null ? '' : String(w.durationMin),
    notes: w.notes,
    routineId: w.routineId,
    exercises: w.exercises.map((ex) => ({
      key: newId(),
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s) => ({ id: s.id, weightKg: fmt(s.weightKg), reps: String(s.reps) })),
    })),
  };
}

/** Field errors keyed `name`, `date`, `durationMin`, `set:<id>:reps`, `set:<id>:weightKg`, `exercise:<key>`. */
export type DraftErrors = Record<string, string>;

export type DraftResult = { ok: true; workout: WorkoutInput } | { ok: false; message: string; errors: DraftErrors };

function parseNumber(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function combineDateAndTime(date: string, original: string): string | null {
  if (toDateKey(original) === date) return original;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const time = new Date(original);
  const local = new Date(y, m - 1, d, time.getHours(), time.getMinutes(), time.getSeconds());
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

/** Validate a draft with the same Zod schema the API uses, mapping errors back to inputs. */
export function draftToWorkout(draft: Draft, now: Date): DraftResult {
  const errors: DraftErrors = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.date = 'Use the format YYYY-MM-DD';
  else if (draft.date > toDateKey(now)) errors.date = 'Date cannot be in the future';
  const startedAt = errors.date ? null : combineDateAndTime(draft.date, draft.startedAt);
  if (!errors.date && !startedAt) errors.date = 'Not a valid date';

  const duration = parseNumber(draft.durationMin);
  if (duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 1440)) {
    errors.durationMin = 'Minutes between 0 and 1440';
  }

  const exercises = draft.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    sets: ex.sets.map((s) => {
      const reps = parseNumber(s.reps);
      const weight = parseNumber(s.weightKg);
      if (reps === null) errors[`set:${s.id}:reps`] = 'Enter reps';
      else if (Number.isNaN(reps) || !Number.isInteger(reps) || reps < 0 || reps > 1000) {
        errors[`set:${s.id}:reps`] = 'Whole number, 0–1000';
      }
      if (weight !== null && (Number.isNaN(weight) || weight < 0 || weight > 1000)) {
        errors[`set:${s.id}:weightKg`] = '0–1000 kg';
      }
      return { id: s.id, reps: reps ?? 0, weightKg: weight === null || Number.isNaN(weight) ? 0 : weight };
    }),
  }));
  draft.exercises.forEach((ex) => {
    if (ex.sets.length === 0) errors[`exercise:${ex.key}`] = 'Add at least one set';
  });

  const candidate = {
    id: draft.id,
    name: draft.name,
    startedAt: startedAt ?? draft.startedAt,
    durationMin: duration === null || Number.isNaN(duration) ? null : duration,
    notes: draft.notes,
    routineId: draft.routineId,
    exercises,
    updatedAt: now.toISOString(),
  };

  const parsed = workoutInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [first] = issue.path;
      if (first === 'name' && !errors.name) errors.name = issue.message;
      if (first === 'exercises' && issue.path.length === 1 && !errors.exercises) errors.exercises = issue.message;
    }
  }

  const count = Object.keys(errors).length;
  if (count > 0 || !parsed.success) {
    const message =
      errors.exercises ?? (count === 1 ? Object.values(errors)[0]! : `Please fix ${count || 'the'} highlighted fields`);
    return { ok: false, message, errors };
  }
  return { ok: true, workout: parsed.data };
}
