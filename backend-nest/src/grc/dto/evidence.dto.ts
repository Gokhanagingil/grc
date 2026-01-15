import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsArray,
  IsObject,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EvidenceType, EvidenceSourceType, EvidenceStatus } from '../enums';

/**
 * DTO for creating a new Evidence record
 */
export class CreateEvidenceDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @IsOptional()
  @IsEnum(EvidenceSourceType)
  sourceType?: EvidenceSourceType;

  @IsOptional()
  @IsEnum(EvidenceStatus)
  status?: EvidenceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  externalUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  hash?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @IsDateString()
  collectedAt?: string;

  @IsOptional()
  @IsUUID()
  collectedByUserId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing Evidence record
 */
export class UpdateEvidenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @IsOptional()
  @IsEnum(EvidenceSourceType)
  sourceType?: EvidenceSourceType;

  @IsOptional()
  @IsEnum(EvidenceStatus)
  status?: EvidenceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  externalUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  hash?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @IsDateString()
  collectedAt?: string;

  @IsOptional()
  @IsUUID()
  collectedByUserId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering Evidence list queries
 */
export class EvidenceFilterDto {
  @IsOptional()
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @IsOptional()
  @IsEnum(EvidenceSourceType)
  sourceType?: EvidenceSourceType;

  @IsOptional()
  @IsEnum(EvidenceStatus)
  status?: EvidenceStatus;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsUUID()
  testResultId?: string;

  @IsOptional()
  @IsUUID()
  issueId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

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

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * DTO for linking Evidence to TestResult
 */
export class LinkEvidenceTestResultDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
