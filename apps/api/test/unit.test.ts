import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { isOriginAllowed, loadConfig } from '../src/config';

describe('config', () => {
  it('requires a strong JWT secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x' })).toThrow(
      /JWT_SECRET/,
    );
    expect(() =>
      loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x', JWT_SECRET: 'short' }),
    ).toThrow(/JWT_SECRET/);
    const ok = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x',
      JWT_SECRET: 'x'.repeat(32),
    });
    expect(ok.jwtSecret).toHaveLength(32);
  });

  it('parses CORS origins and booleans', () => {
    const c = loadConfig({
      DATABASE_URL: 'postgres://x',
      CORS_ORIGINS: ' https://a.com , https://b.com ',
      RUN_MIGRATIONS: 'false',
    });
    expect(c.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(c.runMigrations).toBe(false);
  });

  it('matches single-label wildcard origins', () => {
    const allowed = ['https://*.netlify.app', 'https://fittrack.temitopeagbola.com'];
    expect(isOriginAllowed('https://fittrack.temitopeagbola.com', allowed)).toBe(true);
    expect(isOriginAllowed('https://abc--fittrack.netlify.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://netlify.app.evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('https://evil.com/x.netlify.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://a.b.netlify.app', allowed)).toBe(false);
  });
});

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('anything', '!demo-account')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});
