import { combineReducers, type UnknownAction } from '@reduxjs/toolkit';
import { signedIn, signedOut } from './actions';
import activity from './activitySlice';
import { api } from './api';
import draft from './draftSlice';
import outbox from './outboxSlice';
import routines from './routinesSlice';
import session from './sessionSlice';
import sync from './syncSlice';
import workouts from './workoutsSlice';

export const appReducer = combineReducers({
  session,
  workouts,
  routines,
  activity,
  outbox,
  draft,
  sync,
  [api.reducerPath]: api.reducer,
});

export type RootState = ReturnType<typeof appReducer>;

/**
 * Data ownership rules:
 * - an explicit sign-out wipes every user-owned slice;
 * - an expired session keeps local data and the unsent queue, so nothing logged offline is lost;
 * - signing in as a *different* user than the cached one starts from a clean slate.
 * Connectivity and the RTK Query cache are managed separately and always kept.
 */
export function rootReducer(state: RootState | undefined, action: UnknownAction): RootState {
  if (state) {
    const wipe =
      (signedOut.match(action) && action.payload.reason === 'user') ||
      (signedIn.match(action) &&
        state.session.user !== null &&
        state.session.user.id !== action.payload.user.id);
    if (wipe)
      return appReducer(
        { sync: { ...state.sync, lastPulledAt: null }, [api.reducerPath]: state[api.reducerPath] },
        action,
      );
  }
  return appReducer(state, action);
}
