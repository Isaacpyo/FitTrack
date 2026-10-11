import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789';

const booleanish = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    JWT_SECRET: z.string().optional(),
    JWT_EXPIRES_IN: z.string().default('30d'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:8081,http://localhost:8080,http://localhost:3000'),
    RUN_MIGRATIONS: booleanish.default(true),
    DEMO_TTL_HOURS: z.coerce
      .number()
      .min(1)
      .max(24 * 30)
      .default(24),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(20),
    DEMO_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(30),
  })
  .transform((env, ctx) => {
    const jwtSecret =
      env.JWT_SECRET ?? (env.NODE_ENV === 'production' ? undefined : DEV_JWT_SECRET);
    if (!jwtSecret || jwtSecret.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set to at least 32 characters in production',
      });
      return z.NEVER;
    }
    return {
      env: env.NODE_ENV,
      host: env.HOST,
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
      databaseUrl: env.DATABASE_URL,
      databasePoolMax: env.DATABASE_POOL_MAX,
      jwtSecret,
      jwtExpiresIn: env.JWT_EXPIRES_IN,
      corsOrigins: env.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      runMigrations: env.RUN_MIGRATIONS,
      demoTtlHours: env.DEMO_TTL_HOURS,
      rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
      authRateLimitPerMinute: env.AUTH_RATE_LIMIT_PER_MINUTE,
      demoRateLimitPerHour: env.DEMO_RATE_LIMIT_PER_HOUR,
    };
  });

export type Config = z.output<typeof envSchema>;

/** Load a local .env (repo root or apps/api) in development so `npm run dev` just works. */
function loadDotEnv(): void {
  if (process.env.NODE_ENV === 'production') return;
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env) loadDotEnv();
  // `KEY=` lines in .env files mean "unset", not "empty string".
  const defined = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ''),
  );
  const parsed = envSchema.safeParse(defined);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

/** True if an Origin header is allowed. Entries may use one leading wildcard label, e.g. https://*.netlify.app */
export function isOriginAllowed(origin: string, allowed: string[]): boolean {
  return allowed.some((pattern) => {
    if (pattern === '*') return true;
    if (!pattern.includes('*')) return pattern === origin;
    const [prefix, suffix] = pattern.split('*') as [string, string];
    if (!origin.startsWith(prefix) || !origin.endsWith(suffix)) return false;
    return /^[a-z0-9-]+$/i.test(origin.slice(prefix.length, origin.length - suffix.length));
  });
}
