import { randomUUID } from 'node:crypto';
import type { AuthResponse, WorkoutInput } from '@fittrack/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createPool } from '../src/db/pool';
import { TEST_DATABASE_URL } from './db-url';

export interface TestContext {
  app: FastifyInstance;
  pool: pg.Pool;
}

/** Spin up the real app against the test database; tables are truncated before each test. */
export function useTestApp(env: Record<string, string> = {}): TestContext {
  const ctx = {} as TestContext;
  beforeAll(async () => {
    ctx.pool = createPool(TEST_DATABASE_URL);
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      CORS_ORIGINS: 'https://fittrack.example.com,https://*.netlify.app',
      AUTH_RATE_LIMIT_PER_MINUTE: '1000',
      DEMO_RATE_LIMIT_PER_HOUR: '1000',
      ...env,
    });
    ctx.app = await buildApp({ config, pool: ctx.pool });
  });
  beforeEach(async () => {
    await ctx.pool.query('TRUNCATE users CASCADE');
  });
  afterAll(async () => {
    await ctx.app?.close();
    await ctx.pool?.end();
  });
  return ctx;
}

export async function signUp(
  app: FastifyInstance,
  email = `user-${randomUUID().slice(0, 8)}@example.com`,
): Promise<AuthResponse & { auth: { authorization: string } }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: { email, password: 'correct horse battery', displayName: 'Test User' },
  });
  if (res.statusCode !== 201) throw new Error(`signup failed: ${res.statusCode} ${res.body}`);
  const body = res.json<AuthResponse>();
  return { ...body, auth: { authorization: `Bearer ${body.token}` } };
}

export function makeWorkout(overrides: Partial<WorkoutInput> = {}): WorkoutInput {
  return {
    id: randomUUID(),
    name: 'Push Day',
    startedAt: '2026-10-09T18:00:00.000Z',
    durationMin: 60,
    notes: '',
    routineId: null,
    updatedAt: '2026-10-09T19:00:00.000Z',
    exercises: [
      {
        exerciseId: 'bench-press',
        sets: [
          { id: randomUUID(), reps: 5, weightKg: 80 },
          { id: randomUUID(), reps: 5, weightKg: 82.5 },
        ],
      },
      { exerciseId: 'pull-up', sets: [{ id: randomUUID(), reps: 10, weightKg: 0 }] },
    ],
    ...overrides,
  };
}
