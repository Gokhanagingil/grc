import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ControlTestType, ControlTestStatus } from '../enums';

export class CreateControlTestDto {
  @IsUUID()
  controlId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ControlTestType)
  testType?: ControlTestType;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsUUID()
  testerUserId?: string;

  @IsOptional()
  @IsUUID()
  reviewerUserId?: string;

  @IsOptional()
  @IsString()
  testProcedure?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sampleSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  populationSize?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateControlTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ControlTestType)
  testType?: ControlTestType;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsUUID()
  testerUserId?: string;

  @IsOptional()
  @IsUUID()
  reviewerUserId?: string;

  @IsOptional()
  @IsString()
  testProcedure?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sampleSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  populationSize?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateControlTestStatusDto {
  @IsEnum(ControlTestStatus)
  status: ControlTestStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * ControlTestFilterDto - List Contract v1 compliant filter DTO
 *
 * Supports:
 * - page/pageSize for pagination
 * - q for text search (name, description)
 * - filter by: controlId, status, testType, testerUserId, scheduledDate ranges
 * - sort allowlist: name, createdAt, updatedAt, scheduledDate, status, testType
 */
export class ControlTestFilterDto {
  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsEnum(ControlTestStatus)
  status?: ControlTestStatus;

  @IsOptional()
  @IsEnum(ControlTestType)
  testType?: ControlTestType;

  @IsOptional()
  @IsUUID()
  testerUserId?: string;

  @IsOptional()
  @IsDateString()
  scheduledDateFrom?: string;

  @IsOptional()
  @IsDateString()
  scheduledDateTo?: string;

  // List Contract v1 - Text search
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  /**
   * Canonical sort format: field:ASC or field:DESC
   * Takes precedence over legacy sortBy/sortOrder if provided
   */
  @IsOptional()
  @IsString()
  sort?: string;

  /**
   * Legacy sort field (use 'sort' param instead)
   * @deprecated Use sort=field:ASC|DESC format instead
   */
  @IsOptional()
  @IsString()
  sortBy?: string;

  /**
   * Legacy sort order (use 'sort' param instead)
   * @deprecated Use sort=field:ASC|DESC format instead
   */
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
