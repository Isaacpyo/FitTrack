import {
  detectNewRecords,
  type DailyActivity,
  type RecordEvent,
  type RoutineInput,
  type Workout,
} from '@fittrack/shared';
import { signedOut } from './actions';
import { activityRecorded } from './activitySlice';
import { draftToWorkout, type DraftErrors } from './draft';
import { draftDiscarded } from './draftSlice';
import { makeOutboxItem } from './outbox';
import { enqueued } from './outboxSlice';
import { routineRemoved, routineSaved } from './routinesSlice';
import { selectWorkouts } from './selectors';
import type { AppThunk } from './types';
import { workoutRemoved, workoutSaved } from './workoutsSlice';

export type SaveDraftResult =
  | { ok: true; workout: Workout; records: RecordEvent[] }
  | { ok: false; message: string; errors: DraftErrors };

/** Validate the open draft, save it locally and queue it for upload. Works offline. */
export const saveDraft = (): AppThunk<SaveDraftResult> => (dispatch, getState, { now }) => {
  const draft = getState().draft.current;
  if (!draft) return { ok: false, message: 'Nothing to save', errors: {} };

  const at = now();
  const result = draftToWorkout(draft, at);
  if (!result.ok) return result;

  const workout: Workout = { ...result.workout, deletedAt: null };
  const records = detectNewRecords(selectWorkouts(getState()), workout);
  dispatch(workoutSaved(workout));
  dispatch(enqueued(makeOutboxItem({ kind: 'workout.upsert', entityId: workout.id, payload: result.workout }, at)));
  dispatch(draftDiscarded());
  return { ok: true, workout, records };
};

export const deleteWorkout = (id: string): AppThunk => (dispatch, getState, { now }) => {
  const at = now();
  dispatch(workoutRemoved(id));
  dispatch(enqueued(makeOutboxItem({ kind: 'workout.delete', entityId: id, deletedAt: at.toISOString() }, at)));
  if (getState().draft.current?.id === id) dispatch(draftDiscarded());
};

export const saveRoutine = (input: Omit<RoutineInput, 'updatedAt'>): AppThunk => (dispatch, _getState, { now }) => {
  const at = now();
  const payload: RoutineInput = { ...input, updatedAt: at.toISOString() };
  dispatch(routineSaved({ ...payload, deletedAt: null }));
  dispatch(enqueued(makeOutboxItem({ kind: 'routine.upsert', entityId: payload.id, payload }, at)));
};

export const deleteRoutine = (id: string): AppThunk => (dispatch, _getState, { now }) => {
  const at = now();
  dispatch(routineRemoved(id));
  dispatch(enqueued(makeOutboxItem({ kind: 'routine.delete', entityId: id, deletedAt: at.toISOString() }, at)));
};

/** Store health-provider data locally and queue it for upload. Unchanged days are skipped. */
export const recordActivity = (days: DailyActivity[]): AppThunk<number> => (dispatch, getState, { now }) => {
  const existing = getState().activity.byDate;
  const changed = days.filter((d) => {
    const prev = existing[d.date];
    return !prev || prev.steps !== d.steps || prev.activeMinutes !== d.activeMinutes || prev.energyKcal !== d.energyKcal || prev.source !== d.source;
  });
  if (changed.length === 0) return 0;
  dispatch(activityRecorded(changed));
  dispatch(enqueued(makeOutboxItem({ kind: 'activity.upsert', entityId: 'activity', payload: changed }, now())));
  return changed.length;
};

export const signOut = (): AppThunk => (dispatch) => {
  dispatch(signedOut({ reason: 'user' }));
};
