import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsObject,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FieldPolicy,
  FilterPolicy,
} from '../entities/sys-published-api.entity';

export class CreatePublishedApiDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  tableName: string;

  @IsObject()
  @IsOptional()
  allowedFields?: FieldPolicy;

  @IsArray()
  @IsOptional()
  filterPolicy?: FilterPolicy[];

  @IsBoolean()
  @IsOptional()
  allowList?: boolean;

  @IsBoolean()
  @IsOptional()
  allowCreate?: boolean;

  @IsBoolean()
  @IsOptional()
  allowUpdate?: boolean;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  @Type(() => Number)
  rateLimitPerMinute?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePublishedApiDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  tableName?: string;

  @IsObject()
  @IsOptional()
  allowedFields?: FieldPolicy;

  @IsArray()
  @IsOptional()
  filterPolicy?: FilterPolicy[];

  @IsBoolean()
  @IsOptional()
  allowList?: boolean;

  @IsBoolean()
  @IsOptional()
  allowCreate?: boolean;

  @IsBoolean()
  @IsOptional()
  allowUpdate?: boolean;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  @Type(() => Number)
  rateLimitPerMinute?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class PublishedApiFilterDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsString()
  @IsOptional()
  tableName?: string;

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
