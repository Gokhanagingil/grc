import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';
import { ViolationSeverity, ViolationStatus } from '../enums';

/**
 * ProcessViolation Filter DTO
 *
 * Extends pagination with process violation-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class ProcessViolationFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsEnum(ViolationStatus)
  status?: ViolationStatus;

  @IsOptional()
  @IsEnum(ViolationSeverity)
  severity?: ViolationSeverity;

  @IsOptional()
  @IsUUID()
  linkedRiskId?: string;

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
}

/**
 * Allowed sort fields for process violations
 */
export const PROCESS_VIOLATION_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'severity',
  'status',
  'dueDate',
];
