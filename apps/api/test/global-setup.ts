import { migrate } from '../src/db/migrate';
import { createPool } from '../src/db/pool';
import { TEST_DATABASE_URL } from './db-url';

/** Migrate the test database once before the integration suites run. */
export default async function setup(): Promise<void> {
  const pool = createPool(TEST_DATABASE_URL);
  try {
    await migrate(pool);
  } catch (err) {
    throw new Error(
      `Could not migrate the test database at ${TEST_DATABASE_URL}. Start Postgres with ` +
        '`docker compose up -d db` (or set TEST_DATABASE_URL).\n' +
        String(err),
    );
  } finally {
    await pool.end();
  }
}
