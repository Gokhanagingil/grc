/**
 * Environment Variables Validation
 *
 * Uses class-validator to validate environment variables at startup.
 * If validation fails, the application will not start (fail-fast).
 *
 * Production Readiness:
 * - All required vars must be present
 * - JWT_SECRET must be at least 32 characters
 * - DB connection params are validated
 */
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  Max,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  @IsOptional()
  PORT: number = 3002;

  @IsString()
  @IsNotEmpty({ message: 'JWT_SECRET is required and must not be empty' })
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters for security' })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '24h';

  @IsString()
  @IsNotEmpty({ message: 'DB_HOST is required' })
  DB_HOST: string = 'localhost';

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  @IsOptional()
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty({ message: 'DB_USER is required' })
  DB_USER: string = 'postgres';

  @IsString()
  @IsNotEmpty({ message: 'DB_PASSWORD is required' })
  DB_PASSWORD: string = 'postgres';

  @IsString()
  @IsNotEmpty({ message: 'DB_NAME is required' })
  DB_NAME: string = 'grc_platform';

  @IsString()
  @IsOptional()
  DB_SYNC: string = 'false';

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:3000,http://localhost:3001,http://localhost:3002';

  // DB Retry Configuration
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  @IsOptional()
  DB_RETRY_ATTEMPTS: number = 10;

  @IsNumber()
  @Type(() => Number)
  @Min(100)
  @Max(10000)
  @IsOptional()
  DB_RETRY_DELAY: number = 500;
}

/**
 * Validates environment variables using class-validator.
 * Throws an error if validation fails, preventing the app from starting.
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'Unknown validation error';
        return `${error.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return validatedConfig;
}
