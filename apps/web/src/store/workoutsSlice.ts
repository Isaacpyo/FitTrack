import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workout } from '@fittrack/shared';
import { changesPulled } from './actions';

export const workoutsAdapter = createEntityAdapter<Workout>({
  // Newest first; id breaks ties so ordering is stable.
  sortComparer: (a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id),
});

const workoutsSlice = createSlice({
  name: 'workouts',
  initialState: workoutsAdapter.getInitialState(),
  reducers: {
    workoutSaved: workoutsAdapter.upsertOne,
    workoutRemoved: workoutsAdapter.removeOne,
    /** The server already had a newer copy (last-write-wins); adopt it. */
    serverCopyAdopted(state, action: PayloadAction<Workout>) {
      if (action.payload.deletedAt) workoutsAdapter.removeOne(state, action.payload.id);
      else workoutsAdapter.upsertOne(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(changesPulled, (state, { payload }) => {
      const pending = new Set(payload.pending);
      for (const w of payload.response.workouts) {
        if (pending.has(`workout:${w.id}`)) continue; // unsent local edit wins until it is pushed
        if (w.deletedAt) workoutsAdapter.removeOne(state, w.id);
        else workoutsAdapter.upsertOne(state, w);
      }
    });
  },
});

export const { workoutSaved, workoutRemoved, serverCopyAdopted } = workoutsSlice.actions;
export default workoutsSlice.reducer;
