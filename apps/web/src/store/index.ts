import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { hydrated } from './actions';
import { api } from './api';
import { loadPersisted, persistStore, toPreloadedState } from './persistence';
import { rootReducer, type RootState } from './rootReducer';
import { registerSessionEffects } from './sessionEffects';
import { registerSyncEngine } from './syncEngine';
import type { AppStartListening, StoreDeps } from './types';

export function makeStore(deps: StoreDeps, preloadedState?: Partial<RootState>) {
  const listener = createListenerMiddleware({ extra: deps });
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: deps } })
        .prepend(listener.middleware)
        .concat(api.middleware),
  });
  const startListening = listener.startListening as AppStartListening;
  registerSyncEngine(startListening);
  registerSessionEffects(startListening);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;

/** Restore the persisted session and data, then start syncing. */
export async function createAppStore(deps: StoreDeps): Promise<AppStore> {
  const [persisted, token] = await Promise.all([
    loadPersisted(deps.storage),
    deps.tokenStorage.get().catch(() => null),
  ]);
  const store = makeStore(deps, toPreloadedState(persisted, token));
  persistStore(store, deps.storage);
  store.dispatch(hydrated());
  return store;
}

export type { AppDispatch, AppThunk, RootState, StoreDeps } from './types';
