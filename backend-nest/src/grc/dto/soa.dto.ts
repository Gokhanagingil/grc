import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SoaProfileStatus,
  SoaApplicability,
  SoaImplementationStatus,
} from '../enums';

/**
 * DTO for creating a new SOA Profile
 */
export class CreateSoaProfileDto {
  @IsUUID()
  standardId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scopeText?: string;
}

/**
 * DTO for updating an SOA Profile
 */
export class UpdateSoaProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scopeText?: string;

  @IsOptional()
  @IsEnum(SoaProfileStatus)
  status?: SoaProfileStatus;
}

/**
 * DTO for filtering SOA Profiles list
 */
export class FilterSoaProfileDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  standardId?: string;

  @IsOptional()
  @IsEnum(SoaProfileStatus)
  status?: SoaProfileStatus;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

/**
 * DTO for updating an SOA Item
 */
export class UpdateSoaItemDto {
  @IsOptional()
  @IsEnum(SoaApplicability)
  applicability?: SoaApplicability;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsEnum(SoaImplementationStatus)
  implementationStatus?: SoaImplementationStatus;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for filtering SOA Items list
 */
export class FilterSoaItemDto {
  @IsUUID()
  profileId: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  clauseId?: string;

  @IsOptional()
  @IsEnum(SoaApplicability)
  applicability?: SoaApplicability;

  @IsOptional()
  @IsEnum(SoaImplementationStatus)
  implementationStatus?: SoaImplementationStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasEvidence?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasControls?: boolean;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

/**
 * SOA Profile sortable fields
 */
export const SOA_PROFILE_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'status',
  'version',
  'publishedAt',
];

/**
 * SOA Item sortable fields
 */
export const SOA_ITEM_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'applicability',
  'implementationStatus',
  'targetDate',
];
