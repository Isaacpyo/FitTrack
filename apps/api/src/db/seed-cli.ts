import { randomUUID } from 'node:crypto';
import { generateDemoData, toDateKey } from '@fittrack/shared';
import { hashPassword } from '../auth/password';
import { loadConfig } from '../config';
import { upsertActivity } from '../repos/activity';
import { insertRoutines } from '../repos/routines';
import { createUser } from '../repos/users';
import { insertWorkouts } from '../repos/workouts';
import { migrate } from './migrate';
import { createPool, withTransaction } from './pool';

/**
 * Local development seed: (re)creates a fixed account with fresh demo history.
 * The one-click "Try the demo" button does not need this — it creates its own sandbox.
 */
export const SEED_EMAIL = 'demo@fittrack.dev';
export const SEED_PASSWORD = 'demo-password';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
try {
  await migrate(pool, (msg) => console.log(msg));
  await withTransaction(pool, async (client) => {
    await client.query('DELETE FROM users WHERE email = $1', [SEED_EMAIL]);
    const user = await createUser(client, {
      email: SEED_EMAIL,
      passwordHash: await hashPassword(SEED_PASSWORD),
      displayName: 'Sam Lifter',
    });
    if (!user) throw new Error('Could not create seed user');
    const now = new Date();
    const data = generateDemoData({
      today: toDateKey(now),
      utcOffsetMinutes: -now.getTimezoneOffset(),
      dayFraction: (now.getHours() * 60 + now.getMinutes()) / 1440,
      newId: randomUUID,
      now: now.toISOString(),
    });
    await insertRoutines(client, user.id, data.routines);
    await insertWorkouts(client, user.id, data.workouts);
    await upsertActivity(client, user.id, data.activity);
    console.log(`Seeded ${SEED_EMAIL} / ${SEED_PASSWORD} with ${data.workouts.length} workouts.`);
  });
} finally {
  await pool.end();
}
