import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 id. Records get ids on the device so they can be created offline. */
export function newId(): string {
  return Crypto.randomUUID();
}
