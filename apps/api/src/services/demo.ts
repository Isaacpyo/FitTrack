import { randomUUID } from 'node:crypto';
import { generateDemoData, toDateKeyAtOffset, type DateKey, type User } from '@fittrack/shared';
import type pg from 'pg';
import { withTransaction } from '../db/pool';
import { upsertActivity } from '../repos/activity';
import { insertRoutines } from '../repos/routines';
import { createUser, purgeExpiredDemoUsers } from '../repos/users';
import { insertWorkouts } from '../repos/workouts';

export interface DemoOptions {
  ttlHours: number;
  /** Visitor's local day; derived from the offset when omitted. */
  today?: DateKey;
  /** Minutes east of UTC. */
  utcOffsetMinutes?: number;
  now?: Date;
}

/**
 * Create a private, throwaway demo account populated with ~10 weeks of history relative to the
 * visitor's "today". Each visitor gets their own sandbox, so edits never leak between visitors.
 * Expired demo accounts are purged opportunistically on each call — no cron job needed.
 */
export async function createDemoUser(pool: pg.Pool, opts: DemoOptions): Promise<User> {
  const now = opts.now ?? new Date();
  const offset = opts.utcOffsetMinutes ?? 0;
  const today = opts.today ?? toDateKeyAtOffset(now, offset);
  const localMinutes =
    (((now.getUTCHours() * 60 + now.getUTCMinutes() + offset) % 1440) + 1440) % 1440;

  await purgeExpiredDemoUsers(pool, opts.ttlHours);

  return withTransaction(pool, async (client) => {
    const user = await createUser(client, {
      email: `demo-${randomUUID()}@demo.fittrack.app`,
      // Not a valid scrypt hash, so nobody can sign in to a demo account with a password.
      passwordHash: '!demo-account',
      displayName: 'Demo Athlete',
      isDemo: true,
    });
    if (!user) throw new Error('Failed to create demo user');

    const data = generateDemoData({
      today,
      utcOffsetMinutes: offset,
      dayFraction: localMinutes / 1440,
      newId: randomUUID,
      now: now.toISOString(),
    });
    await insertRoutines(client, user.id, data.routines);
    await insertWorkouts(client, user.id, data.workouts);
    await upsertActivity(client, user.id, data.activity);
    return user;
  });
}
