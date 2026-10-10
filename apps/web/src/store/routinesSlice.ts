import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Routine } from '@fittrack/shared';
import { changesPulled } from './actions';

export const routinesAdapter = createEntityAdapter<Routine>({
  sortComparer: (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
});

const routinesSlice = createSlice({
  name: 'routines',
  initialState: routinesAdapter.getInitialState(),
  reducers: {
    routineSaved: routinesAdapter.upsertOne,
    routineRemoved: routinesAdapter.removeOne,
    routineServerCopyAdopted(state, action: PayloadAction<Routine>) {
      if (action.payload.deletedAt) routinesAdapter.removeOne(state, action.payload.id);
      else routinesAdapter.upsertOne(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(changesPulled, (state, { payload }) => {
      const pending = new Set(payload.pending);
      for (const r of payload.response.routines) {
        if (pending.has(`routine:${r.id}`)) continue;
        if (r.deletedAt) routinesAdapter.removeOne(state, r.id);
        else routinesAdapter.upsertOne(state, r);
      }
    });
  },
});

export const { routineSaved, routineRemoved, routineServerCopyAdopted } = routinesSlice.actions;
export default routinesSlice.reducer;
