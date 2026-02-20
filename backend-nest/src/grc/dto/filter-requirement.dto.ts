import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ComplianceFramework } from '../enums';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Requirement Filter DTO
 *
 * Extends pagination with requirement-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class RequirementFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ComplianceFramework)
  framework?: ComplianceFramework;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  referenceCode?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Allowed sort fields for requirements
 */
export const REQUIREMENT_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'framework',
  'referenceCode',
  'status',
  'category',
  'priority',
  'dueDate',
];
