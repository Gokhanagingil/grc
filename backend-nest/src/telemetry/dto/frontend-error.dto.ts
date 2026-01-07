import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Sanitized error details from the frontend
 */
class ErrorDetailsDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(500)
  message: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  stack?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  componentStack?: string;
}

/**
 * Frontend Error Telemetry DTO
 *
 * Represents a sanitized error report from the frontend ErrorBoundary.
 * All sensitive data should be stripped by the frontend before transmission.
 */
export class FrontendErrorDto {
  @IsString()
  timestamp: string;

  @IsString()
  @MaxLength(500)
  pathname: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ErrorDetailsDto)
  error: ErrorDetailsDto;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  lastApiEndpoint?: string;

  @IsString()
  @MaxLength(500)
  userAgent: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  correlationId?: string;
}
