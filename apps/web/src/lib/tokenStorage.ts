import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from './storage';

const KEY = 'fittrack.token';

/** iOS Keychain / Android Keystore-backed token storage. */
export const tokenStorage: TokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
