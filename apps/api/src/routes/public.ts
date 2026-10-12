import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

export async function publicRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  app.get('/', async () => ({
    name: 'FitTrack API',
    health: '/healthz',
    source: 'https://github.com/temitopeagbola/FitTrack',
  }));

  /** Liveness + DB check. The app also pings this on launch to wake a sleeping free-tier instance. */
  app.get('/healthz', { config: { rateLimit: false } }, async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { ok: true, db: 'up' };
    } catch {
      return reply.code(503).send({ ok: false, db: 'down' });
    }
  });

  app.get('/exercises', async () => {
    const { rows } = await pool.query(
      `SELECT id, name, muscle_group AS "muscleGroup", equipment, bodyweight FROM exercises ORDER BY name`,
    );
    return rows;
  });
}
