import { addDays, toDateKey } from '@fittrack/shared';
import { healthSyncFailed, healthSyncStarted, healthSyncSucceeded } from '../store/activitySlice';
import { recordActivity } from '../store/thunks';
import type { AppThunk } from '../store/types';
import type { HealthProvider } from './types';

export const HEALTH_SYNC_DAYS = 30;

/** Read the last 30 days from the health provider, store them and queue them for upload. */
export const syncHealthData =
  (provider: HealthProvider, opts: { requestPermission: boolean }): AppThunk<Promise<boolean>> =>
  async (dispatch, getState, { now }) => {
    if (getState().activity.healthSyncing) return false;
    dispatch(healthSyncStarted());
    try {
      if (opts.requestPermission && !(await provider.requestPermissions())) {
        dispatch(healthSyncFailed(`Permission to read ${provider.label} was not granted.`));
        return false;
      }
      const today = toDateKey(now());
      const days = await provider.getDailyActivity(addDays(today, -(HEALTH_SYNC_DAYS - 1)), today);
      dispatch(recordActivity(days));
      dispatch(healthSyncSucceeded({ at: now().toISOString() }));
      return true;
    } catch (err) {
      dispatch(healthSyncFailed(err instanceof Error ? err.message : `Could not read ${provider.label}.`));
      return false;
    }
  };
