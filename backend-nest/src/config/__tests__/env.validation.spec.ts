import 'reflect-metadata';
import { validateEnv } from '../env.validation';

describe('Env Validation', () => {
  it('falls back to defaults when JWT secrets are missing', () => {
    const result = validateEnv({
      NODE_ENV: 'test',
      PORT: 5002,
      API_PREFIX: '/api/v2',
      API_VERSION: 'v2',
      TENANT_HEADER: 'x-tenant-id',
      DEFAULT_TENANT_ID: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'grc',
      DB_USER: 'grc',
      DB_PASS: 'pw',
      DB_SSL: 'false',
      BCRYPT_SALT_ROUNDS: 10,
    });

    expect(result.JWT_ACCESS_SECRET).toBeDefined();
    expect(result.JWT_REFRESH_SECRET).toBeDefined();
  });

  it('passes with explicit JWT access/refresh secrets', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        PORT: 5002,
        API_PREFIX: '/api/v2',
        API_VERSION: 'v2',
        TENANT_HEADER: 'x-tenant-id',
        DEFAULT_TENANT_ID: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'grc',
        DB_USER: 'grc',
        DB_PASS: 'pw',
        DB_SSL: 'false',
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        BCRYPT_SALT_ROUNDS: 10,
        LOG_LEVEL: 'debug',
        REQUEST_ID_HEADER: 'x-request-id',
        BUILD_TAG: 'TEST',
        HEALTH_PATH: '/health',
      }),
    ).not.toThrow();
  });
});
