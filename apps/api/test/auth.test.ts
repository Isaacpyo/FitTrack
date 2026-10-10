import type { AuthResponse, SyncChangesResponse, User } from '@fittrack/shared';
import { describe, expect, it } from 'vitest';
import { signUp, useTestApp } from './helpers';

describe('auth', () => {
  const ctx = useTestApp();

  it('signs up, normalising the email, and returns a working token', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: '  Alex@Example.com ',
        password: 'correct horse battery',
        displayName: 'Alex',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<AuthResponse>();
    expect(body.user).toMatchObject({
      email: 'alex@example.com',
      displayName: 'Alex',
      stepGoal: 8000,
      isDemo: false,
    });

    const me = await ctx.app.inject({
      url: '/me',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json<User>().id).toBe(body.user.id);
  });

  it('rejects duplicate emails and invalid input with field details', async () => {
    await signUp(ctx.app, 'sam@example.com');
    const dup = await ctx.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'SAM@example.com', password: 'another password', displayName: 'Sam' },
    });
    expect(dup.statusCode).toBe(409);

    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'nope', password: 'short', displayName: '' },
    });
    expect(bad.statusCode).toBe(400);
    const paths = bad
      .json<{ error: { details: { path: string }[] } }>()
      .error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password', 'displayName']));
  });

  it('logs in with the right password only, without revealing which emails exist', async () => {
    await signUp(ctx.app, 'kim@example.com');
    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'kim@example.com', password: 'correct horse battery' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<AuthResponse>().user).not.toHaveProperty('passwordHash');

    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'kim@example.com', password: 'wrong password' },
    });
    const unknown = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'wrong password' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it('protects private routes', async () => {
    expect((await ctx.app.inject({ url: '/me' })).statusCode).toBe(401);
    const forged = await ctx.app.inject({
      url: '/sync/changes',
      headers: { authorization: 'Bearer not.a.jwt' },
    });
    expect(forged.statusCode).toBe(401);
  });

  it('updates the profile with validation', async () => {
    const { auth } = await signUp(ctx.app);
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: auth,
      payload: { stepGoal: 10000 },
    });
    expect(res.json<User>().stepGoal).toBe(10000);
    const bad = await ctx.app.inject({
      method: 'PATCH',
      url: '/me',
      headers: auth,
      payload: { stepGoal: 5 },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('deletes the account and invalidates its token', async () => {
    const { auth } = await signUp(ctx.app);
    expect((await ctx.app.inject({ method: 'DELETE', url: '/me', headers: auth })).statusCode).toBe(
      204,
    );
    expect((await ctx.app.inject({ url: '/me', headers: auth })).statusCode).toBe(401);
  });
});

describe('demo accounts', () => {
  const ctx = useTestApp();

  it('creates a private sandbox seeded relative to the visitor’s day', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/demo',
      payload: { today: '2026-10-10', utcOffsetMinutes: 60 },
    });
    expect(res.statusCode).toBe(201);
    const { token, user } = res.json<AuthResponse>();
    expect(user.isDemo).toBe(true);

    const sync = await ctx.app.inject({
      url: '/sync/changes',
      headers: { authorization: `Bearer ${token}` },
    });
    const data = sync.json<SyncChangesResponse>();
    expect(data.routines.map((r) => r.name).sort()).toEqual(['Leg Day', 'Pull Day', 'Push Day']);
    expect(data.workouts.length).toBeGreaterThanOrEqual(25);
    expect(data.workouts.every((w) => w.exercises.length === 5)).toBe(true);
    expect(data.activity).toHaveLength(60);
    expect(data.activity.at(-1)?.date).toBe('2026-10-10');

    // Two visitors never share data.
    const other = (
      await ctx.app.inject({ method: 'POST', url: '/auth/demo', payload: {} })
    ).json<AuthResponse>();
    expect(other.user.id).not.toBe(user.id);
  });

  it('cannot be signed into with a password', async () => {
    const { user } = (
      await ctx.app.inject({ method: 'POST', url: '/auth/demo', payload: {} })
    ).json<AuthResponse>();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: '!demo-account' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('purges expired demo accounts and their data', async () => {
    const first = (
      await ctx.app.inject({ method: 'POST', url: '/auth/demo', payload: {} })
    ).json<AuthResponse>();
    await ctx.pool.query(
      `UPDATE users SET created_at = now() - interval '25 hours' WHERE id = $1`,
      [first.user.id],
    );
    await ctx.app.inject({ method: 'POST', url: '/auth/demo', payload: {} });

    const { rows } = await ctx.pool.query(
      'SELECT count(*)::int AS n FROM workouts WHERE user_id = $1',
      [first.user.id],
    );
    expect(rows[0].n).toBe(0);
    const me = await ctx.app.inject({
      url: '/me',
      headers: { authorization: `Bearer ${first.token}` },
    });
    expect(me.statusCode).toBe(401);
  });
});
