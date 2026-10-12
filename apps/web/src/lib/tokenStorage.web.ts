import type { TokenStorage } from './storage';

const KEY = 'fittrack.token';

// Browsers have no secure enclave; localStorage is the pragmatic choice for a bearer-token SPA.
// The API sets strict CORS and tokens expire, see README "Security notes".
function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const tokenStorage: TokenStorage = {
  get: async () => store()?.getItem(KEY) ?? null,
  set: async (token) => store()?.setItem(KEY, token),
  clear: async () => store()?.removeItem(KEY),
};
