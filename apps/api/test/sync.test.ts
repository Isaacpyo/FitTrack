import { randomUUID } from 'node:crypto';
import type { Routine, SyncChangesResponse, UpsertResult, Workout } from '@fittrack/shared';
import { describe, expect, it } from 'vitest';
import { makeWorkout, signUp, useTestApp } from './helpers';

describe('workouts (offline sync contract)', () => {
  const ctx = useTestApp();

  type Auth = Record<string, string>;
  const put = (auth: Auth, w: { id: string } & Record<string, unknown>) =>
    ctx.app.inject({ method: 'PUT', url: `/workouts/${w.id}`, headers: auth, payload: w });
  const pull = async (auth: Auth, since?: string) =>
    (
      await ctx.app.inject({
        url: `/sync/changes${since ? `?since=${encodeURIComponent(since)}` : ''}`,
        headers: auth,
      })
    ).json<SyncChangesResponse>();

  it('creates a workout and returns it, sets in order, on the next pull', async () => {
    const { auth } = await signUp(ctx.app);
    const w = makeWorkout();
    const res = await put(auth, w);
    expect(res.statusCode).toBe(200);
    expect(res.json<UpsertResult<Workout>>()).toMatchObject({
      applied: true,
      item: { id: w.id, deletedAt: null },
    });

    const { workouts } = await pull(auth);
    expect(workouts).toHaveLength(1);
    expect(workouts[0]!.exercises).toEqual(w.exercises);
  });

  it('is idempotent when the same write is retried', async () => {
    const { auth } = await signUp(ctx.app);
    const w = makeWorkout();
    await put(auth, w);
    const retry = await put(auth, w);
    expect(retry.json<UpsertResult<Workout>>().applied).toBe(true);
    expect((await pull(auth)).workouts).toHaveLength(1);
  });

  it('applies last-write-wins on the client edit time', async () => {
    const { auth } = await signUp(ctx.app);
    const w = makeWorkout();
    await put(auth, w);

    const newer = {
      ...w,
      name: 'Heavy Push',
      updatedAt: '2026-10-09T20:00:00.000Z',
      exercises: [w.exercises[0]!],
    };
    expect((await put(auth, newer)).json<UpsertResult<Workout>>().applied).toBe(true);

    const stale = { ...w, name: 'Stale edit', updatedAt: '2026-10-09T19:30:00.000Z' };
    const res = (await put(auth, stale)).json<UpsertResult<Workout>>();
    expect(res.applied).toBe(false);
    expect(res.item.name).toBe('Heavy Push');
    expect(res.item.exercises).toHaveLength(1);
  });

  it('never lets one user overwrite another user’s workout id', async () => {
    const alice = await signUp(ctx.app);
    const mallory = await signUp(ctx.app);
    const w = makeWorkout();
    await put(alice.auth, w);

    const hijack = await put(mallory.auth, {
      ...w,
      name: 'pwned',
      updatedAt: '2030-01-01T00:00:00.000Z',
    });
    expect(hijack.statusCode).toBe(404);
    expect((await pull(alice.auth)).workouts[0]!.name).toBe('Push Day');
    expect((await pull(mallory.auth)).workouts).toHaveLength(0);

    await ctx.app.inject({ method: 'DELETE', url: `/workouts/${w.id}`, headers: mallory.auth });
    expect((await pull(alice.auth)).workouts[0]!.deletedAt).toBeNull();
  });

  it('validates the body at the boundary', async () => {
    const { auth } = await signUp(ctx.app);
    const w = makeWorkout();
    const mismatch = await ctx.app.inject({
      method: 'PUT',
      url: `/workouts/${randomUUID()}`,
      headers: auth,
      payload: w,
    });
    expect(mismatch.statusCode).toBe(400);

    const unknown = makeWorkout({
      exercises: [{ exerciseId: 'moon-press', sets: [{ id: randomUUID(), reps: 1, weightKg: 1 }] }],
    });
    const res = await put(auth, unknown);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Unknown exercise');

    const badId = await ctx.app.inject({
      method: 'DELETE',
      url: '/workouts/not-a-uuid',
      headers: auth,
    });
    expect(badId.statusCode).toBe(400);
  });

  it('propagates deletes as tombstones in incremental pulls only', async () => {
    const { auth } = await signUp(ctx.app);
    const w = makeWorkout();
    await put(auth, w);
    const { serverTime } = await pull(auth);

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/workouts/${w.id}?deletedAt=2026-10-10T08:00:00.000Z`,
      headers: auth,
    });
    expect(del.statusCode).toBe(204);
    // Deleting twice is fine (retries).
    expect(
      (await ctx.app.inject({ method: 'DELETE', url: `/workouts/${w.id}`, headers: auth }))
        .statusCode,
    ).toBe(204);

    const incremental = await pull(auth, serverTime);
    expect(incremental.workouts).toEqual([
      expect.objectContaining({ id: w.id, deletedAt: '2026-10-10T08:00:00.000Z' }),
    ]);
    expect((await pull(auth)).workouts).toHaveLength(0);
  });

  it('ignores a delete that is older than the latest edit', async () => {
    const { auth } = await signUp(ctx.app);
    const w = makeWorkout({ updatedAt: '2026-10-10T12:00:00.000Z' });
    await put(auth, w);
    await ctx.app.inject({
      method: 'DELETE',
      url: `/workouts/${w.id}?deletedAt=2026-10-10T09:00:00.000Z`,
      headers: auth,
    });
    expect((await pull(auth)).workouts).toHaveLength(1);
  });

  it('only returns rows changed since the cursor (with a small safety overlap)', async () => {
    const { auth, user } = await signUp(ctx.app);
    const old = makeWorkout();
    await put(auth, old);
    await ctx.pool.query(
      `UPDATE workouts SET server_updated_at = now() - interval '10 minutes' WHERE user_id = $1`,
      [user.id],
    );
    const cursor = new Date(Date.now() - 5 * 60_000).toISOString();

    const fresh = makeWorkout();
    await put(auth, fresh);
    expect((await pull(auth, cursor)).workouts.map((w) => w.id)).toEqual([fresh.id]);
  });
});

describe('routines and activity', () => {
  const ctx = useTestApp();

  it('upserts and deletes routines with last-write-wins', async () => {
    const { auth } = await signUp(ctx.app);
    const routine = {
      id: randomUUID(),
      name: 'Upper',
      notes: '',
      updatedAt: '2026-10-10T10:00:00.000Z',
      exercises: [{ exerciseId: 'bench-press', targetSets: 3, targetReps: 8, targetWeightKg: 70 }],
    };
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/routines/${routine.id}`,
      headers: auth,
      payload: routine,
    });
    expect(res.json<UpsertResult<Routine>>()).toMatchObject({
      applied: true,
      item: { name: 'Upper' },
    });

    const stale = await ctx.app.inject({
      method: 'PUT',
      url: `/routines/${routine.id}`,
      headers: auth,
      payload: { ...routine, name: 'Old', updatedAt: '2026-10-10T09:00:00.000Z' },
    });
    expect(stale.json<UpsertResult<Routine>>()).toMatchObject({
      applied: false,
      item: { name: 'Upper' },
    });

    await ctx.app.inject({ method: 'DELETE', url: `/routines/${routine.id}`, headers: auth });
    const sync = (
      await ctx.app.inject({ url: '/sync/changes', headers: auth })
    ).json<SyncChangesResponse>();
    expect(sync.routines).toHaveLength(0);
  });

  it('upserts daily activity and skips unchanged days', async () => {
    const { auth } = await signUp(ctx.app);
    const days = [
      { date: '2026-10-09', steps: 9000, activeMinutes: 40, energyKcal: 420, source: 'mock' },
      { date: '2026-10-10', steps: 4000, activeMinutes: 15, energyKcal: 200, source: 'mock' },
    ];
    const first = await ctx.app.inject({
      method: 'PUT',
      url: '/activity',
      headers: auth,
      payload: { days },
    });
    expect(first.json()).toEqual({ updated: 2 });

    const changed = [days[0], { ...days[1], steps: 6500 }];
    const second = await ctx.app.inject({
      method: 'PUT',
      url: '/activity',
      headers: auth,
      payload: { days: changed },
    });
    expect(second.json()).toEqual({ updated: 1 });

    const dupes = await ctx.app.inject({
      method: 'PUT',
      url: '/activity',
      headers: auth,
      payload: { days: [days[0], days[0]] },
    });
    expect(dupes.statusCode).toBe(400);
  });
});

describe('platform', () => {
  const ctx = useTestApp();

  it('reports health', async () => {
    const res = await ctx.app.inject({ url: '/healthz' });
    expect(res.json()).toEqual({ ok: true, db: 'up' });
  });

  it('serves the exercise catalog', async () => {
    const res = await ctx.app.inject({ url: '/exercises' });
    expect(res.json<{ id: string }[]>().some((e) => e.id === 'bench-press')).toBe(true);
  });

  it('allows configured browser origins only', async () => {
    const allowed = await ctx.app.inject({
      url: '/healthz',
      headers: { origin: 'https://fittrack.example.com' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://fittrack.example.com');
    const preview = await ctx.app.inject({
      url: '/healthz',
      headers: { origin: 'https://deploy-preview-3--fittrack.netlify.app' },
    });
    expect(preview.headers['access-control-allow-origin']).toBe(
      'https://deploy-preview-3--fittrack.netlify.app',
    );
    const evil = await ctx.app.inject({
      url: '/healthz',
      headers: { origin: 'https://evil.example.com' },
    });
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns JSON errors for unknown routes', async () => {
    const res = await ctx.app.inject({ url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });
});
