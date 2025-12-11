import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Process Filter DTO
 *
 * Extends pagination with process-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class ProcessFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Allowed sort fields for processes
 */
export const PROCESS_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'category',
  'isActive',
];
