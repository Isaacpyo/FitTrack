import NetInfo from '@react-native-community/netinfo';

/**
 * Connectivity on iOS/Android. Only `isConnected` is used: `isInternetReachable` can report
 * false negatives while probing, and real request failures are handled by the sync engine anyway.
 */
export function subscribeToConnectivity(onChange: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => onChange(state.isConnected !== false));
}
