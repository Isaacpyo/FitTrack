import { describe, expect, it } from 'vitest';
import {
  exerciseProgress,
  exerciseUsage,
  lastPerformance,
  periodSummary,
  weeklyVolume,
  workoutSetCount,
  workoutVolume,
} from '../src';
import { workout } from './helpers';

describe('volume', () => {
  const w1 = workout('2026-09-29', {
    'bench-press': [
      [60, 10],
      [60, 8],
    ],
    'pull-up': [[0, 10]],
  });
  const w2 = workout('2026-10-06', { 'bench-press': [[62.5, 8]] }, { durationMin: 45 });
  const w3 = workout(
    '2026-10-08',
    {
      'back-squat': [
        [100, 5],
        [100, 5],
      ],
    },
    { durationMin: null },
  );

  it('sums weight × reps per workout', () => {
    expect(workoutVolume(w1)).toBe(1080);
    expect(workoutSetCount(w1)).toBe(3);
  });

  it('buckets weekly volume, zero-filling empty weeks', () => {
    const weeks = weeklyVolume([w1, w2, w3], '2026-10-10', 4);
    expect(weeks.map((w) => w.weekStart)).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
    ]);
    expect(weeks.map((w) => w.volumeKg)).toEqual([0, 0, 1080, 1500]);
    expect(weeks.map((w) => w.workouts)).toEqual([0, 0, 1, 2]);
  });

  it('builds per-session progress for an exercise', () => {
    const points = exerciseProgress([w2, w1, w3], 'bench-press');
    expect(points).toEqual([
      {
        date: '2026-09-29',
        workoutId: w1.id,
        topWeightKg: 60,
        bestE1rm: 80,
        volumeKg: 1080,
        bestReps: 10,
      },
      {
        date: '2026-10-06',
        workoutId: w2.id,
        topWeightKg: 62.5,
        bestE1rm: 79.2,
        volumeKg: 500,
        bestReps: 8,
      },
    ]);
  });

  it('summarises a period by local day', () => {
    expect(periodSummary([w1, w2, w3], '2026-10-05', '2026-10-11')).toEqual({
      workouts: 2,
      sets: 3,
      volumeKg: 1500,
      minutes: 45,
    });
  });

  it('ranks exercises by how often they are trained', () => {
    expect(exerciseUsage([w1, w2, w3]).map((u) => [u.exerciseId, u.sessions])).toEqual([
      ['bench-press', 2],
      ['back-squat', 1],
      ['pull-up', 1],
    ]);
  });

  it('finds the last performance, optionally skipping the current workout', () => {
    expect(lastPerformance([w1, w2], 'bench-press')?.date).toBe('2026-10-06');
    expect(lastPerformance([w1, w2], 'bench-press', w2.id)?.sets.map((s) => s.weightKg)).toEqual([
      60, 60,
    ]);
    expect(lastPerformance([w1, w2], 'deadlift')).toBeNull();
  });
});
