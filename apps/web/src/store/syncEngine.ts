import { isAnyOf } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { UpsertResult } from '@fittrack/shared';
import {
  appForegrounded,
  changesPulled,
  flushRequested,
  hydrated,
  pullRequested,
  signedIn,
  signedOut,
} from './actions';
import { api, describeApiError } from './api';
import { backoffMs, classifyFailure, entityKey, pendingKeys, type OutboxItem } from './outbox';
import {
  enqueued,
  failedRetried,
  sendAborted,
  sendDeferred,
  sendRejected,
  sendStarted,
  sendSucceeded,
} from './outboxSlice';
import { routineServerCopyAdopted } from './routinesSlice';
import {
  connectivityChanged,
  flushFinished,
  flushStarted,
  pullFailed,
  pullStarted,
} from './syncSlice';
import type { AppDispatch, AppStartListening } from './types';
import { serverCopyAdopted } from './workoutsSlice';

type SendResult =
  { ok: true; data: unknown } | { ok: false; error: FetchBaseQueryError | { message?: string } };

/** Replay one outbox item against the API. */
async function send(item: OutboxItem, dispatch: AppDispatch): Promise<SendResult> {
  const request = (() => {
    switch (item.kind) {
      case 'workout.upsert':
        return dispatch(api.endpoints.upsertWorkout.initiate(item.payload));
      case 'workout.delete':
        return dispatch(
          api.endpoints.deleteWorkout.initiate({ id: item.entityId, deletedAt: item.deletedAt }),
        );
      case 'routine.upsert':
        return dispatch(api.endpoints.upsertRoutine.initiate(item.payload));
      case 'routine.delete':
        return dispatch(
          api.endpoints.deleteRoutine.initiate({ id: item.entityId, deletedAt: item.deletedAt }),
        );
      case 'activity.upsert':
        return dispatch(api.endpoints.putActivity.initiate(item.payload));
    }
  })();
  try {
    return { ok: true, data: await request.unwrap() };
  } catch (error) {
    return { ok: false, error: error as FetchBaseQueryError };
  } finally {
    request.reset(); // don't accumulate mutation results in the cache
  }
}

/**
 * The offline-first sync engine, built on RTK listener middleware:
 * - flushes the outbox in order whenever it changes, connectivity returns or the app resumes;
 * - retries network/5xx failures with exponential backoff and parks 4xx rejections;
 * - pulls server changes after a successful flush, on sign-in, on launch and on reconnect.
 */
export function registerSyncEngine(startListening: AppStartListening): void {
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const isOnline = connectivityChanged.match;

  startListening({
    predicate: (action) =>
      isAnyOf(
        enqueued,
        failedRetried,
        flushRequested,
        hydrated,
        signedIn,
        appForegrounded,
      )(action) ||
      (isOnline(action) && action.payload),
    effect: async (_action, { getState, dispatch }) => {
      const start = getState();
      // Only one flush loop at a time; a running loop picks up newly queued items itself.
      if (
        start.sync.flushing ||
        !start.sync.online ||
        !start.session.token ||
        start.outbox.items.length === 0
      )
        return;
      clearRetry();
      dispatch(flushStarted());

      let sent = 0;
      let error: string | null = null;
      try {
        for (;;) {
          const state = getState();
          const item = state.outbox.items[0];
          if (!item || !state.sync.online || !state.session.token) break;

          dispatch(sendStarted(item.id));
          const result = await send(item, dispatch);

          if (result.ok) {
            dispatch(sendSucceeded(item.id));
            sent += 1;
            const upsert = result.data as UpsertResult<never> | undefined;
            // The server kept a newer copy (last-write-wins). Adopt it unless we have
            // an even newer local edit still queued.
            if (
              upsert &&
              upsert.applied === false &&
              !pendingKeys(getState().outbox.items).has(entityKey(item))
            ) {
              if (item.kind === 'workout.upsert') dispatch(serverCopyAdopted(upsert.item));
              if (item.kind === 'routine.upsert') dispatch(routineServerCopyAdopted(upsert.item));
            }
            continue;
          }

          const status = 'status' in result.error ? result.error.status : undefined;
          const kind = classifyFailure(status);
          error = describeApiError(result.error);
          if (kind === 'auth') {
            // baseQuery has already ended the session; the item waits for the next sign-in.
            dispatch(sendAborted());
            break;
          }
          if (kind === 'reject') {
            dispatch(sendRejected({ id: item.id, error }));
            continue;
          }
          const delay = backoffMs(getState().outbox.consecutiveFailures + 1);
          dispatch(sendDeferred({ id: item.id, error, retryAt: Date.now() + delay }));
          retryTimer = setTimeout(() => {
            retryTimer = null;
            dispatch(flushRequested());
          }, delay);
          break;
        }
      } finally {
        dispatch(flushFinished({ error: getState().outbox.items.length > 0 ? error : null }));
      }

      if (sent > 0 && getState().outbox.items.length === 0) dispatch(pullRequested());
    },
  });

  startListening({
    predicate: (action) =>
      isAnyOf(pullRequested, hydrated, signedIn, appForegrounded)(action) ||
      (isOnline(action) && action.payload),
    effect: async (_action, { getState, dispatch }) => {
      const state = getState();
      if (state.sync.pulling || !state.sync.online || !state.session.token) return;
      dispatch(pullStarted());
      const request = dispatch(
        api.endpoints.syncChanges.initiate(
          { since: state.sync.lastPulledAt },
          { subscribe: false, forceRefetch: true },
        ),
      );
      try {
        const response = await request.unwrap();
        // A sign-out may have happened while the request was in flight.
        if (!getState().session.token) return;
        dispatch(changesPulled({ response, pending: [...pendingKeys(getState().outbox.items)] }));
      } catch (err) {
        dispatch(pullFailed(describeApiError(err)));
      }
    },
  });

  // Wake a sleeping free-tier API as early as possible (also before sign-in).
  startListening({
    actionCreator: hydrated,
    effect: (_action, { dispatch }) => {
      void dispatch(api.endpoints.health.initiate(undefined, { subscribe: false }));
    },
  });

  startListening({ actionCreator: signedOut, effect: () => clearRetry() });
}
