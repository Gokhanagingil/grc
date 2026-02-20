import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsDateString,
  IsUUID,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngestCheckDto {
  @IsString()
  @MaxLength(64)
  module: string;

  @IsString()
  @MaxLength(128)
  checkName: string;

  @IsString()
  @MaxLength(16)
  status: string;

  @IsNumber()
  @Min(0)
  durationMs: number;

  @IsOptional()
  @IsNumber()
  httpStatus?: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  requestUrl?: string;

  @IsOptional()
  responseSnippet?: Record<string, unknown>;
}

export class IngestRunDto {
  @IsString()
  @MaxLength(16)
  suite: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  triggeredBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gitSha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  gitRef?: string;

  @IsDateString()
  startedAt: string;

  @IsDateString()
  finishedAt: string;

  @IsNumber()
  @Min(0)
  durationMs: number;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestCheckDto)
  checks: IngestCheckDto[];
}
