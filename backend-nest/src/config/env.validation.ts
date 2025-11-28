import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsPort,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

export class EnvVars {
  @IsIn(['development', 'test', 'production'])
  @IsOptional()
  NODE_ENV?: 'development' | 'test' | 'production';

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsOptional()
  HOST?: string;

  @IsString()
  @IsOptional()
  API_PREFIX?: string;

  @IsString()
  @IsOptional()
  API_VERSION?: string;

  @IsString()
  @IsOptional()
  TENANT_HEADER?: string;

  @IsString()
  @IsOptional()
  DEFAULT_TENANT_ID?: string;

  @IsString()
  @IsOptional()
  DB_HOST?: string;

  @IsPort()
  @IsOptional()
  DB_PORT?: string;

  @IsString()
  @IsOptional()
  DB_NAME?: string;

  @IsString()
  @IsOptional()
  DB_USER?: string;

  @IsString()
  @IsOptional()
  DB_PASS?: string;

  @IsString()
  @IsOptional()
  DB_SCHEMA?: string;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsBooleanString()
  @IsOptional()
  DB_SSL?: string;

  // Legacy secret (backwards compatibility)
  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsInt()
  @Min(4)
  @Type(() => Number)
  @IsOptional()
  BCRYPT_SALT_ROUNDS?: number;

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  @IsString()
  @IsOptional()
  REQUEST_ID_HEADER?: string;

  @IsString()
  @IsOptional()
  BUILD_TAG?: string;

  @IsString()
  @IsOptional()
  HEALTH_PATH?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsBooleanString()
  SWAGGER_ENABLED?: string;

  @IsOptional()
  @IsBooleanString()
  METRICS_ENABLED?: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsPort()
  REDIS_PORT?: string;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  RATE_TTL_MS?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  RATE_LIMIT?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  QUEUE_EVENTS_RAW_CONCURRENCY?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  QUEUE_EVENTS_NORMALIZE_CONCURRENCY?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  QUEUE_EVENTS_INCIDENT_CONCURRENCY?: number;

  @IsOptional()
  @IsString()
  INGEST_TOKEN?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  INGEST_MAX_BYTES?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  INGEST_MAX_ITEMS?: number;

  @IsOptional()
  @IsBooleanString()
  PROMETHEUS_ENABLED?: string;

  @IsOptional()
  @IsBooleanString()
  OTEL_ENABLED?: string;

  @IsOptional()
  @IsBooleanString()
  DEMO_SEED?: string;
}

function normalizePrefix(prefix?: string): { base: string; version: string } {
  const defaultBase = 'api';
  const defaultVersion = 'v2';

  if (!prefix) {
    return { base: defaultBase, version: defaultVersion };
  }

  const trimmed = prefix.trim();
  if (trimmed.length === 0) {
    return { base: defaultBase, version: defaultVersion };
  }

  const normalized = trimmed.replace(/^\/+/g, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { base: defaultBase, version: defaultVersion };
  }

  const last = segments[segments.length - 1] ?? '';
  if (last && /^v\d+$/i.test(last)) {
    const version = last.replace(/^v/i, '') || defaultVersion;
    const base = segments.slice(0, -1).join('/') || defaultBase;
    return { base, version: `v${version}` };
  }

  return { base: segments.join('/'), version: defaultVersion };
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: true });
  const warnings: string[] = [];

  // Database defaults (skip when DATABASE_URL provided)
  if (!validated.DATABASE_URL) {
    if (!validated.DB_HOST) {
      warnings.push('DB_HOST not set - using default localhost.');
      validated.DB_HOST = 'localhost';
    }

    if (!validated.DB_NAME) {
      warnings.push('DB_NAME not set - using default grc.');
      validated.DB_NAME = 'grc';
    }

    if (!validated.DB_USER) {
      warnings.push('DB_USER not set - using default grc.');
      validated.DB_USER = 'grc';
    }
  }

  if (!validated.DEFAULT_TENANT_ID) {
    warnings.push('DEFAULT_TENANT_ID not set - multi-tenancy may fail.');
  }

  // JWT secrets
  if (!validated.JWT_ACCESS_SECRET) {
    if (validated.JWT_SECRET) {
      validated.JWT_ACCESS_SECRET = validated.JWT_SECRET;
    } else {
      warnings.push('JWT_ACCESS_SECRET not set - using insecure default.');
      validated.JWT_ACCESS_SECRET =
        'default-jwt-access-secret-change-in-production-min-32-chars';
    }
  }

  if (!validated.JWT_REFRESH_SECRET) {
    if (validated.JWT_SECRET) {
      validated.JWT_REFRESH_SECRET = validated.JWT_SECRET;
    } else {
      validated.JWT_REFRESH_SECRET = validated.JWT_ACCESS_SECRET;
      warnings.push(
        'JWT_REFRESH_SECRET not set - falling back to access secret (insecure for production).',
      );
    }
  }

  if (!validated.JWT_SECRET) {
    validated.JWT_SECRET = validated.JWT_ACCESS_SECRET;
  }

  // Defaults
  validated.NODE_ENV = validated.NODE_ENV ?? 'development';
  validated.PORT = validated.PORT ?? 5002;
  validated.HOST = validated.HOST ?? '0.0.0.0';
  validated.TENANT_HEADER = validated.TENANT_HEADER ?? 'x-tenant-id';
  validated.JWT_EXPIRES_IN = validated.JWT_EXPIRES_IN ?? '15m';
  validated.JWT_REFRESH_EXPIRES_IN = validated.JWT_REFRESH_EXPIRES_IN ?? '7d';
  validated.BCRYPT_SALT_ROUNDS = validated.BCRYPT_SALT_ROUNDS ?? 10;
  validated.LOG_LEVEL = validated.LOG_LEVEL ?? 'info';
  validated.CORS_ORIGINS = validated.CORS_ORIGINS ?? 'http://localhost:3000';

  const { base, version } = normalizePrefix(validated.API_PREFIX);
  validated.API_PREFIX = `/${base}`;
  validated.API_VERSION = validated.API_VERSION ?? version;

  if (errors.length) {
    const details = errors
      .map((error) => JSON.stringify(error.constraints ?? {}))
      .join(', ');
    throw new Error(`Invalid environment variables: ${details}`);
  }

  if (warnings.length > 0) {
    console.warn('Environment variable warnings:');
    warnings.forEach((warning) => console.warn(`  ${warning}`));
  }

  return validated;
}
