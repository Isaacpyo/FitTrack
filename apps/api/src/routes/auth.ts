import { demoLoginSchema, loginSchema, signupSchema, type AuthResponse } from '@fittrack/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/password';
import type { Config } from '../config';
import { conflict, HttpError, parse } from '../errors';
import { createUser, findUserByEmail } from '../repos/users';
import { createDemoUser } from '../services/demo';

export async function authRoutes(
  app: FastifyInstance,
  { pool, config }: { pool: pg.Pool; config: Config },
) {
  const perMinute = { rateLimit: { max: config.authRateLimitPerMinute, timeWindow: '1 minute' } };

  app.post('/auth/signup', { config: perMinute }, async (request, reply) => {
    const input = parse(signupSchema, request.body);
    const user = await createUser(pool, {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
    });
    if (!user) throw conflict('An account with this email already exists. Try signing in.');
    const body: AuthResponse = { token: app.signToken(user.id), user };
    return reply.code(201).send(body);
  });

  app.post('/auth/login', { config: perMinute }, async (request) => {
    const input = parse(loginSchema, request.body);
    const found = await findUserByEmail(pool, input.email);
    if (!found) await burnPasswordCheck(input.password);
    if (!found || !(await verifyPassword(input.password, found.passwordHash))) {
      throw new HttpError(401, 'invalid_credentials', 'Incorrect email or password.');
    }
    const { passwordHash: _omit, ...user } = found;
    const body: AuthResponse = { token: app.signToken(user.id), user };
    return body;
  });

  app.post(
    '/auth/demo',
    { config: { rateLimit: { max: config.demoRateLimitPerHour, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const input = parse(demoLoginSchema, request.body ?? {});
      const user = await createDemoUser(pool, {
        ttlHours: config.demoTtlHours,
        today: input.today,
        utcOffsetMinutes: input.utcOffsetMinutes,
      });
      const body: AuthResponse = { token: app.signToken(user.id), user };
      return reply.code(201).send(body);
    },
  );
}
