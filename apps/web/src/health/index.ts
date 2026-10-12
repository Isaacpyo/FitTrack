import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { HEALTH_PROVIDER_OVERRIDE } from '../config';
import { createMockProvider } from './mock';
import { loadNativeProvider } from './native';
import type { HealthProvider } from './types';

let cached: Promise<HealthProvider> | null = null;

/**
 * Pick the health data source for this runtime:
 * iOS/Android dev-client builds use HealthKit / Health Connect; the web, Expo Go, devices
 * without a health store, or EXPO_PUBLIC_HEALTH_PROVIDER=mock use simulated data.
 */
export function getHealthProvider(): Promise<HealthProvider> {
  cached ??= (async () => {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (Platform.OS === 'web' || isExpoGo || HEALTH_PROVIDER_OVERRIDE === 'mock')
      return createMockProvider();
    return (await loadNativeProvider()) ?? createMockProvider();
  })();
  return cached;
}

export type { HealthProvider } from './types';
