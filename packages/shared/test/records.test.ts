import { describe, expect, it } from 'vitest';
import { analyzeRecords, detectNewRecords, estimateOneRepMax, recordEventsByWorkout } from '../src';
import { workout } from './helpers';

describe('estimateOneRepMax', () => {
  it('uses the Epley formula', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(estimateOneRepMax(60, 10)).toBe(80);
  });

  it('ignores sets where an estimate is meaningless', () => {
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(0, 10)).toBeNull();
    expect(estimateOneRepMax(40, 20)).toBeNull();
  });
});

describe('analyzeRecords', () => {
  it('treats the first session as a baseline, not a PR', () => {
    const w1 = workout('2026-09-01', {
      'bench-press': [
        [80, 5],
        [80, 5],
      ],
    });
    const { records, events } = analyzeRecords([w1]);
    expect(events).toEqual([]);
    expect(records.get('bench-press')?.records.weight?.value).toBe(80);
    expect(records.get('bench-press')?.sessions).toBe(1);
  });

  it('reports each kind of record broken, in chronological order', () => {
    const w1 = workout('2026-09-01', { 'bench-press': [[80, 5]] });
    const w2 = workout('2026-09-08', { 'bench-press': [[82.5, 5]] }); // weight, e1rm, volume
    const w3 = workout('2026-09-15', { 'bench-press': [[80, 8]] }); // e1rm + volume only
    // Pass out of order to prove sorting.
    const { events, records } = analyzeRecords([w3, w1, w2]);

    expect(
      events
        .filter((e) => e.workoutId === w2.id)
        .map((e) => e.kind)
        .sort(),
    ).toEqual(['e1rm', 'volume', 'weight']);
    expect(
      events
        .filter((e) => e.workoutId === w3.id)
        .map((e) => e.kind)
        .sort(),
    ).toEqual(['e1rm', 'volume']);
    expect(records.get('bench-press')?.records.weight).toMatchObject({
      value: 82.5,
      workoutId: w2.id,
    });
    expect(records.get('bench-press')?.records.e1rm?.value).toBe(101.3);
    expect(records.get('bench-press')?.lastPerformed).toBe('2026-09-15');
  });

  it('does not count equalling a record', () => {
    const w1 = workout('2026-09-01', { 'back-squat': [[100, 5]] });
    const w2 = workout('2026-09-03', { 'back-squat': [[100, 5]] });
    expect(analyzeRecords([w1, w2]).events).toEqual([]);
  });

  it('ignores deleted workouts', () => {
    const w1 = workout('2026-09-01', { deadlift: [[140, 3]] });
    const deleted = workout(
      '2026-09-02',
      { deadlift: [[200, 3]] },
      { deletedAt: '2026-09-03T00:00:00.000Z' },
    );
    const w3 = workout('2026-09-04', { deadlift: [[150, 3]] });
    const { events, records } = analyzeRecords([w1, deleted, w3]);
    expect(records.get('deadlift')?.records.weight?.value).toBe(150);
    expect(events.find((e) => e.kind === 'weight')).toMatchObject({ previous: 140, value: 150 });
  });

  it('tracks rep records for bodyweight movements', () => {
    const w1 = workout('2026-09-01', {
      'pull-up': [
        [0, 8],
        [0, 7],
      ],
    });
    const w2 = workout('2026-09-05', { 'pull-up': [[0, 10]] });
    const { events, records } = analyzeRecords([w1, w2]);
    expect(events).toEqual([expect.objectContaining({ kind: 'reps', value: 10, previous: 8 })]);
    expect(records.get('pull-up')?.records.e1rm).toBeUndefined();
  });

  it('merges an exercise that appears twice in one workout', () => {
    const w1 = workout('2026-09-01', { 'bench-press': [[80, 5]] });
    const w2 = workout('2026-09-02', {});
    w2.exercises = [
      { exerciseId: 'bench-press', sets: [{ id: 'a', weightKg: 70, reps: 5 }] },
      { exerciseId: 'bench-press', sets: [{ id: 'b', weightKg: 85, reps: 3 }] },
    ];
    const { records, events } = analyzeRecords([w1, w2]);
    expect(records.get('bench-press')?.sessions).toBe(2);
    expect(
      recordEventsByWorkout(events)
        .get(w2.id)
        ?.map((e) => e.kind),
    ).toContain('weight');
  });
});

describe('detectNewRecords', () => {
  it('compares a workout with all other history, including later sessions', () => {
    const history = [
      workout('2026-09-01', { 'bench-press': [[80, 5]] }),
      workout('2026-09-10', { 'bench-press': [[90, 5]] }),
    ];
    const backDated = workout('2026-09-05', { 'bench-press': [[85, 5]] });
    expect(detectNewRecords(history, backDated)).toEqual([]);

    const heavier = workout('2026-09-12', { 'bench-press': [[92.5, 3]] });
    expect(detectNewRecords(history, heavier).map((e) => e.kind)).toEqual(['weight']);
  });

  it('ignores the stored copy of the workout being edited', () => {
    const original = workout('2026-09-01', { 'bench-press': [[100, 5]] });
    const other = workout('2026-08-25', { 'bench-press': [[90, 5]] });
    const edited = {
      ...original,
      exercises: [{ exerciseId: 'bench-press', sets: [{ id: 'x', weightKg: 95, reps: 5 }] }],
    };
    expect(
      detectNewRecords([other, original], edited)
        .map((e) => e.kind)
        .sort(),
    ).toEqual(['e1rm', 'volume', 'weight']);
  });

  it('returns nothing for a first-ever exercise', () => {
    expect(detectNewRecords([], workout('2026-09-01', { deadlift: [[100, 5]] }))).toEqual([]);
  });
});
