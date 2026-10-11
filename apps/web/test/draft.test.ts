import { randomUUID } from 'node:crypto';
import type { Routine } from '@fittrack/shared';
import { describe, expect, it } from 'vitest';
import { draftFromWorkout, draftToWorkout, newDraft, prefillSets, type Draft } from '../src/store/draft';
import { workout } from './fixtures';

const now = new Date('2026-10-10T17:30:00.000Z');

const routine: Routine = {
  id: randomUUID(),
  name: 'Push Day',
  notes: '',
  updatedAt: now.toISOString(),
  deletedAt: null,
  exercises: [
    { exerciseId: 'bench-press', targetSets: 3, targetReps: 8, targetWeightKg: 60 },
    { exerciseId: 'push-up', targetSets: 2, targetReps: 15, targetWeightKg: null },
  ],
};

describe('newDraft', () => {
  it('prefills routine exercises, preferring the weight used last time', () => {
    const history = [workout(undefined, { exercises: [{ exerciseId: 'bench-press', sets: [{ id: 'x', reps: 6, weightKg: 72.5 }] }] })];
    const d = newDraft({ id: randomUUID(), now, history, newId: randomUUID, routine });
    expect(d.name).toBe('Push Day');
    expect(d.routineId).toBe(routine.id);
    expect(d.exercises.map((e) => e.sets.length)).toEqual([3, 2]);
    expect(d.exercises[0]!.sets[0]).toMatchObject({ weightKg: '72.5', reps: '8' });
    expect(d.exercises[1]!.sets[0]).toMatchObject({ weightKg: '0', reps: '15' });
  });

  it('starts a never-logged exercise with a single blank set', () => {
    expect(prefillSets('deadlift', [], randomUUID)).toEqual([{ id: expect.any(String), weightKg: '', reps: '' }]);
    expect(prefillSets('pull-up', [], randomUUID)[0]).toMatchObject({ weightKg: '0' });
  });

  it('names an empty workout after the time of day', () => {
    expect(newDraft({ id: randomUUID(), now, history: [], newId: randomUUID }).name).toBe('Evening workout');
  });
});

describe('draftToWorkout', () => {
  const base = (): Draft => ({
    ...draftFromWorkout(workout(), randomUUID),
    durationMin: '55',
  });

  it('converts strings to numbers, accepting decimal commas and blank weights', () => {
    const d = base();
    d.exercises[0]!.sets = [
      { id: randomUUID(), weightKg: '82,5', reps: '5' },
      { id: randomUUID(), weightKg: '', reps: '12' },
    ];
    const r = draftToWorkout(d, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.workout.exercises[0]!.sets.map((s) => s.weightKg)).toEqual([82.5, 0]);
      expect(r.workout.durationMin).toBe(55);
      expect(r.workout.updatedAt).toBe(now.toISOString());
    }
  });

  it('reports field errors keyed by set id', () => {
    const d = base();
    const setId = d.exercises[0]!.sets[0]!.id;
    d.exercises[0]!.sets[0]!.reps = '';
    d.exercises[0]!.sets[0]!.weightKg = '-5';
    const r = draftToWorkout(d, now);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[`set:${setId}:reps`]).toBe('Enter reps');
      expect(r.errors[`set:${setId}:weightKg`]).toBe('0–1000 kg');
    }
  });

  it('rejects future dates, bad durations, blank names and empty workouts', () => {
    const d = { ...base(), date: '2026-10-11', durationMin: '9.5', name: ' ' };
    const r = draftToWorkout(d, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['date', 'durationMin', 'name']);

    const empty = draftToWorkout({ ...base(), exercises: [] }, now);
    expect(empty).toMatchObject({ ok: false, message: 'Add at least one exercise' });
  });

  it('keeps the time of day when the date is changed', () => {
    const d = { ...base(), date: '2026-10-01' };
    const r = draftToWorkout(d, now);
    expect(r.ok && r.workout.startedAt).toBe('2026-10-01T18:00:00.000Z');
  });
});
