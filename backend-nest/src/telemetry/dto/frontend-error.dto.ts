import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Maximum string lengths for telemetry fields
 * These prevent abuse while allowing reasonable error data
 */
const MAX_LENGTHS = {
  NAME: 200,
  MESSAGE: 2000,
  STACK: 10000,
  COMPONENT_STACK: 10000,
  PATHNAME: 500,
  USER_AGENT: 500,
  URL: 2000,
  USER_ID: 100,
  TENANT_ID: 100,
  CORRELATION_ID: 100,
  LAST_API_ENDPOINT: 500,
};

/**
 * Sanitized error details from the frontend
 * All fields are optional to support various payload formats
 */
class ErrorDetailsDto {
  @IsString()
  @MaxLength(MAX_LENGTHS.NAME)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.MESSAGE)
  @IsOptional()
  message?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.STACK)
  @IsOptional()
  stack?: string | null;

  @IsString()
  @MaxLength(MAX_LENGTHS.COMPONENT_STACK)
  @IsOptional()
  componentStack?: string;
}

/**
 * Frontend Error Telemetry DTO
 *
 * Represents a sanitized error report from the frontend ErrorBoundary.
 * All fields are optional to support:
 * - Legacy format: { message, stack }
 * - New format: { error: { name, message, stack } }
 * - Full format: { timestamp, pathname, userAgent, error: {...} }
 * - Empty/partial payloads (defaults applied server-side)
 *
 * Security:
 * - Max length constraints prevent abuse
 * - Metadata is sanitized server-side to prevent prototype pollution
 * - All sensitive data should be stripped by the frontend before transmission
 */
export class FrontendErrorDto {
  // New format fields (all optional)
  @IsString()
  @IsOptional()
  timestamp?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.PATHNAME)
  @IsOptional()
  pathname?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ErrorDetailsDto)
  @IsOptional()
  error?: ErrorDetailsDto;

  @IsString()
  @MaxLength(MAX_LENGTHS.LAST_API_ENDPOINT)
  @IsOptional()
  lastApiEndpoint?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.USER_AGENT)
  @IsOptional()
  userAgent?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.CORRELATION_ID)
  @IsOptional()
  correlationId?: string;

  // Legacy format fields (for backward compatibility)
  @IsString()
  @MaxLength(MAX_LENGTHS.MESSAGE)
  @IsOptional()
  message?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.STACK)
  @IsOptional()
  stack?: string | null;

  @IsString()
  @MaxLength(MAX_LENGTHS.COMPONENT_STACK)
  @IsOptional()
  componentStack?: string;

  // Additional optional fields
  @IsString()
  @MaxLength(MAX_LENGTHS.URL)
  @IsOptional()
  url?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.USER_ID)
  @IsOptional()
  userId?: string;

  @IsString()
  @MaxLength(MAX_LENGTHS.TENANT_ID)
  @IsOptional()
  tenantId?: string;

  // Metadata object (sanitized server-side)
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
