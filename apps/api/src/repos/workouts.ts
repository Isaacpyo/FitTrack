import type { UpsertResult, Workout, WorkoutExercise, WorkoutInput } from '@fittrack/shared';
import type pg from 'pg';
import { notFound } from '../errors';
import { toIso, withTransaction, type Queryable } from '../db/pool';

/**
 * Pulls overlap by this much so a write whose transaction committed slightly after a pull
 * started (with an earlier clock_timestamp) is never skipped. Re-sent rows merge idempotently.
 */
export const PULL_OVERLAP_SECONDS = 60;

interface WorkoutRow {
  id: string;
  user_id: string;
  routine_id: string | null;
  name: string;
  started_at: Date;
  duration_min: number | null;
  notes: string;
  updated_at: Date;
  deleted_at: Date | null;
  sets: { id: string; exerciseId: string; exerciseOrder: number; reps: number; weightKg: number }[];
}

const SELECT_WORKOUTS = /* sql */ `
  SELECT w.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id', s.id, 'exerciseId', s.exercise_id, 'exerciseOrder', s.exercise_order,
          'reps', s.reps, 'weightKg', s.weight_kg
        ) ORDER BY s.exercise_order, s.set_order
      ) FILTER (WHERE s.id IS NOT NULL),
      '[]'::json
    ) AS sets
  FROM workouts w
  LEFT JOIN workout_sets s ON s.workout_id = w.id`;

function toWorkout(row: WorkoutRow): Workout {
  const exercises: WorkoutExercise[] = [];
  let order = -1;
  for (const s of row.sets) {
    if (s.exerciseOrder !== order) {
      exercises.push({ exerciseId: s.exerciseId, sets: [] });
      order = s.exerciseOrder;
    }
    exercises[exercises.length - 1]!.sets.push({
      id: s.id,
      reps: s.reps,
      weightKg: Number(s.weightKg),
    });
  }
  return {
    id: row.id,
    name: row.name,
    startedAt: toIso(row.started_at)!,
    durationMin: row.duration_min,
    notes: row.notes,
    routineId: row.routine_id,
    exercises,
    updatedAt: toIso(row.updated_at)!,
    deletedAt: toIso(row.deleted_at),
  };
}

async function findWorkout(
  db: Queryable,
  id: string,
): Promise<{ userId: string; workout: Workout } | null> {
  const { rows } = await db.query<WorkoutRow>(`${SELECT_WORKOUTS} WHERE w.id = $1 GROUP BY w.id`, [
    id,
  ]);
  return rows[0] ? { userId: rows[0].user_id, workout: toWorkout(rows[0]) } : null;
}

async function insertSets(
  db: Queryable,
  workouts: Pick<WorkoutInput, 'id' | 'exercises'>[],
): Promise<void> {
  const cols = {
    workoutId: [] as string[],
    id: [] as string[],
    exerciseId: [] as string[],
    exerciseOrder: [] as number[],
    setOrder: [] as number[],
    reps: [] as number[],
    weightKg: [] as number[],
  };
  for (const w of workouts) {
    w.exercises.forEach((ex, exerciseOrder) =>
      ex.sets.forEach((set, setOrder) => {
        cols.workoutId.push(w.id);
        cols.id.push(set.id);
        cols.exerciseId.push(ex.exerciseId);
        cols.exerciseOrder.push(exerciseOrder);
        cols.setOrder.push(setOrder);
        cols.reps.push(set.reps);
        cols.weightKg.push(set.weightKg);
      }),
    );
  }
  if (cols.id.length === 0) return;
  await db.query(
    `INSERT INTO workout_sets (workout_id, id, exercise_id, exercise_order, set_order, reps, weight_kg)
     SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::text[], $4::smallint[], $5::smallint[], $6::int[], $7::numeric[])`,
    Object.values(cols),
  );
}

/**
 * Idempotent last-write-wins upsert. Returns `applied: false` with the stored copy when the
 * server already has a newer edit. A workout id owned by another user is reported as 404.
 */
export async function upsertWorkout(
  pool: pg.Pool,
  userId: string,
  input: WorkoutInput,
): Promise<UpsertResult<Workout>> {
  return withTransaction(pool, async (client) => {
    const { rowCount } = await client.query(
      `INSERT INTO workouts (id, user_id, routine_id, name, started_at, duration_min, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         routine_id = EXCLUDED.routine_id,
         name = EXCLUDED.name,
         started_at = EXCLUDED.started_at,
         duration_min = EXCLUDED.duration_min,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at,
         deleted_at = NULL,
         server_updated_at = clock_timestamp()
       WHERE workouts.user_id = EXCLUDED.user_id AND workouts.updated_at <= EXCLUDED.updated_at`,
      [
        input.id,
        userId,
        input.routineId,
        input.name,
        input.startedAt,
        input.durationMin,
        input.notes,
        input.updatedAt,
      ],
    );

    if (rowCount === 0) {
      const existing = await findWorkout(client, input.id);
      if (!existing || existing.userId !== userId) throw notFound('Workout not found');
      return { applied: false, item: existing.workout };
    }

    await client.query('DELETE FROM workout_sets WHERE workout_id = $1', [input.id]);
    await insertSets(client, [input]);
    const saved = await findWorkout(client, input.id);
    return { applied: true, item: saved!.workout };
  });
}

/** Soft delete (tombstone) so the deletion reaches the user's other devices on their next pull. */
export async function deleteWorkout(
  pool: pg.Pool,
  userId: string,
  id: string,
  deletedAt: string,
): Promise<void> {
  await withTransaction(pool, async (client) => {
    const { rowCount } = await client.query(
      `UPDATE workouts
       SET deleted_at = $3, updated_at = $3, server_updated_at = clock_timestamp()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND updated_at <= $3`,
      [id, userId, deletedAt],
    );
    if (rowCount) await client.query('DELETE FROM workout_sets WHERE workout_id = $1', [id]);
  });
}

export async function workoutsChangedSince(
  db: Queryable,
  userId: string,
  since: string | null,
): Promise<Workout[]> {
  const { rows } = await db.query<WorkoutRow>(
    `${SELECT_WORKOUTS}
     WHERE w.user_id = $1
       AND ($2::timestamptz IS NULL
            OR w.server_updated_at > $2::timestamptz - make_interval(secs => ${PULL_OVERLAP_SECONDS}))
       AND ($2::timestamptz IS NOT NULL OR w.deleted_at IS NULL)
     GROUP BY w.id
     ORDER BY w.started_at`,
    [userId, since],
  );
  return rows.map(toWorkout);
}

/** Bulk insert for seeding (demo accounts). */
export async function insertWorkouts(
  db: Queryable,
  userId: string,
  workouts: WorkoutInput[],
): Promise<void> {
  if (workouts.length === 0) return;
  await db.query(
    `INSERT INTO workouts (id, user_id, routine_id, name, started_at, duration_min, notes, updated_at)
     SELECT id, $1, routine_id, name, started_at, duration_min, notes, updated_at
     FROM unnest($2::uuid[], $3::uuid[], $4::text[], $5::timestamptz[], $6::int[], $7::text[], $8::timestamptz[])
       AS t(id, routine_id, name, started_at, duration_min, notes, updated_at)`,
    [
      userId,
      workouts.map((w) => w.id),
      workouts.map((w) => w.routineId),
      workouts.map((w) => w.name),
      workouts.map((w) => w.startedAt),
      workouts.map((w) => w.durationMin),
      workouts.map((w) => w.notes),
      workouts.map((w) => w.updatedAt),
    ],
  );
  await insertSets(db, workouts);
}
