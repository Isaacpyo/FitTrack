import { loadConfig } from '../config';
import { migrate } from './migrate';
import { createPool } from './pool';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
try {
  await migrate(pool, (msg) => console.log(msg));
  console.log('Database is up to date.');
} finally {
  await pool.end();
}
