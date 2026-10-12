import type { ProfileUpdate, User } from '@fittrack/shared';
import { toIso, type Queryable } from '../db/pool';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  step_goal: number;
  weekly_workout_goal: number;
  is_demo: boolean;
  created_at: Date;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    stepGoal: row.step_goal,
    weeklyWorkoutGoal: row.weekly_workout_goal,
    isDemo: row.is_demo,
    createdAt: toIso(row.created_at)!,
  };
}

/** Returns null when the email is already registered. */
export async function createUser(
  db: Queryable,
  input: { email: string; passwordHash: string; displayName: string; isDemo?: boolean },
): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (email, password_hash, display_name, is_demo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [input.email, input.passwordHash, input.displayName, input.isDemo ?? false],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserByEmail(
  db: Queryable,
  email: string,
): Promise<(User & { passwordHash: string }) | null> {
  const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}

export async function findUserById(db: Queryable, id: string): Promise<User | null> {
  const { rows } = await db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function updateUser(
  db: Queryable,
  id: string,
  patch: ProfileUpdate,
): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `UPDATE users SET
       display_name = COALESCE($2, display_name),
       step_goal = COALESCE($3, step_goal),
       weekly_workout_goal = COALESCE($4, weekly_workout_goal)
     WHERE id = $1
     RETURNING *`,
    [id, patch.displayName ?? null, patch.stepGoal ?? null, patch.weeklyWorkoutGoal ?? null],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function deleteUser(db: Queryable, id: string): Promise<void> {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
}

/** Demo accounts are throwaway sandboxes; remove expired ones (cascades to their data). */
export async function purgeExpiredDemoUsers(db: Queryable, ttlHours: number): Promise<number> {
  const { rowCount } = await db.query(
    `DELETE FROM users WHERE is_demo AND created_at < now() - $1::double precision * interval '1 hour'`,
    [ttlHours],
  );
  return rowCount ?? 0;
}
