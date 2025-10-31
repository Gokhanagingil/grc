import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPort,
  IsString,
  Matches,
  Min,
  validateSync,
} from 'class-validator';

export class EnvVars {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: 'development' | 'test' | 'production';

  @IsInt() @Min(1) @Type(() => Number)
  PORT!: number;

  @IsString() @IsNotEmpty()
  API_PREFIX!: string;

  @IsString() @IsNotEmpty()
  API_VERSION!: string;

  @IsString()
  TENANT_HEADER!: string;

  @IsString()
  DEFAULT_TENANT_ID!: string;

  @IsString()
  DB_HOST!: string;

  @IsPort()
  DB_PORT!: string; // NOTE: .env port'lar string gelir → IsPort uygun

  @IsString()
  DB_NAME!: string;

  @IsString()
  DB_USER!: string;

  @IsString()
  DB_PASS!: string;

  @IsBooleanString()
  DB_SSL!: string; // "true"/"false"

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRES!: string; // "3600s" gibi

  @IsInt() @Min(4) @Type(() => Number)
  BCRYPT_SALT_ROUNDS!: number;

  @IsString()
  LOG_LEVEL!: string;

  @IsString()
  REQUEST_ID_HEADER!: string;

  @IsString()
  BUILD_TAG!: string;

  @IsString()
  HEALTH_PATH!: string;

  @IsOptional() @IsString()
  CORS_ORIGIN?: string;

  @IsOptional() @IsBooleanString()
  SWAGGER_ENABLED?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  // .env stringlerini sınıfa dök
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    const details = errors.map(e => JSON.stringify(e.constraints)).join(', ');
    throw new Error(`❌ Invalid environment variables: ${details}`);
  }
  return validated;
}
