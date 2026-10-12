import type { HealthProvider } from './types';

/** Web and other platforms have no native health store; see native.ios.ts / native.android.ts. */
export async function loadNativeProvider(): Promise<HealthProvider | null> {
  return null;
}
