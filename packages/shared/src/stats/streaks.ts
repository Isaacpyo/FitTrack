import { addDays, diffDays, startOfWeek, type DateKey } from '../dates';
import { chronological, workoutDay, type WorkoutLike } from './common';

export interface DayStreak {
  /** Consecutive active days ending today (or yesterday, if today isn't active yet). */
  current: number;
  longest: number;
  activeToday: boolean;
}

/**
 * Active-day streak. A streak survives until the end of the day after the last active day,
 * so it is not shown as broken first thing in the morning.
 */
export function dayStreak(activeDays: Iterable<DateKey>, today: DateKey): DayStreak {
  const days = new Set([...activeDays].filter((d) => d <= today));
  const activeToday = days.has(today);

  let current = 0;
  for (let d = activeToday ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;

  let longest = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const d of [...days].sort()) {
    run = prev !== null && diffDays(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest, activeToday };
}

export interface WeekStreak {
  /** Consecutive weeks (Mon–Sun) that met the goal; this week counts once its goal is met. */
  current: number;
  longest: number;
  thisWeekCount: number;
  goalMetThisWeek: boolean;
}

/** Weekly workout-goal streak, e.g. "3 workouts a week for 6 weeks". */
export function weekStreak(
  workoutDays: Iterable<DateKey>,
  today: DateKey,
  weeklyGoal: number,
): WeekStreak {
  const goal = Math.max(1, weeklyGoal);
  const perWeek = new Map<DateKey, number>();
  for (const d of workoutDays) {
    if (d > today) continue;
    const w = startOfWeek(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const met = (week: DateKey) => (perWeek.get(week) ?? 0) >= goal;

  const thisWeek = startOfWeek(today);
  const thisWeekCount = perWeek.get(thisWeek) ?? 0;
  const goalMetThisWeek = thisWeekCount >= goal;

  let current = 0;
  for (let w = goalMetThisWeek ? thisWeek : addDays(thisWeek, -7); met(w); w = addDays(w, -7))
    current++;

  let longest = 0;
  let run = 0;
  let prev: DateKey | null = null;
  for (const w of [...perWeek.keys()].filter(met).sort()) {
    run = prev !== null && diffDays(prev, w) === 7 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = w;
  }

  return { current, longest, thisWeekCount, goalMetThisWeek };
}

/** Days with a workout, or with steps at/above the goal. */
export function activeDays(
  workouts: Iterable<WorkoutLike>,
  activity: Iterable<{ date: DateKey; steps: number }>,
  stepGoal: number,
): Set<DateKey> {
  const out = new Set<DateKey>();
  for (const w of chronological(workouts)) out.add(workoutDay(w));
  for (const a of activity) if (a.steps >= stepGoal) out.add(a.date);
  return out;
}

/** One entry per workout (not per day), for the weekly-goal streak. */
export function workoutDays(workouts: Iterable<WorkoutLike>): DateKey[] {
  return chronological(workouts).map(workoutDay);
}
