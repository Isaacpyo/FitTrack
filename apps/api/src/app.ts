import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type pg from 'pg';
import { registerAuth, requireUser } from './auth/plugin';
import { isOriginAllowed, type Config } from './config';
import { HttpError } from './errors';
import { authRoutes } from './routes/auth';
import { dataRoutes } from './routes/data';
import { meRoutes } from './routes/me';
import { publicRoutes } from './routes/public';

export async function buildApp({
  config,
  pool,
}: {
  config: Config;
  pool: pg.Pool;
}): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.env === 'test' || config.logLevel === 'silent'
        ? false
        : { level: config.logLevel, redact: ['req.headers.authorization'] },
    // Render (and most PaaS) terminate TLS at a proxy; trust it for client IPs in rate limiting.
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet);
  await app.register(cors, {
    // Native apps send no Origin header; browsers must match the allow-list.
    origin: (origin, cb) => cb(null, !origin || isOriginAllowed(origin, config.corsOrigins)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  });
  await app.register(rateLimit, { max: config.rateLimitPerMinute, timeWindow: '1 minute' });
  await registerAuth(app, { secret: config.jwtSecret, expiresIn: config.jwtExpiresIn, pool });

  app.setErrorHandler((err: FastifyError | HttpError, request, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
    }
    if (err.statusCode && err.statusCode < 500) {
      const message =
        err.statusCode === 429
          ? 'Too many requests. Please slow down and try again shortly.'
          : err.message;
      return reply
        .code(err.statusCode)
        .send({ error: { code: err.code ?? 'request_error', message } });
    }
    request.log.error(err);
    return reply
      .code(500)
      .send({ error: { code: 'internal', message: 'Something went wrong on our side.' } });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: { code: 'not_found', message: `No route for ${request.method} ${request.url}` },
    }),
  );

  await app.register(publicRoutes, { pool });
  await app.register(authRoutes, { pool, config });
  await app.register(async (scope) => {
    scope.addHook('onRequest', requireUser(pool));
    await scope.register(meRoutes, { pool });
    await scope.register(dataRoutes, { pool });
  });

  return app;
}
