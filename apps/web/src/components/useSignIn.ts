import { toDateKey, type AuthResponse } from '@fittrack/shared';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { signedIn } from '../store/actions';
import { useDemoLoginMutation } from '../store/api';
import { useAppDispatch } from '../store/hooks';

/** Finish any sign-in: store the session and go to the dashboard. */
export function useCompleteSignIn() {
  const dispatch = useAppDispatch();
  return useCallback(
    (auth: AuthResponse) => {
      dispatch(signedIn(auth));
      router.replace('/today');
    },
    [dispatch],
  );
}

/** One-click demo: the API creates a private sandbox seeded relative to the visitor's "today". */
export function useDemoSignIn() {
  const [demoLogin, state] = useDemoLoginMutation();
  const complete = useCompleteSignIn();
  const start = useCallback(async () => {
    const now = new Date();
    const result = await demoLogin({ today: toDateKey(now), utcOffsetMinutes: -now.getTimezoneOffset() });
    if ('data' in result && result.data) complete(result.data);
  }, [demoLogin, complete]);
  return { start, ...state };
}
