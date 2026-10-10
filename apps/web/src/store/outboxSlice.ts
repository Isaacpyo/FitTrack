import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { hydrated } from './actions';
import { enqueueItem, type OutboxItem } from './outbox';

export interface OutboxState {
  items: OutboxItem[];
  /** Rejected by the server (4xx): kept for the user to retry or discard, never auto-retried. */
  failed: OutboxItem[];
  inFlightId: string | null;
  consecutiveFailures: number;
  /** Epoch ms of the next automatic retry, if one is scheduled. */
  retryAt: number | null;
}

const initialState: OutboxState = { items: [], failed: [], inFlightId: null, consecutiveFailures: 0, retryAt: null };

const outboxSlice = createSlice({
  name: 'outbox',
  initialState,
  reducers: {
    enqueued(state, action: PayloadAction<OutboxItem>) {
      state.items = enqueueItem(state.items, action.payload, state.inFlightId);
    },
    sendStarted(state, action: PayloadAction<string>) {
      state.inFlightId = action.payload;
    },
    sendSucceeded(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
      state.inFlightId = null;
      state.consecutiveFailures = 0;
      state.retryAt = null;
    },
    sendDeferred(state, action: PayloadAction<{ id: string; error: string; retryAt: number }>) {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.attempts += 1;
        item.lastError = action.payload.error;
      }
      state.inFlightId = null;
      state.consecutiveFailures += 1;
      state.retryAt = action.payload.retryAt;
    },
    /** Stopped without a verdict (e.g. the session expired); the item stays queued. */
    sendAborted(state) {
      state.inFlightId = null;
    },
    sendRejected(state, action: PayloadAction<{ id: string; error: string }>) {
      const item = state.items.find((i) => i.id === action.payload.id);
      state.items = state.items.filter((i) => i.id !== action.payload.id);
      if (item) state.failed.push({ ...item, attempts: item.attempts + 1, lastError: action.payload.error });
      state.inFlightId = null;
    },
    failedRetried(state, action: PayloadAction<string>) {
      const item = state.failed.find((i) => i.id === action.payload);
      if (!item) return;
      state.failed = state.failed.filter((i) => i.id !== action.payload);
      state.items = enqueueItem(state.items, { ...item, attempts: 0 }, state.inFlightId);
    },
    failedDiscarded(state, action: PayloadAction<string>) {
      state.failed = state.failed.filter((i) => i.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    // A send interrupted by the app closing is simply retried.
    builder.addCase(hydrated, (state) => {
      state.inFlightId = null;
      state.retryAt = null;
    });
  },
});

export const { enqueued, sendStarted, sendSucceeded, sendDeferred, sendAborted, sendRejected, failedRetried, failedDiscarded } =
  outboxSlice.actions;
export default outboxSlice.reducer;
