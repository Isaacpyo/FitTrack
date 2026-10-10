import type { Routine, RoutineExercise, RoutineInput, UpsertResult } from '@fittrack/shared';
import { notFound } from '../errors';
import { toIso, type Queryable } from '../db/pool';
import { PULL_OVERLAP_SECONDS } from './workouts';

interface RoutineRow {
  id: string;
  user_id: string;
  name: string;
  notes: string;
  exercises: RoutineExercise[];
  updated_at: Date;
  deleted_at: Date | null;
}

function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    exercises: row.exercises,
    updatedAt: toIso(row.updated_at)!,
    deletedAt: toIso(row.deleted_at),
  };
}

/** Last-write-wins upsert; see upsertWorkout for the semantics. */
export async function upsertRoutine(
  db: Queryable,
  userId: string,
  input: RoutineInput,
): Promise<UpsertResult<Routine>> {
  const { rows } = await db.query<RoutineRow>(
    `INSERT INTO routines (id, user_id, name, notes, exercises, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       notes = EXCLUDED.notes,
       exercises = EXCLUDED.exercises,
       updated_at = EXCLUDED.updated_at,
       deleted_at = NULL,
       server_updated_at = clock_timestamp()
     WHERE routines.user_id = EXCLUDED.user_id AND routines.updated_at <= EXCLUDED.updated_at
     RETURNING *`,
    [input.id, userId, input.name, input.notes, JSON.stringify(input.exercises), input.updatedAt],
  );
  if (rows[0]) return { applied: true, item: toRoutine(rows[0]) };

  const existing = await db.query<RoutineRow>('SELECT * FROM routines WHERE id = $1', [input.id]);
  const row = existing.rows[0];
  if (!row || row.user_id !== userId) throw notFound('Routine not found');
  return { applied: false, item: toRoutine(row) };
}

export async function deleteRoutine(
  db: Queryable,
  userId: string,
  id: string,
  deletedAt: string,
): Promise<void> {
  await db.query(
    `UPDATE routines
     SET deleted_at = $3, updated_at = $3, server_updated_at = clock_timestamp()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND updated_at <= $3`,
    [id, userId, deletedAt],
  );
}

export async function routinesChangedSince(
  db: Queryable,
  userId: string,
  since: string | null,
): Promise<Routine[]> {
  const { rows } = await db.query<RoutineRow>(
    `SELECT * FROM routines
     WHERE user_id = $1
       AND ($2::timestamptz IS NULL
            OR server_updated_at > $2::timestamptz - make_interval(secs => ${PULL_OVERLAP_SECONDS}))
       AND ($2::timestamptz IS NOT NULL OR deleted_at IS NULL)
     ORDER BY name`,
    [userId, since],
  );
  return rows.map(toRoutine);
}

export async function insertRoutines(
  db: Queryable,
  userId: string,
  routines: RoutineInput[],
): Promise<void> {
  for (const r of routines) await upsertRoutine(db, userId, r);
}
