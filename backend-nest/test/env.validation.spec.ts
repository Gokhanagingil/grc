import { validateEnv } from '../src/config/env.validation';

describe('Env Validation', () => {
  it('throws if JWT_SECRET missing', () => {
    expect(() => validateEnv({
      NODE_ENV: 'test',
      PORT: 5002,
      API_PREFIX: '/api',
      API_VERSION: 'v2',
      TENANT_HEADER: 'x-tenant-id',
      DEFAULT_TENANT_ID: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'grc',
      DB_USER: 'grc',
      DB_PASS: 'pw',
      DB_SSL: 'false',
      // JWT_SECRET: missing
      JWT_EXPIRES: '3600s',
      BCRYPT_SALT_ROUNDS: 10,
      LOG_LEVEL: 'debug',
      REQUEST_ID_HEADER: 'x-request-id',
      BUILD_TAG: 'TEST',
      HEALTH_PATH: '/health',
    })).toThrow();
  });

  it('passes with valid env', () => {
    expect(() => validateEnv({
      NODE_ENV: 'test',
      PORT: 5002,
      API_PREFIX: '/api',
      API_VERSION: 'v2',
      TENANT_HEADER: 'x-tenant-id',
      DEFAULT_TENANT_ID: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'grc',
      DB_USER: 'grc',
      DB_PASS: 'pw',
      DB_SSL: 'false',
      JWT_SECRET: 'secret',
      JWT_EXPIRES: '3600s',
      BCRYPT_SALT_ROUNDS: 10,
      LOG_LEVEL: 'debug',
      REQUEST_ID_HEADER: 'x-request-id',
      BUILD_TAG: 'TEST',
      HEALTH_PATH: '/health',
    })).not.toThrow();
  });
});

