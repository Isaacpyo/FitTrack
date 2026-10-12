import type { ActivitySource, DailyActivity } from '@fittrack/shared';
import type { Queryable } from '../db/pool';
import { PULL_OVERLAP_SECONDS } from './workouts';

interface ActivityRow {
  day: string;
  steps: number;
  active_minutes: number;
  energy_kcal: number;
  source: ActivitySource;
}

const toActivity = (r: ActivityRow): DailyActivity => ({
  date: r.day,
  steps: r.steps,
  activeMinutes: r.active_minutes,
  energyKcal: r.energy_kcal,
  source: r.source,
});

/** Upsert one row per day. Unchanged days are left alone so they don't re-sync to other devices. */
export async function upsertActivity(
  db: Queryable,
  userId: string,
  days: DailyActivity[],
): Promise<number> {
  const { rowCount } = await db.query(
    `INSERT INTO activity_daily (user_id, day, steps, active_minutes, energy_kcal, source)
     SELECT $1, * FROM unnest($2::date[], $3::int[], $4::int[], $5::int[], $6::text[])
     ON CONFLICT (user_id, day) DO UPDATE SET
       steps = EXCLUDED.steps,
       active_minutes = EXCLUDED.active_minutes,
       energy_kcal = EXCLUDED.energy_kcal,
       source = EXCLUDED.source,
       server_updated_at = clock_timestamp()
     WHERE (activity_daily.steps, activity_daily.active_minutes, activity_daily.energy_kcal, activity_daily.source)
       IS DISTINCT FROM (EXCLUDED.steps, EXCLUDED.active_minutes, EXCLUDED.energy_kcal, EXCLUDED.source)`,
    [
      userId,
      days.map((d) => d.date),
      days.map((d) => d.steps),
      days.map((d) => d.activeMinutes),
      days.map((d) => d.energyKcal),
      days.map((d) => d.source),
    ],
  );
  return rowCount ?? 0;
}

export async function activityChangedSince(
  db: Queryable,
  userId: string,
  since: string | null,
): Promise<DailyActivity[]> {
  const { rows } = await db.query<ActivityRow>(
    `SELECT day, steps, active_minutes, energy_kcal, source FROM activity_daily
     WHERE user_id = $1
       AND ($2::timestamptz IS NULL
            OR server_updated_at > $2::timestamptz - make_interval(secs => ${PULL_OVERLAP_SECONDS}))
     ORDER BY day`,
    [userId, since],
  );
  return rows.map(toActivity);
}
