import { IsString, IsOptional, IsBoolean, IsArray, IsUrl, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWebhookEndpointDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  @IsArray()
  eventFilters?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  @IsArray()
  eventFilters?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class WebhookEndpointFilterDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
