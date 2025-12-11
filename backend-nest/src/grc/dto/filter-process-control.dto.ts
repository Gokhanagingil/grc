import { IsOptional, IsString, IsBoolean, IsUUID, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from './pagination.dto';
import { ProcessControlFrequency, ControlResultType } from '../enums';

/**
 * ProcessControl Filter DTO
 *
 * Extends pagination with process control-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class ProcessControlFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  processId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAutomated?: boolean;

  @IsOptional()
  @IsEnum(ProcessControlFrequency)
  frequency?: ProcessControlFrequency;

  @IsOptional()
  @IsEnum(ControlResultType)
  expectedResultType?: ControlResultType;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Allowed sort fields for process controls
 */
export const PROCESS_CONTROL_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'isAutomated',
  'frequency',
  'isActive',
];
