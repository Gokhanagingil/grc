import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsObject,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWebhookEndpointDto {
  @IsString()
  name: string;

  @IsUrl({ require_tld: false }, { message: 'baseUrl must be a valid URL' })
  baseUrl: string;

  @IsString()
  @IsOptional()
  secret?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  @Type(() => Number)
  maxRetries?: number;

  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  @Type(() => Number)
  timeoutMs?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  allowInsecure?: boolean;
}

export class UpdateWebhookEndpointDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUrl({ require_tld: false }, { message: 'baseUrl must be a valid URL' })
  @IsOptional()
  baseUrl?: string;

  @IsString()
  @IsOptional()
  secret?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  @Type(() => Number)
  maxRetries?: number;

  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  @Type(() => Number)
  timeoutMs?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  allowInsecure?: boolean;
}

export class WebhookEndpointFilterDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
