import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type {
  AuthResponse,
  DailyActivity,
  DemoLoginInput,
  LoginInput,
  ProfileUpdate,
  Routine,
  RoutineInput,
  SignupInput,
  SyncChangesResponse,
  UpsertResult,
  User,
  Workout,
  WorkoutInput,
} from '@fittrack/shared';
import { API_URL, REQUEST_TIMEOUT_MS, SLOW_REQUEST_MS } from '../config';
import { signedOut } from './actions';
import { userUpdated } from './sessionSlice';
import { serverWakingChanged } from './syncSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as { session: { token: string | null } }).session.token;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

let slowRequests = 0;

/**
 * Wraps fetchBaseQuery with two app-wide behaviours:
 * - a request still pending after SLOW_REQUEST_MS flags `serverWaking`, which shows the
 *   "Waking the server…" banner (Render's free tier sleeps when idle);
 * - a 401 on an authenticated request signs the user out with an "expired" notice.
 */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    if (slowRequests++ === 0) api.dispatch(serverWakingChanged(true));
  }, SLOW_REQUEST_MS);

  try {
    const hadToken = Boolean(
      (api.getState() as { session: { token: string | null } }).session.token,
    );
    const result = await rawBaseQuery(args, api, extraOptions);
    const url = typeof args === 'string' ? args : args.url;
    if (result.error?.status === 401 && hadToken && !url.startsWith('/auth/')) {
      api.dispatch(signedOut({ reason: 'expired' }));
    }
    return result;
  } finally {
    clearTimeout(timer);
    if (slow && --slowRequests === 0) api.dispatch(serverWakingChanged(false));
  }
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me'],
  endpoints: (build) => ({
    health: build.query<{ ok: boolean }, void>({ query: () => '/healthz' }),

    login: build.mutation<AuthResponse, LoginInput>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    signup: build.mutation<AuthResponse, SignupInput>({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
    }),
    demoLogin: build.mutation<AuthResponse, DemoLoginInput>({
      query: (body) => ({ url: '/auth/demo', method: 'POST', body }),
    }),

    me: build.query<User, void>({ query: () => '/me', providesTags: ['Me'] }),
    updateProfile: build.mutation<User, ProfileUpdate>({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(userUpdated(data));
        } catch {
          // Error surfaces through the mutation hook.
        }
      },
    }),
    deleteAccount: build.mutation<void, void>({ query: () => ({ url: '/me', method: 'DELETE' }) }),

    // Offline sync — driven by the sync engine, not by components.
    syncChanges: build.query<SyncChangesResponse, { since: string | null }>({
      query: ({ since }) => ({ url: '/sync/changes', params: since ? { since } : undefined }),
      keepUnusedDataFor: 0,
    }),
    upsertWorkout: build.mutation<UpsertResult<Workout>, WorkoutInput>({
      query: (w) => ({ url: `/workouts/${w.id}`, method: 'PUT', body: w }),
    }),
    deleteWorkout: build.mutation<void, { id: string; deletedAt: string }>({
      query: ({ id, deletedAt }) => ({
        url: `/workouts/${id}`,
        method: 'DELETE',
        params: { deletedAt },
      }),
    }),
    upsertRoutine: build.mutation<UpsertResult<Routine>, RoutineInput>({
      query: (r) => ({ url: `/routines/${r.id}`, method: 'PUT', body: r }),
    }),
    deleteRoutine: build.mutation<void, { id: string; deletedAt: string }>({
      query: ({ id, deletedAt }) => ({
        url: `/routines/${id}`,
        method: 'DELETE',
        params: { deletedAt },
      }),
    }),
    putActivity: build.mutation<{ updated: number }, DailyActivity[]>({
      query: (days) => ({ url: '/activity', method: 'PUT', body: { days } }),
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useDemoLoginMutation,
  useUpdateProfileMutation,
  useDeleteAccountMutation,
} = api;

/** Human-readable message for any RTK Query / fetch error. */
export function describeApiError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const e = error as Partial<FetchBaseQueryError> & { message?: string };
  if (e.status === 'FETCH_ERROR')
    return "Can't reach the server. Check your connection and try again.";
  if (e.status === 'TIMEOUT_ERROR') return 'The server took too long to respond. Please try again.';
  if ('data' in e && e.data && typeof e.data === 'object' && 'error' in e.data) {
    const message = (e.data as { error?: { message?: string } }).error?.message;
    if (message) return message;
  }
  if (typeof e.status === 'number' && e.status >= 500)
    return 'The server had a problem. Please try again shortly.';
  return e.message ?? 'Something went wrong. Please try again.';
}
