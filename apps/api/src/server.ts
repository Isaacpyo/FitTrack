import { buildApp } from './app';
import { loadConfig } from './config';
import { migrate } from './db/migrate';
import { createPool } from './db/pool';

const config = loadConfig();
const pool = createPool(config.databaseUrl, config.databasePoolMax);

if (config.runMigrations) {
  await migrate(pool, (msg) => console.log(msg));
}

const app = await buildApp({ config, pool });
await app.listen({ host: config.host, port: config.port });

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
