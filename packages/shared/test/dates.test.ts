import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  diffDays,
  formatDateKey,
  instantAt,
  isDateKey,
  isoWeekday,
  startOfWeek,
  toDateKeyAtOffset,
} from '../src';

describe('date keys', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    // 2026-03-29 is the UK DST change; key arithmetic must not drift.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('diffs days', () => {
    expect(diffDays('2026-10-01', '2026-10-10')).toBe(9);
    expect(diffDays('2026-10-10', '2026-10-01')).toBe(-9);
  });

  it('validates real calendar dates only', () => {
    expect(isDateKey('2026-10-10')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-1-5')).toBe(false);
    expect(isDateKey('not-a-date')).toBe(false);
  });

  it('uses Monday-based weeks', () => {
    expect(isoWeekday('2026-10-05')).toBe(0); // Monday
    expect(isoWeekday('2026-10-11')).toBe(6); // Sunday
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05');
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05');
  });

  it('builds inclusive ranges', () => {
    expect(dateRange('2026-10-08', '2026-10-10')).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
    expect(dateRange('2026-10-10', '2026-10-09')).toEqual([]);
  });

  it('converts instants at a fixed UTC offset', () => {
    // 23:30 UTC is already the next day in London summer time (UTC+1).
    expect(toDateKeyAtOffset('2026-07-01T23:30:00Z', 60)).toBe('2026-07-02');
    expect(toDateKeyAtOffset('2026-07-01T23:30:00Z', -300)).toBe('2026-07-01');
    expect(instantAt('2026-07-02', 18, 0, 60)).toBe('2026-07-02T17:00:00.000Z');
  });

  it('formats keys for display', () => {
    expect(formatDateKey('2026-10-10')).toBe('Sat 10 Oct');
  });
});
