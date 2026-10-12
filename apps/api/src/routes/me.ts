import { profileUpdateSchema } from '@fittrack/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { notFound, parse } from '../errors';
import { deleteUser, findUserById, updateUser } from '../repos/users';

export async function meRoutes(app: FastifyInstance, { pool }: { pool: pg.Pool }) {
  app.get('/me', async (request) => {
    const user = await findUserById(pool, request.userId);
    if (!user) throw notFound('User not found');
    return user;
  });

  app.patch('/me', async (request) => {
    const patch = parse(profileUpdateSchema, request.body);
    const user = await updateUser(pool, request.userId, patch);
    if (!user) throw notFound('User not found');
    return user;
  });

  /** Account deletion removes every row the user owns (ON DELETE CASCADE). */
  app.delete('/me', async (request, reply) => {
    await deleteUser(pool, request.userId);
    return reply.code(204).send();
  });
}
