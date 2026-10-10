import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DailyActivity } from '@fittrack/shared';
import { changesPulled } from './actions';

export interface ActivityState {
  byDate: Record<string, DailyActivity>;
  /** User has granted access to Apple Health / Health Connect (always true for the mock). */
  healthConnected: boolean;
  healthSyncing: boolean;
  healthError: string | null;
  lastHealthSyncAt: string | null;
}

const initialState: ActivityState = {
  byDate: {},
  healthConnected: false,
  healthSyncing: false,
  healthError: null,
  lastHealthSyncAt: null,
};

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    activityRecorded(state, action: PayloadAction<DailyActivity[]>) {
      for (const d of action.payload) state.byDate[d.date] = d;
    },
    healthSyncStarted(state) {
      state.healthSyncing = true;
      state.healthError = null;
    },
    healthSyncSucceeded(state, action: PayloadAction<{ at: string }>) {
      state.healthSyncing = false;
      state.healthConnected = true;
      state.lastHealthSyncAt = action.payload.at;
    },
    healthSyncFailed(state, action: PayloadAction<string>) {
      state.healthSyncing = false;
      state.healthError = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(changesPulled, (state, { payload }) => {
      const pending = new Set(payload.pending);
      for (const d of payload.response.activity) {
        if (!pending.has(`activity:${d.date}`)) state.byDate[d.date] = d;
      }
    });
  },
});

export const { activityRecorded, healthSyncStarted, healthSyncSucceeded, healthSyncFailed } = activitySlice.actions;
export default activitySlice.reducer;
