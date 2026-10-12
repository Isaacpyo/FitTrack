import { describe, expect, it } from 'vitest';
import {
  activityBatchSchema,
  demoLoginSchema,
  loginSchema,
  profileUpdateSchema,
  routineInputSchema,
  signupSchema,
  workoutInputSchema,
} from '../src';

const validWorkout = {
  id: '3f2c1a6e-7b8d-4c9e-a1b2-c3d4e5f60718',
  name: '  Push Day ',
  startedAt: '2026-10-10T18:00:00.000Z',
  durationMin: 55,
  notes: '',
  routineId: null,
  updatedAt: '2026-10-10T19:00:00+01:00',
  exercises: [
    {
      exerciseId: 'bench-press',
      sets: [{ id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d', reps: 5, weightKg: 82.5 }],
    },
  ],
};

describe('workoutInputSchema', () => {
  it('accepts a valid workout and trims the name', () => {
    const parsed = workoutInputSchema.parse(validWorkout);
    expect(parsed.name).toBe('Push Day');
  });

  it.each([
    [
      'unknown exercise',
      { exercises: [{ ...validWorkout.exercises[0], exerciseId: 'moon-press' }] },
    ],
    [
      'negative weight',
      {
        exercises: [
          {
            exerciseId: 'bench-press',
            sets: [{ id: validWorkout.exercises[0]!.sets[0]!.id, reps: 5, weightKg: -1 }],
          },
        ],
      },
    ],
    [
      'fractional reps',
      {
        exercises: [
          {
            exerciseId: 'bench-press',
            sets: [{ id: validWorkout.exercises[0]!.sets[0]!.id, reps: 5.5, weightKg: 50 }],
          },
        ],
      },
    ],
    ['exercise without sets', { exercises: [{ exerciseId: 'bench-press', sets: [] }] }],
    ['no exercises', { exercises: [] }],
    ['blank name', { name: '   ' }],
    ['non-uuid id', { id: 'workout-1' }],
    ['bad timestamp', { startedAt: 'yesterday' }],
  ])('rejects %s', (_label, patch) => {
    expect(workoutInputSchema.safeParse({ ...validWorkout, ...patch }).success).toBe(false);
  });
});

describe('routineInputSchema', () => {
  it('requires sensible targets', () => {
    const base = {
      id: '3f2c1a6e-7b8d-4c9e-a1b2-c3d4e5f60718',
      name: 'Legs',
      notes: '',
      updatedAt: '2026-10-10T19:00:00Z',
      exercises: [{ exerciseId: 'back-squat', targetSets: 4, targetReps: 6, targetWeightKg: 100 }],
    };
    expect(routineInputSchema.safeParse(base).success).toBe(true);
    expect(
      routineInputSchema.safeParse({
        ...base,
        exercises: [{ ...base.exercises[0], targetSets: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe('auth schemas', () => {
  it('normalises email addresses', () => {
    const parsed = signupSchema.parse({
      email: '  Alex@Example.COM ',
      password: 'correct horse',
      displayName: 'Alex',
    });
    expect(parsed.email).toBe('alex@example.com');
  });

  it('enforces password length and email format', () => {
    expect(
      signupSchema.safeParse({ email: 'alex@example.com', password: 'short', displayName: 'A' })
        .success,
    ).toBe(false);
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('bounds the demo time-zone offset', () => {
    expect(demoLoginSchema.safeParse({ today: '2026-10-10', utcOffsetMinutes: 60 }).success).toBe(
      true,
    );
    expect(demoLoginSchema.safeParse({ utcOffsetMinutes: 9999 }).success).toBe(false);
    expect(demoLoginSchema.safeParse({}).success).toBe(true);
  });
});

describe('profile and activity schemas', () => {
  it('rejects empty profile updates', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ stepGoal: 10000 }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ stepGoal: 10 }).success).toBe(false);
  });

  it('validates activity batches', () => {
    const day = {
      date: '2026-10-10',
      steps: 9000,
      activeMinutes: 40,
      energyKcal: 400,
      source: 'mock',
    };
    expect(activityBatchSchema.safeParse({ days: [day] }).success).toBe(true);
    expect(activityBatchSchema.safeParse({ days: [{ ...day, date: '2026-13-01' }] }).success).toBe(
      false,
    );
    expect(activityBatchSchema.safeParse({ days: [{ ...day, source: 'fitbit' }] }).success).toBe(
      false,
    );
  });
});

describe('integrity rules', () => {
  it('rejects duplicate set ids inside one workout', () => {
    const set = validWorkout.exercises[0]!.sets[0]!;
    const dup = {
      ...validWorkout,
      exercises: [{ exerciseId: 'bench-press', sets: [set, { ...set }] }],
    };
    const result = workoutInputSchema.safeParse(dup);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Duplicate set id');
  });

  it('rejects the same day twice in an activity batch', () => {
    const day = {
      date: '2026-10-10',
      steps: 9000,
      activeMinutes: 40,
      energyKcal: 400,
      source: 'mock',
    };
    expect(activityBatchSchema.safeParse({ days: [day, day] }).success).toBe(false);
  });
});
