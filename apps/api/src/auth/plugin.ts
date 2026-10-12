import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { unauthorized } from '../errors';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    signToken(userId: string): string;
  }
  interface FastifyRequest {
    userId: string;
  }
}

export async function registerAuth(
  app: FastifyInstance,
  opts: { secret: string; expiresIn: string; pool: pg.Pool },
): Promise<void> {
  await app.register(fastifyJwt, { secret: opts.secret, sign: { expiresIn: opts.expiresIn } });
  app.decorate('signToken', (userId: string) => app.jwt.sign({ sub: userId }));
  app.decorateRequest('userId', '');
}

/**
 * preHandler for protected routes: verifies the bearer token and that the account still exists
 * (demo accounts expire, and deleted users must not keep writing with an old token).
 */
export function requireUser(pool: pg.Pool) {
  return async (request: FastifyRequest): Promise<void> => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    const { rowCount } = await pool.query('SELECT 1 FROM users WHERE id = $1', [request.user.sub]);
    if (!rowCount) throw unauthorized('Your session has expired. Please sign in again.');
    request.userId = request.user.sub;
  };
}
