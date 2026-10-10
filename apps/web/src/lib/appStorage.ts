import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from './storage';

/** AsyncStorage is backed by localStorage on the web. */
export const appStorage: KeyValueStorage = AsyncStorage;
