import { describe, expect, it } from 'vitest';
import {
  activeDays,
  addDays,
  analyzeRecords,
  dayStreak,
  generateDemoData,
  mockDailyActivity,
  routineSchema,
  toDateKey,
  weekStreak,
  workoutDays,
  workoutSchema,
} from '../src';
import { testId } from './helpers';

const today = '2026-10-10';
const generate = () =>
  generateDemoData({
    today,
    utcOffsetMinutes: 0,
    dayFraction: 0.5,
    newId: testId,
    now: '2026-10-10T12:00:00.000Z',
  });

describe('generateDemoData', () => {
  const data = generate();

  it('produces records that pass the API schemas', () => {
    for (const w of data.workouts) expect(workoutSchema.safeParse(w).success).toBe(true);
    for (const r of data.routines) expect(routineSchema.safeParse(r).success).toBe(true);
    expect(data.routines.map((r) => r.name)).toEqual(['Push Day', 'Pull Day', 'Leg Day']);
  });

  it('spans ~10 weeks, ending before today', () => {
    const days = data.workouts.map((w) => toDateKey(w.startedAt)).sort();
    expect(data.workouts.length).toBeGreaterThanOrEqual(25);
    expect(days.at(-1)! < today).toBe(true);
    expect(days[0]! >= addDays(today, -70)).toBe(true);
  });

  it('shows live streaks and recent PRs', () => {
    const days = activeDays(data.workouts, data.activity, 8000);
    expect(dayStreak(days, today).current).toBeGreaterThanOrEqual(10);
    expect(weekStreak(workoutDays(data.workouts), today, 3).current).toBeGreaterThanOrEqual(3);
    const { events } = analyzeRecords(data.workouts);
    expect(events.some((e) => e.date >= addDays(today, -14))).toBe(true);
  });

  it('includes 60 days of activity ending today', () => {
    expect(data.activity).toHaveLength(60);
    expect(data.activity.at(-1)?.date).toBe(today);
  });

  it('is deterministic for a given day', () => {
    const a = generate();
    const b = generate();
    const shape = (d: typeof a) =>
      d.workouts.map((w) => [
        w.startedAt,
        w.exercises.map((e) => e.sets.map((s) => [s.weightKg, s.reps])),
      ]);
    expect(shape(a)).toEqual(shape(b));
  });
});

describe('mockDailyActivity', () => {
  it('is stable per date and never returns future days', () => {
    expect(mockDailyActivity('2026-10-01', { today })).toEqual(
      mockDailyActivity('2026-10-01', { today }),
    );
    expect(mockDailyActivity('2026-10-11', { today })).toBeNull();
  });

  it('scales today by the elapsed share of the day', () => {
    const full = mockDailyActivity(today, { today, dayFraction: 1 })!;
    const half = mockDailyActivity(today, { today, dayFraction: 0.5 })!;
    expect(half.steps).toBe(Math.round(full.steps / 2));
  });
});
