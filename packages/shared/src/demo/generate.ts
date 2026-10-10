import {
  addDays,
  dateRange,
  diffDays,
  instantAt,
  isoWeekday,
  startOfWeek,
  type DateKey,
} from '../dates';
import type { DailyActivity, Routine, RoutineExercise, Workout, WorkoutExercise } from '../schemas';
import { mockDailyActivity } from './activity';
import { hashString, mulberry32 } from './random';

interface Progression {
  /** Working weight in the first demo week (kg); 0 for bodyweight. */
  startKg: number;
  /** Average kg added per week. */
  weeklyGainKg: number;
  /** Reps added every two weeks (bodyweight movements progress by reps). */
  repGainPerTwoWeeks?: number;
}

const PROGRESSION: Record<string, Progression> = {
  'bench-press': { startKg: 60, weeklyGainKg: 1.25 },
  'overhead-press': { startKg: 37.5, weeklyGainKg: 0.75 },
  'incline-dumbbell-press': { startKg: 20, weeklyGainKg: 0.5 },
  'triceps-pushdown': { startKg: 25, weeklyGainKg: 0.5 },
  'lateral-raise': { startKg: 8, weeklyGainKg: 0.25 },
  deadlift: { startKg: 110, weeklyGainKg: 2.5 },
  'barbell-row': { startKg: 55, weeklyGainKg: 1.25 },
  'pull-up': { startKg: 0, weeklyGainKg: 0, repGainPerTwoWeeks: 1 },
  'lat-pulldown': { startKg: 50, weeklyGainKg: 1 },
  'dumbbell-curl': { startKg: 12, weeklyGainKg: 0.25 },
  'back-squat': { startKg: 85, weeklyGainKg: 2.5 },
  'romanian-deadlift': { startKg: 70, weeklyGainKg: 1.5 },
  'leg-press': { startKg: 140, weeklyGainKg: 5 },
  'leg-curl': { startKg: 35, weeklyGainKg: 0.75 },
  'calf-raise': { startKg: 60, weeklyGainKg: 1.25 },
};

const ROUTINE_TEMPLATES: { name: string; notes: string; exercises: [string, number, number][] }[] =
  [
    {
      name: 'Push Day',
      notes: 'Chest, shoulders and triceps. Rest 2–3 min on the big lifts.',
      exercises: [
        ['bench-press', 4, 6],
        ['overhead-press', 3, 8],
        ['incline-dumbbell-press', 3, 10],
        ['triceps-pushdown', 3, 12],
        ['lateral-raise', 3, 15],
      ],
    },
    {
      name: 'Pull Day',
      notes: 'Back and biceps. Keep the deadlift sets crisp.',
      exercises: [
        ['deadlift', 3, 5],
        ['barbell-row', 4, 8],
        ['pull-up', 3, 8],
        ['lat-pulldown', 3, 10],
        ['dumbbell-curl', 3, 12],
      ],
    },
    {
      name: 'Leg Day',
      notes: 'Squat first while fresh.',
      exercises: [
        ['back-squat', 4, 6],
        ['romanian-deadlift', 3, 8],
        ['leg-press', 3, 10],
        ['leg-curl', 3, 12],
        ['calf-raise', 4, 12],
      ],
    },
  ];

/** Monday = push, Wednesday = pull, Friday = legs; a bonus push session on alternate Saturdays. */
const SCHEDULE: Record<number, number> = { 0: 0, 2: 1, 4: 2 };

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function currentWorkingWeight(exerciseId: string, weeks: number): number | null {
  const p = PROGRESSION[exerciseId];
  return p && p.startKg > 0 ? roundTo(p.startKg + p.weeklyGainKg * weeks, 2.5) : null;
}

export interface DemoDataOptions {
  /** Visitor's local calendar day. */
  today: DateKey;
  /** Minutes east of UTC for the visitor, used to place sessions at sensible local times. */
  utcOffsetMinutes: number;
  /** Share of today already elapsed (0..1), so today's step count is realistic. */
  dayFraction: number;
  newId: () => string;
  /** Timestamp to stamp as `updatedAt`. */
  now: string;
  weeks?: number;
}

export interface DemoData {
  routines: Routine[];
  workouts: Workout[];
  activity: DailyActivity[];
}

/**
 * Builds a believable training history relative to `today`: three routines, ~10 weeks of
 * progressive-overload sessions (with one light week so streaks and PRs have some texture)
 * and 60 days of step data.
 */
export function generateDemoData(opts: DemoDataOptions): DemoData {
  const weeks = opts.weeks ?? 10;
  const rand = mulberry32(hashString(`demo:${opts.today}`));

  const routines: Routine[] = ROUTINE_TEMPLATES.map((t) => ({
    id: opts.newId(),
    name: t.name,
    notes: t.notes,
    exercises: t.exercises.map(([exerciseId, targetSets, targetReps]): RoutineExercise => ({
      exerciseId,
      targetSets,
      targetReps,
      targetWeightKg: currentWorkingWeight(exerciseId, weeks),
    })),
    updatedAt: opts.now,
    deletedAt: null,
  }));

  const firstMonday = addDays(startOfWeek(opts.today), -7 * (weeks - 1));
  const lightWeek = weeks - 7;
  const workouts: Workout[] = [];

  // Sessions are logged up to yesterday; today is left for the visitor to log.
  for (const day of dateRange(firstMonday, addDays(opts.today, -1))) {
    const weekIndex = Math.floor(diffDays(firstMonday, day) / 7);
    const isoDay = isoWeekday(day);

    let templateIndex = SCHEDULE[isoDay];
    if (templateIndex === undefined && isoDay === 5 && weekIndex % 2 === 1) templateIndex = 0;
    if (templateIndex === undefined) continue;
    if (weekIndex === lightWeek && isoDay !== 0) continue; // one light week: a single session

    const template = ROUTINE_TEMPLATES[templateIndex]!;
    const routine = routines[templateIndex]!;
    const exercises: WorkoutExercise[] = template.exercises.map(
      ([exerciseId, targetSets, targetReps]) => {
        const p = PROGRESSION[exerciseId]!;
        const weightKg =
          p.startKg === 0
            ? 0
            : roundTo(
                p.startKg + p.weeklyGainKg * weekIndex + (rand() - 0.5) * p.weeklyGainKg,
                2.5,
              );
        const baseReps = targetReps + Math.floor((weekIndex / 2) * (p.repGainPerTwoWeeks ?? 0));
        return {
          exerciseId,
          sets: Array.from({ length: targetSets }, (_, i) => ({
            id: opts.newId(),
            weightKg,
            // The last set of the session tends to fall a rep or two short.
            reps: Math.max(1, i === targetSets - 1 ? baseReps - Math.floor(rand() * 3) : baseReps),
          })),
        };
      },
    );

    const hour = isoDay === 5 ? 10 : 18;
    workouts.push({
      id: opts.newId(),
      name: template.name,
      startedAt: instantAt(day, hour, Math.floor(rand() * 45), opts.utcOffsetMinutes),
      durationMin: 45 + Math.floor(rand() * 30),
      notes:
        weekIndex === lightWeek
          ? 'Light week — travelling.'
          : rand() < 0.15
            ? 'Felt strong today.'
            : '',
      routineId: routine.id,
      exercises,
      updatedAt: opts.now,
      deletedAt: null,
    });
  }

  const activity = dateRange(addDays(opts.today, -59), opts.today)
    .map((d) => mockDailyActivity(d, { today: opts.today, dayFraction: opts.dayFraction }))
    .filter((a): a is DailyActivity => a !== null);

  return { routines, workouts, activity };
}
