import { IsOptional, IsString, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { PolicyStatus } from '../enums';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Policy Filter DTO
 *
 * Extends pagination with policy-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class PolicyFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  approvedByUserId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  effectiveDateFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveDateTo?: string;

  @IsOptional()
  @IsDateString()
  reviewDateFrom?: string;

  @IsOptional()
  @IsDateString()
  reviewDateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Allowed sort fields for policies
 */
export const POLICY_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'status',
  'category',
  'effectiveDate',
  'reviewDate',
  'version',
];
