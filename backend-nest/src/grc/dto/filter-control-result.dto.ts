import {
  IsOptional,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from './pagination.dto';
import { ControlResultSource } from '../enums';

/**
 * ControlResult Filter DTO
 *
 * Extends pagination with control result-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class ControlResultFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isCompliant?: boolean;

  @IsOptional()
  @IsEnum(ControlResultSource)
  source?: ControlResultSource;

  @IsOptional()
  @IsDateString()
  executionDateFrom?: string;

  @IsOptional()
  @IsDateString()
  executionDateTo?: string;
}

/**
 * Allowed sort fields for control results
 */
export const CONTROL_RESULT_SORTABLE_FIELDS = [
  'createdAt',
  'executionDate',
  'isCompliant',
  'source',
];
