import { z } from 'zod';
import { isDateKey } from './dates';
import { isExerciseId } from './exercises';

/**
 * Wire contract between the app and the API. Every request body is parsed with these
 * schemas on the server, and the app validates drafts with the same rules before saving.
 */

export const LIMITS = {
  maxWeightKg: 1000,
  maxReps: 1000,
  maxSetsPerExercise: 50,
  maxExercisesPerWorkout: 40,
  maxExercisesPerRoutine: 30,
  maxActivityDaysPerBatch: 92,
  maxSyncBatch: 500,
} as const;

const isoDateTime = z.iso.datetime({ offset: true });

export const dateKeySchema = z.string().refine(isDateKey, 'Must be a calendar date (YYYY-MM-DD)');

export const exerciseIdSchema = z.string().refine(isExerciseId, 'Unknown exercise');

// ---------------------------------------------------------------- workouts

export const workoutSetSchema = z.object({
  id: z.uuid(),
  reps: z
    .number()
    .int('Reps must be a whole number')
    .min(0, 'Reps cannot be negative')
    .max(LIMITS.maxReps, `Reps must be at most ${LIMITS.maxReps}`),
  weightKg: z
    .number()
    .min(0, 'Weight cannot be negative')
    .max(LIMITS.maxWeightKg, `Weight must be at most ${LIMITS.maxWeightKg} kg`),
});

export const workoutExerciseSchema = z.object({
  exerciseId: exerciseIdSchema,
  sets: z.array(workoutSetSchema).min(1, 'Add at least one set').max(LIMITS.maxSetsPerExercise),
});

const workoutFields = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Give the workout a name').max(80),
  startedAt: isoDateTime,
  durationMin: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .nullable(),
  notes: z.string().max(2000),
  routineId: z.uuid().nullable(),
  exercises: z
    .array(workoutExerciseSchema)
    .min(1, 'Add at least one exercise')
    .max(LIMITS.maxExercisesPerWorkout),
  updatedAt: isoDateTime,
});

/** Body of PUT /workouts/:id — the full workout document, last-write-wins on `updatedAt`. */
export const workoutInputSchema = workoutFields.superRefine((w, ctx) => {
  const seen = new Set<string>();
  w.exercises.forEach((ex, i) =>
    ex.sets.forEach((set, j) => {
      if (seen.has(set.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises', i, 'sets', j, 'id'],
          message: 'Duplicate set id',
        });
      }
      seen.add(set.id);
    }),
  );
});

export const workoutSchema = workoutFields.extend({
  /** Tombstone: set when the workout was deleted (propagates deletes through sync). */
  deletedAt: isoDateTime.nullable(),
});

export type WorkoutSet = z.infer<typeof workoutSetSchema>;
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;
export type WorkoutInput = z.infer<typeof workoutInputSchema>;
export type Workout = z.infer<typeof workoutSchema>;

// ---------------------------------------------------------------- routines

export const routineExerciseSchema = z.object({
  exerciseId: exerciseIdSchema,
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(100),
  targetWeightKg: z.number().min(0).max(LIMITS.maxWeightKg).nullable(),
});

export const routineInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Give the routine a name').max(60),
  notes: z.string().max(1000),
  exercises: z
    .array(routineExerciseSchema)
    .min(1, 'Add at least one exercise')
    .max(LIMITS.maxExercisesPerRoutine),
  updatedAt: isoDateTime,
});

export const routineSchema = routineInputSchema.extend({
  deletedAt: isoDateTime.nullable(),
});

export type RoutineExercise = z.infer<typeof routineExerciseSchema>;
export type RoutineInput = z.infer<typeof routineInputSchema>;
export type Routine = z.infer<typeof routineSchema>;

// ---------------------------------------------------------------- activity (health data)

export const activitySourceSchema = z.enum(['healthkit', 'health_connect', 'mock', 'manual']);

export const dailyActivitySchema = z.object({
  date: dateKeySchema,
  steps: z.number().int().min(0).max(200_000),
  activeMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  energyKcal: z.number().int().min(0).max(20_000),
  source: activitySourceSchema,
});

export const activityBatchSchema = z.object({
  days: z
    .array(dailyActivitySchema)
    .min(1)
    .max(LIMITS.maxActivityDaysPerBatch)
    .refine(
      (days) => new Set(days.map((d) => d.date)).size === days.length,
      'Each day may appear only once',
    ),
});

export type ActivitySource = z.infer<typeof activitySourceSchema>;
export type DailyActivity = z.infer<typeof dailyActivitySchema>;

// ---------------------------------------------------------------- auth & profile

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

export const signupSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z.string().trim().min(1, 'Tell us your name').max(50),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});

export const demoLoginSchema = z.object({
  /** Visitor's local calendar day, so demo data lines up with their "today". */
  today: dateKeySchema.optional(),
  /** Minutes east of UTC (i.e. `-new Date().getTimezoneOffset()`). */
  utcOffsetMinutes: z
    .number()
    .int()
    .min(-14 * 60)
    .max(14 * 60)
    .optional(),
});

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50),
    stepGoal: z.number().int().min(1000).max(100_000),
    weeklyWorkoutGoal: z.number().int().min(1).max(14),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  stepGoal: z.number().int(),
  weeklyWorkoutGoal: z.number().int(),
  isDemo: z.boolean(),
  createdAt: isoDateTime,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DemoLoginInput = z.infer<typeof demoLoginSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type User = z.infer<typeof userSchema>;

export interface AuthResponse {
  token: string;
  user: User;
}

// ---------------------------------------------------------------- sync

export const syncChangesQuerySchema = z.object({
  since: isoDateTime.optional(),
});

export interface SyncChangesResponse {
  /** Pass back as `since` on the next pull. */
  serverTime: string;
  workouts: Workout[];
  routines: Routine[];
  activity: DailyActivity[];
}

/** Result of an idempotent upsert: `applied: false` means a newer copy already existed. */
export interface UpsertResult<T> {
  applied: boolean;
  item: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}
