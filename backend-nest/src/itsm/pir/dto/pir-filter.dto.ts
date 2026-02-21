import { IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PirStatus, PirActionStatus } from '../pir.enums';

/**
 * DTO for filtering PIRs
 */
export class PirFilterDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: string = 'DESC';

  @IsOptional()
  @IsUUID()
  majorIncidentId?: string;

  @IsOptional()
  @IsEnum(PirStatus)
  status?: PirStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export const PIR_SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'title', 'status'];

/**
 * DTO for filtering PIR Actions
 */
export class PirActionFilterDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: string = 'DESC';

  @IsOptional()
  @IsUUID()
  pirId?: string;

  @IsOptional()
  @IsEnum(PirActionStatus)
  status?: PirActionStatus;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  overdue?: string;
}

export const PIR_ACTION_SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'title', 'status', 'dueDate', 'priority'];
