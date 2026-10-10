import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { changesPulled, hydrated, signedOut } from './actions';

export interface SyncState {
  online: boolean;
  /** A request has been pending long enough that the free-tier API is probably cold-starting. */
  serverWaking: boolean;
  flushing: boolean;
  pulling: boolean;
  /** Server cursor for incremental pulls. */
  lastPulledAt: string | null;
  lastError: string | null;
}

const initialState: SyncState = {
  online: true,
  serverWaking: false,
  flushing: false,
  pulling: false,
  lastPulledAt: null,
  lastError: null,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    connectivityChanged(state, action: PayloadAction<boolean>) {
      state.online = action.payload;
    },
    serverWakingChanged(state, action: PayloadAction<boolean>) {
      state.serverWaking = action.payload;
    },
    flushStarted(state) {
      state.flushing = true;
    },
    flushFinished(state, action: PayloadAction<{ error: string | null }>) {
      state.flushing = false;
      state.lastError = action.payload.error;
    },
    pullStarted(state) {
      state.pulling = true;
    },
    pullFailed(state, action: PayloadAction<string>) {
      state.pulling = false;
      state.lastError = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(changesPulled, (state, { payload }) => {
        state.pulling = false;
        state.lastPulledAt = payload.response.serverTime;
        state.lastError = null;
      })
      .addCase(hydrated, (state) => {
        state.flushing = false;
        state.pulling = false;
        state.serverWaking = false;
      })
      .addCase(signedOut, (state, action) =>
        action.payload.reason === 'user' ? { ...initialState, online: state.online } : { ...state, flushing: false, pulling: false },
      );
  },
});

export const { connectivityChanged, serverWakingChanged, flushStarted, flushFinished, pullStarted, pullFailed } =
  syncSlice.actions;
export default syncSlice.reducer;
