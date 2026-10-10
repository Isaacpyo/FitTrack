import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage, memoryTokenStorage } from '../src/lib/storage';
import { changesPulled, hydrated, signedIn, signedOut } from '../src/store/actions';
import { api } from '../src/store/api';
import { draftFromWorkout } from '../src/store/draft';
import { draftStarted } from '../src/store/draftSlice';
import { createAppStore, makeStore, type RootState, type StoreDeps } from '../src/store';
import { STATE_STORAGE_KEY } from '../src/store/persistence';
import { selectWorkouts } from '../src/store/selectors';
import { connectivityChanged } from '../src/store/syncSlice';
import { deleteWorkout, recordActivity, saveDraft, signOut } from '../src/store/thunks';
import { FakeApi } from './fakeApi';
import { user, workout } from './fixtures';

let server: FakeApi;

beforeEach(() => {
  server = new FakeApi();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(preloaded: Partial<RootState> = {}) {
  const deps: StoreDeps = {
    storage: memoryStorage(),
    tokenStorage: memoryTokenStorage('token-1'),
    now: () => new Date('2026-10-10T17:30:00.000Z'),
  };
  const store = makeStore(deps, { session: { token: 'token-1', user, expired: false }, ...preloaded });
  return { store, deps };
}

function saveWorkout(store: ReturnType<typeof setup>['store'], id = randomUUID(), name = 'Push Day') {
  store.dispatch(draftStarted({ ...draftFromWorkout(workout(id, { name }), randomUUID), isNew: true }));
  const result = store.dispatch(saveDraft());
  expect(result.ok).toBe(true);
  return id;
}

describe('offline-first sync engine', () => {
  it('saves locally while offline and uploads once back online', async () => {
    const { store } = setup();
    store.dispatch(connectivityChanged(false));
    const id = saveWorkout(store);

    expect(selectWorkouts(store.getState()).map((w) => w.id)).toEqual([id]);
    expect(store.getState().outbox.items).toHaveLength(1);
    expect(server.writes()).toEqual([]);

    store.dispatch(connectivityChanged(true));
    await vi.waitFor(() => expect(store.getState().outbox.items).toHaveLength(0));
    expect(server.writes()).toEqual([`PUT /workouts/${id}`]);
    expect(server.requests[0]!.auth).toBe('Bearer token-1');
    // A successful flush is followed by a pull.
    await vi.waitFor(() => expect(store.getState().sync.lastPulledAt).not.toBeNull());
  });

  it('uploads queued operations in order, coalescing edits made while offline', async () => {
    const { store } = setup();
    store.dispatch(connectivityChanged(false));
    const a = saveWorkout(store, randomUUID(), 'First');
    saveWorkout(store, a, 'First, edited');
    const b = saveWorkout(store);
    store.dispatch(deleteWorkout(b));
    expect(store.getState().outbox.items.map((i) => i.kind)).toEqual(['workout.upsert', 'workout.delete']);

    store.dispatch(connectivityChanged(true));
    await vi.waitFor(() => expect(store.getState().outbox.items).toHaveLength(0));
    expect(server.writes()).toEqual([`PUT /workouts/${a}`, `DELETE /workouts/${b}`]);
    expect(server.workouts.get(a)?.name).toBe('First, edited');
  });

  it('retries network and server errors with exponential backoff', async () => {
    vi.useFakeTimers();
    const { store } = setup();
    server.failures.push({ status: 503 }, { status: 503 });
    const id = saveWorkout(store);

    await vi.waitFor(() => expect(store.getState().outbox.items[0]?.attempts).toBe(1));
    expect(store.getState().outbox.retryAt).not.toBeNull();
    expect(store.getState().sync.lastError).toBe('Injected 503');

    await vi.advanceTimersByTimeAsync(2000); // first backoff
    await vi.waitFor(() => expect(store.getState().outbox.items[0]?.attempts).toBe(2));
    await vi.advanceTimersByTimeAsync(4000); // second backoff
    await vi.waitFor(() => expect(store.getState().outbox.items).toHaveLength(0));
    expect(server.workouts.has(id)).toBe(true);
    expect(store.getState().outbox.consecutiveFailures).toBe(0);
  });

  it('treats a dropped connection as retryable', async () => {
    vi.useFakeTimers();
    const { store } = setup();
    server.offline = true;
    saveWorkout(store);
    await vi.waitFor(() => expect(store.getState().outbox.items[0]?.attempts).toBe(1));
    server.offline = false;
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() => expect(store.getState().outbox.items).toHaveLength(0));
  });

  it('parks a rejected (4xx) write and keeps syncing the rest', async () => {
    const { store } = setup();
    store.dispatch(connectivityChanged(false));
    const bad = saveWorkout(store);
    const good = saveWorkout(store);
    server.failures.push({ status: 400, path: `/workouts/${bad}` });
    store.dispatch(connectivityChanged(true));

    await vi.waitFor(() => expect(store.getState().outbox.items).toHaveLength(0));
    expect(store.getState().outbox.failed.map((i) => i.entityId)).toEqual([bad]);
    expect(store.getState().outbox.failed[0]!.lastError).toBe('Injected 400');
    expect(server.workouts.has(good)).toBe(true);
  });

  it('keeps unsent work when the session expires and resumes after signing back in', async () => {
    const { store, deps } = setup();
    server.failures.push({ status: 401 });
    const id = saveWorkout(store);
    await vi.waitFor(() => expect(store.getState().session.token).toBeNull());
    expect(store.getState().session.expired).toBe(true);
    expect(selectWorkouts(store.getState()).map((w) => w.id)).toEqual([id]);
    expect(store.getState().outbox).toMatchObject({ inFlightId: null, items: [expect.objectContaining({ entityId: id })] });
    await vi.waitFor(async () => expect(await deps.tokenStorage.get()).toBeNull());

    store.dispatch(signedIn({ token: 'token-2', user }));
    await vi.waitFor(() => expect(server.workouts.has(id)).toBe(true));
    expect(store.getState().outbox.items).toHaveLength(0);
  });

  it('starts from a clean slate when a different user signs in', () => {
    const { store } = setup();
    store.dispatch(connectivityChanged(false));
    saveWorkout(store);
    store.dispatch(signedOut({ reason: 'expired' }));
    store.dispatch(signedIn({ token: 'other', user: { ...user, id: randomUUID(), email: 'kim@example.com' } }));
    expect(selectWorkouts(store.getState())).toHaveLength(0);
    expect(store.getState().outbox.items).toHaveLength(0);
  });

  it('adopts the server copy when the server has a newer edit (last-write-wins)', async () => {
    const { store } = setup();
    const id = randomUUID();
    server.workouts.set(id, workout(id, { name: 'Edited on phone', updatedAt: '2026-10-10T18:00:00.000Z' }));
    saveWorkout(store, id, 'Older laptop edit');
    await vi.waitFor(() => expect(store.getState().outbox.items).toHaveLength(0));
    expect(selectWorkouts(store.getState())[0]!.name).toBe('Edited on phone');
  });

  it('uploads health activity through the same queue', async () => {
    const { store } = setup();
    const days = [{ date: '2026-10-10', steps: 9000, activeMinutes: 40, energyKcal: 400, source: 'mock' as const }];
    expect(store.dispatch(recordActivity(days))).toBe(1);
    expect(store.dispatch(recordActivity(days))).toBe(0); // unchanged days are not re-sent
    await vi.waitFor(() => expect(server.writes()).toEqual(['PUT /activity']));
  });
});

describe('pulling changes', () => {
  it('never overwrites an entity with unsent local edits, and applies tombstones', () => {
    const { store } = setup();
    store.dispatch(connectivityChanged(false));
    const local = saveWorkout(store, randomUUID(), 'Local edit');
    const other = workout(randomUUID(), { name: 'From server' });
    const gone = workout(randomUUID());
    store.dispatch(changesPulled({ response: { serverTime: 'now', workouts: [gone], routines: [], activity: [] }, pending: [] }));

    store.dispatch(
      changesPulled({
        response: {
          serverTime: '2026-10-10T18:00:00.000Z',
          workouts: [workout(local, { name: 'Stale server copy' }), other, { ...gone, deletedAt: '2026-10-10T17:00:00.000Z' }],
          routines: [],
          activity: [],
        },
        pending: [`workout:${local}`],
      }),
    );
    const byId = Object.fromEntries(selectWorkouts(store.getState()).map((w) => [w.id, w.name]));
    expect(byId).toEqual({ [local]: 'Local edit', [other.id]: 'From server' });
    expect(store.getState().sync.lastPulledAt).toBe('2026-10-10T18:00:00.000Z');
  });
});

describe('waking server banner', () => {
  it('appears while a request is slow and clears when it finishes', async () => {
    vi.useFakeTimers();
    const { store } = setup();
    server.delayMs = 5000;
    const request = store.dispatch(api.endpoints.health.initiate(undefined, { subscribe: false }));
    await vi.advanceTimersByTimeAsync(3100);
    expect(store.getState().sync.serverWaking).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    await request;
    expect(store.getState().sync.serverWaking).toBe(false);
  });
});

describe('persistence and sign-out', () => {
  it('restores data and the queue across restarts', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const tokenStorage = memoryTokenStorage('token-1');
    server.offline = true;
    const first = makeStore({ storage, tokenStorage, now: () => new Date() }, { session: { token: 'token-1', user, expired: false } });
    const { persistStore } = await import('../src/store/persistence');
    persistStore(first, storage);
    first.dispatch(connectivityChanged(false));
    saveWorkout(first);
    await vi.advanceTimersByTimeAsync(300);

    const restored = await createAppStore({ storage, tokenStorage, now: () => new Date() });
    expect(selectWorkouts(restored.getState())).toHaveLength(1);
    expect(restored.getState().outbox.items).toHaveLength(1);
    expect(restored.getState().session.user?.email).toBe(user.email);
  });

  it('keeps cached data from an expired session and asks the owner to sign in', async () => {
    const cached = workout();
    const storage = memoryStorage({
      [STATE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        user,
        workouts: { ids: [cached.id], entities: { [cached.id]: cached } },
        routines: { ids: [], entities: {} },
        activity: { byDate: {}, healthConnected: false, lastHealthSyncAt: null },
        outbox: { items: [], failed: [] },
        draft: { current: null },
        lastPulledAt: null,
      }),
    });
    const store = await createAppStore({ storage, tokenStorage: memoryTokenStorage(null), now: () => new Date() });
    expect(store.getState().session).toMatchObject({ token: null, expired: true, user: { id: user.id } });
    expect(selectWorkouts(store.getState())).toHaveLength(1);
  });

  it('starts empty when storage is corrupt', async () => {
    const storage = memoryStorage({ [STATE_STORAGE_KEY]: '{not json' });
    const store = await createAppStore({ storage, tokenStorage: memoryTokenStorage('t'), now: () => new Date() });
    expect(store.getState().session.user).toBeNull();
  });

  it('wipes local data, storage and token on sign-out', async () => {
    const { store, deps } = setup();
    store.dispatch(hydrated());
    store.dispatch(connectivityChanged(false));
    saveWorkout(store);
    await deps.storage.setItem(STATE_STORAGE_KEY, '{}');
    store.dispatch(signOut());
    expect(selectWorkouts(store.getState())).toHaveLength(0);
    expect(store.getState().outbox.items).toHaveLength(0);
    expect(store.getState().sync.online).toBe(false); // connectivity knowledge survives
    await vi.waitFor(async () => {
      expect(await deps.tokenStorage.get()).toBeNull();
      expect(await deps.storage.getItem(STATE_STORAGE_KEY)).toBeNull();
    });
  });
});
