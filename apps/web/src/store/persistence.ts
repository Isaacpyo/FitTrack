import type { Store } from '@reduxjs/toolkit';
import type { KeyValueStorage } from '../lib/storage';
import type { RootState } from './rootReducer';

export const STATE_STORAGE_KEY = 'fittrack/state/v1';

/** The slices that make the app usable offline. Bump `version` on incompatible changes. */
export interface PersistedState {
  version: 1;
  user: RootState['session']['user'];
  workouts: RootState['workouts'];
  routines: RootState['routines'];
  activity: Pick<RootState['activity'], 'byDate' | 'healthConnected' | 'lastHealthSyncAt'>;
  outbox: Pick<RootState['outbox'], 'items' | 'failed'>;
  draft: RootState['draft'];
  lastPulledAt: string | null;
}

export function selectPersisted(state: RootState): PersistedState {
  return {
    version: 1,
    user: state.session.user,
    workouts: state.workouts,
    routines: state.routines,
    activity: {
      byDate: state.activity.byDate,
      healthConnected: state.activity.healthConnected,
      lastHealthSyncAt: state.activity.lastHealthSyncAt,
    },
    outbox: { items: state.outbox.items, failed: state.outbox.failed },
    draft: state.draft,
    lastPulledAt: state.sync.lastPulledAt,
  };
}

export async function loadPersisted(storage: KeyValueStorage): Promise<PersistedState | null> {
  try {
    const raw = await storage.getItem(STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null; // corrupt or unreadable storage: start fresh rather than crash
  }
}

/**
 * Rebuild preloaded state. Cached data without a token belongs to a session that expired: it is
 * kept (with its unsent queue) and the user is asked to sign in again.
 */
export function toPreloadedState(persisted: PersistedState | null, token: string | null): Partial<RootState> {
  if (!persisted || !persisted.user) return {};
  return {
    session: { token, user: persisted.user, expired: !token },
    workouts: persisted.workouts,
    routines: persisted.routines,
    activity: { ...persisted.activity, healthSyncing: false, healthError: null },
    outbox: { ...persisted.outbox, inFlightId: null, consecutiveFailures: 0, retryAt: null },
    draft: persisted.draft,
    sync: {
      online: true,
      serverWaking: false,
      flushing: false,
      pulling: false,
      lastPulledAt: persisted.lastPulledAt,
      lastError: null,
    },
  };
}

/** Write persisted slices (debounced) whenever they change. Returns an unsubscribe function. */
export function persistStore(store: Store<RootState>, storage: KeyValueStorage, delayMs = 250): () => void {
  let last = selectPersisted(store.getState());
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = () => {
    timer = null;
    const state = store.getState();
    if (!state.session.user) return; // signed out: storage was cleared on purpose
    void storage.setItem(STATE_STORAGE_KEY, JSON.stringify(selectPersisted(state))).catch(() => undefined);
  };

  const unsubscribe = store.subscribe(() => {
    const next = selectPersisted(store.getState());
    const changed = (Object.keys(next) as (keyof PersistedState)[]).some((k) => {
      const a = next[k];
      const b = last[k];
      if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
        return Object.keys(a).some((sub) => (a as Record<string, unknown>)[sub] !== (b as Record<string, unknown>)[sub]);
      }
      return a !== b;
    });
    last = next;
    if (changed && !timer) timer = setTimeout(write, delayMs);
  });

  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
