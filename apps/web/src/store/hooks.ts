import { useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { toDateKey } from '@fittrack/shared';
import type { AppStore } from './index';
import type { AppDispatch, RootState } from './types';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();

/** Today's local date key; re-renders when the day rolls over. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => setToday(toDateKey(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}
