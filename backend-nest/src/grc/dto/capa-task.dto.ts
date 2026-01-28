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
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CAPATaskStatus } from '../enums';

/**
 * Transform to normalize enum values to uppercase.
 * Accepts lowercase, uppercase, or mixed case input and converts to uppercase.
 * Used for enums like CAPATaskStatus where DB expects uppercase values.
 */
const UppercaseEnumTransform = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

export class CreateCapaTaskDto {
  @IsUUID()
  capaId: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequenceOrder?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCapaTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequenceOrder?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCapaTaskStatusDto {
  @ApiProperty({
    enum: CAPATaskStatus,
    description: 'Target status for the CAPA task',
    example: 'IN_PROGRESS',
  })
  @UppercaseEnumTransform()
  @IsEnum(CAPATaskStatus)
  status: CAPATaskStatus;

  @ApiPropertyOptional({
    description: 'Optional reason explaining the status change',
    example: 'Starting work on this task',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CompleteCapaTaskDto {
  @IsOptional()
  @IsString()
  completionNotes?: string;
}

export class CapaTaskFilterDto {
  @IsOptional()
  @IsUUID()
  capaId?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(CAPATaskStatus)
  status?: CAPATaskStatus;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

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
