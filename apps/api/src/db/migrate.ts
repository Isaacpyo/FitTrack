import { EXERCISES } from '@fittrack/shared';
import type pg from 'pg';
import { withTransaction } from './pool';
import { MIGRATIONS } from './migrations';

// Arbitrary constant: serialises concurrent migrators (e.g. two instances booting at once).
const MIGRATION_LOCK_ID = 727_001;

/** Apply pending migrations and sync the exercise catalog. Safe to run on every boot. */
export async function migrate(
  pool: pg.Pool,
  log: (msg: string) => void = () => undefined,
): Promise<void> {
  await withTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.id));

    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;
      log(`Applying migration ${m.id}`);
      await client.query(m.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
    }

    await client.query(
      `INSERT INTO exercises (id, name, muscle_group, equipment, bodyweight)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::boolean[])
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         muscle_group = EXCLUDED.muscle_group,
         equipment = EXCLUDED.equipment,
         bodyweight = EXCLUDED.bodyweight`,
      [
        EXERCISES.map((e) => e.id),
        EXERCISES.map((e) => e.name),
        EXERCISES.map((e) => e.muscleGroup),
        EXERCISES.map((e) => e.equipment),
        EXERCISES.map((e) => e.bodyweight),
      ],
    );
  });
}
