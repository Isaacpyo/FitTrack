import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getHealthProvider } from '../health';
import { syncHealthData } from '../health/sync';
import { subscribeToConnectivity } from '../lib/network';
import { appForegrounded } from '../store/actions';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectIsSignedIn } from '../store/selectors';
import { connectivityChanged } from '../store/syncSlice';

const HEALTH_REFRESH_MS = 60 * 60 * 1000;

/** Bridges platform events into the store: connectivity, app foregrounding, health refresh. */
export function AppEffects() {
  const dispatch = useAppDispatch();
  const signedIn = useAppSelector(selectIsSignedIn);
  const healthConnected = useAppSelector((s) => s.activity.healthConnected);
  const lastHealthSync = useAppSelector((s) => s.activity.lastHealthSyncAt);

  useEffect(() => subscribeToConnectivity((online) => dispatch(connectivityChanged(online))), [dispatch]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(appForegrounded());
    });
    return () => sub.remove();
  }, [dispatch]);

  // Refresh health data hourly. Real health stores only after the user has granted access once
  // (from the dashboard or settings); the mock provider needs no permission.
  useEffect(() => {
    if (!signedIn) return;
    const stale = !lastHealthSync || Date.now() - Date.parse(lastHealthSync) > HEALTH_REFRESH_MS;
    if (!stale) return;
    let cancelled = false;
    void getHealthProvider().then((provider) => {
      if (!cancelled && (provider.isMock || healthConnected)) {
        void dispatch(syncHealthData(provider, { requestPermission: false }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, healthConnected, lastHealthSync, dispatch]);

  return null;
}
