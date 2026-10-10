/**
 * Ordered, append-only schema migrations. Embedded as strings so the bundled build has no
 * loose .sql files to copy. Never edit an applied migration — add a new one.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_init',
    sql: /* sql */ `
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        display_name text NOT NULL,
        step_goal integer NOT NULL DEFAULT 8000 CHECK (step_goal BETWEEN 1000 AND 100000),
        weekly_workout_goal integer NOT NULL DEFAULT 3 CHECK (weekly_workout_goal BETWEEN 1 AND 14),
        is_demo boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX users_demo_created_idx ON users (created_at) WHERE is_demo;

      CREATE TABLE exercises (
        id text PRIMARY KEY,
        name text NOT NULL,
        muscle_group text NOT NULL,
        equipment text NOT NULL,
        bodyweight boolean NOT NULL
      );

      -- Routines are templates read and written whole, so their exercises live in JSONB
      -- (validated by the shared Zod schema at the API boundary).
      CREATE TABLE routines (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        name text NOT NULL,
        notes text NOT NULL DEFAULT '',
        exercises jsonb NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz,
        server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      CREATE INDEX routines_user_sync_idx ON routines (user_id, server_updated_at);

      -- updated_at is the client's edit time (last-write-wins); server_updated_at is the
      -- server's write time and drives incremental pulls.
      CREATE TABLE workouts (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        routine_id uuid,
        name text NOT NULL,
        started_at timestamptz NOT NULL,
        duration_min integer CHECK (duration_min >= 0),
        notes text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL,
        deleted_at timestamptz,
        server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      CREATE INDEX workouts_user_sync_idx ON workouts (user_id, server_updated_at);
      CREATE INDEX workouts_user_started_idx ON workouts (user_id, started_at DESC) WHERE deleted_at IS NULL;

      CREATE TABLE workout_sets (
        workout_id uuid NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
        id uuid NOT NULL,
        exercise_id text NOT NULL REFERENCES exercises (id),
        exercise_order smallint NOT NULL,
        set_order smallint NOT NULL,
        reps integer NOT NULL CHECK (reps >= 0),
        weight_kg numeric(6, 2) NOT NULL CHECK (weight_kg >= 0),
        PRIMARY KEY (workout_id, id)
      );
      CREATE INDEX workout_sets_exercise_idx ON workout_sets (exercise_id, workout_id);

      CREATE TABLE activity_daily (
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        day date NOT NULL,
        steps integer NOT NULL CHECK (steps >= 0),
        active_minutes integer NOT NULL CHECK (active_minutes >= 0),
        energy_kcal integer NOT NULL CHECK (energy_kcal >= 0),
        source text NOT NULL,
        server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY (user_id, day)
      );
      CREATE INDEX activity_user_sync_idx ON activity_daily (user_id, server_updated_at);
    `,
  },
];
