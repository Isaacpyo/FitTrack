import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockProvider } from '../src/health/mock';
import { syncHealthData } from '../src/health/sync';
import type { HealthProvider } from '../src/health/types';
import { memoryStorage, memoryTokenStorage } from '../src/lib/storage';
import { makeStore } from '../src/store';
import { connectivityChanged } from '../src/store/syncSlice';
import { FakeApi } from './fakeApi';
import { user } from './fixtures';

const now = () => new Date('2026-10-10T12:00:00.000Z');

function setup() {
  const store = makeStore(
    { storage: memoryStorage(), tokenStorage: memoryTokenStorage('t'), now },
    { session: { token: 't', user, expired: false } },
  );
  store.dispatch(connectivityChanged(false));
  return store;
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn(new FakeApi().fetch)));
afterEach(() => vi.unstubAllGlobals());

describe('mock health provider', () => {
  it('returns one day per date up to today, scaling today by the time of day', async () => {
    const days = await createMockProvider(now).getDailyActivity('2026-10-08', '2026-10-12');
    expect(days.map((d) => d.date)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
    expect(days.every((d) => d.source === 'mock')).toBe(true);
  });
});

describe('syncHealthData', () => {
  it('stores 30 days and queues them for upload', async () => {
    const store = setup();
    const ok = await store.dispatch(
      syncHealthData(createMockProvider(now), { requestPermission: true }),
    );
    expect(ok).toBe(true);
    const state = store.getState();
    expect(Object.keys(state.activity.byDate)).toHaveLength(30);
    expect(state.activity).toMatchObject({
      healthConnected: true,
      healthSyncing: false,
      lastHealthSyncAt: now().toISOString(),
    });
    expect(state.outbox.items.map((i) => i.kind)).toEqual(['activity.upsert']);
  });

  it('reports a declined permission without recording anything', async () => {
    const store = setup();
    const denied: HealthProvider = {
      ...createMockProvider(now),
      label: 'Apple Health',
      requestPermissions: async () => false,
    };
    expect(await store.dispatch(syncHealthData(denied, { requestPermission: true }))).toBe(false);
    expect(store.getState().activity.healthError).toBe(
      'Permission to read Apple Health was not granted.',
    );
    expect(store.getState().outbox.items).toHaveLength(0);
  });

  it('surfaces provider errors', async () => {
    const store = setup();
    const broken: HealthProvider = {
      ...createMockProvider(now),
      getDailyActivity: async () => {
        throw new Error('HealthKit is unavailable');
      },
    };
    await store.dispatch(syncHealthData(broken, { requestPermission: false }));
    expect(store.getState().activity).toMatchObject({
      healthSyncing: false,
      healthError: 'HealthKit is unavailable',
    });
  });
});
