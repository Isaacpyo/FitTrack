import { describe, expect, it } from 'vitest';
import { activeDays, dayStreak, weekStreak, workoutDays } from '../src';
import { workout } from './helpers';

describe('dayStreak', () => {
  it('counts consecutive days ending today', () => {
    const s = dayStreak(['2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-10');
    expect(s).toEqual({ current: 3, longest: 3, activeToday: true });
  });

  it('keeps the streak alive until today is over', () => {
    const s = dayStreak(['2026-10-08', '2026-10-09'], '2026-10-10');
    expect(s.current).toBe(2);
    expect(s.activeToday).toBe(false);
  });

  it('resets after a missed day', () => {
    expect(dayStreak(['2026-10-07', '2026-10-08'], '2026-10-10').current).toBe(0);
  });

  it('finds the longest run and ignores duplicates and future days', () => {
    const days = [
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-03',
      '2026-09-10',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ];
    expect(dayStreak(days, '2026-10-10')).toEqual({ current: 1, longest: 3, activeToday: true });
  });

  it('handles no activity', () => {
    expect(dayStreak([], '2026-10-10')).toEqual({ current: 0, longest: 0, activeToday: false });
  });
});

describe('weekStreak', () => {
  // Weeks start on Mondays: 2026-09-21, 09-28, 10-05.
  const twoPerWeek = ['2026-09-21', '2026-09-23', '2026-09-28', '2026-09-30'];

  it('counts finished weeks while this week is in progress', () => {
    const s = weekStreak([...twoPerWeek, '2026-10-05'], '2026-10-07', 2);
    expect(s).toEqual({ current: 2, longest: 2, thisWeekCount: 1, goalMetThisWeek: false });
  });

  it('includes this week once its goal is met', () => {
    const s = weekStreak([...twoPerWeek, '2026-10-05', '2026-10-06'], '2026-10-07', 2);
    expect(s.current).toBe(3);
    expect(s.goalMetThisWeek).toBe(true);
  });

  it('breaks on a week below goal and remembers the longest run', () => {
    const days = [
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      /* gap week 09-21 */ '2026-09-28',
      '2026-10-05',
    ];
    expect(weekStreak(days, '2026-10-07', 1)).toMatchObject({ current: 2, longest: 3 });
  });
});

describe('activeDays', () => {
  it('combines workout days with days that hit the step goal', () => {
    const days = activeDays(
      [
        workout('2026-10-01', { 'bench-press': [[60, 5]] }),
        workout('2026-10-02', {}, { deletedAt: '2026-10-03T00:00:00Z' }),
      ],
      [
        { date: '2026-10-03', steps: 9000 },
        { date: '2026-10-04', steps: 7999 },
      ],
      8000,
    );
    expect([...days].sort()).toEqual(['2026-10-01', '2026-10-03']);
  });

  it('lists one day per workout for the weekly goal', () => {
    const w = [workout('2026-10-01', {}), workout('2026-10-01', {})];
    expect(workoutDays(w)).toEqual(['2026-10-01', '2026-10-01']);
  });
});
