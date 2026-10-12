/** Minimal async key-value contract (AsyncStorage on device/web, in-memory in tests). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Where the session token lives: SecureStore on device, localStorage on the web. */
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

export function memoryTokenStorage(initial: string | null = null): TokenStorage {
  let token = initial;
  return {
    get: async () => token,
    set: async (t) => void (token = t),
    clear: async () => void (token = null),
  };
}
