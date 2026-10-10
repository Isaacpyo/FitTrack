import { signedIn, signedOut } from './actions';
import { api } from './api';
import { STATE_STORAGE_KEY } from './persistence';
import type { AppStartListening } from './types';

/** Keep the token in secure storage and clear local data on an explicit sign-out. */
export function registerSessionEffects(startListening: AppStartListening): void {
  startListening({
    actionCreator: signedIn,
    effect: async (action, { extra }) => {
      await extra.tokenStorage.set(action.payload.token);
    },
  });
  startListening({
    actionCreator: signedOut,
    effect: async (action, { extra, dispatch }) => {
      dispatch(api.util.resetApiState());
      await extra.tokenStorage.clear();
      // An expired session keeps its data (and unsent changes) until the owner signs in again.
      if (action.payload.reason === 'user') await extra.storage.removeItem(STATE_STORAGE_KEY);
    },
  });
}
