import { createSelector } from '@reduxjs/toolkit';
import {
  activeDays,
  analyzeRecords,
  dayStreak,
  exerciseUsage,
  headlineRecords,
  recordEventsByWorkout,
  weekStreak,
  workoutDays,
  type DailyActivity,
} from '@fittrack/shared';
import { pendingKeys } from './outbox';
import type { RootState } from './rootReducer';
import { routinesAdapter } from './routinesSlice';
import { workoutsAdapter } from './workoutsSlice';

export const { selectAll: selectWorkouts, selectById: selectWorkoutById } =
  workoutsAdapter.getSelectors((s: RootState) => s.workouts);
export const { selectAll: selectRoutines, selectById: selectRoutineById } =
  routinesAdapter.getSelectors((s: RootState) => s.routines);

export const selectUser = (s: RootState) => s.session.user;
export const selectIsSignedIn = (s: RootState) => Boolean(s.session.token);
export const selectStepGoal = (s: RootState) => s.session.user?.stepGoal ?? 8000;
export const selectWeeklyGoal = (s: RootState) => s.session.user?.weeklyWorkoutGoal ?? 3;

export const selectActivity = createSelector(
  [(s: RootState) => s.activity.byDate],
  (byDate): DailyActivity[] => Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
);

export const selectRecordAnalysis = createSelector([selectWorkouts], (workouts) =>
  analyzeRecords(workouts),
);
/** Headline PRs (one per exercise) grouped by workout, for badges and celebrations. */
export const selectRecordEventsByWorkout = createSelector([selectRecordAnalysis], (a) =>
  recordEventsByWorkout(headlineRecords(a.events)),
);
export const selectRecentRecords = createSelector([selectRecordAnalysis], (a) =>
  headlineRecords(a.events).slice(-5).reverse(),
);
export const selectExerciseUsage = createSelector([selectWorkouts], (w) => exerciseUsage(w));

export const selectStreaks = createSelector(
  [
    selectWorkouts,
    selectActivity,
    selectStepGoal,
    selectWeeklyGoal,
    (_s: RootState, today: string) => today,
  ],
  (workouts, activity, stepGoal, weeklyGoal, today) => ({
    day: dayStreak(activeDays(workouts, activity, stepGoal), today),
    week: weekStreak(workoutDays(workouts), today, weeklyGoal),
  }),
);

export const selectPendingKeys = createSelector([(s: RootState) => s.outbox.items], (items) =>
  pendingKeys(items),
);
export const selectPendingCount = (s: RootState) => s.outbox.items.length;
export const selectFailedCount = (s: RootState) => s.outbox.failed.length;
