import { randomUUID } from 'node:crypto';
import type { User, Workout, WorkoutInput } from '@fittrack/shared';

export const user: User = {
  id: '6a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  email: 'sam@example.com',
  displayName: 'Sam',
  stepGoal: 8000,
  weeklyWorkoutGoal: 3,
  isDemo: false,
  createdAt: '2026-09-01T00:00:00.000Z',
};

export function workoutInput(
  id: string = randomUUID(),
  overrides: Partial<WorkoutInput> = {},
): WorkoutInput {
  return {
    id,
    name: 'Push Day',
    startedAt: '2026-10-09T18:00:00.000Z',
    durationMin: 60,
    notes: '',
    routineId: null,
    updatedAt: '2026-10-09T19:00:00.000Z',
    exercises: [{ exerciseId: 'bench-press', sets: [{ id: randomUUID(), reps: 5, weightKg: 80 }] }],
    ...overrides,
  };
}

export function workout(id?: string, overrides: Partial<Workout> = {}): Workout {
  return { ...workoutInput(id), deletedAt: null, ...overrides };
}
