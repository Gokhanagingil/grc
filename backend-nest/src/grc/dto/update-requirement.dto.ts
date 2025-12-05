import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ComplianceFramework } from '../enums';

/**
 * Update Requirement DTO
 *
 * Validates payload for updating an existing compliance requirement.
 * All fields are optional for PATCH semantics.
 */
export class UpdateRequirementDto {
  @IsEnum(ComplianceFramework, { message: 'Invalid framework value' })
  @IsOptional()
  framework?: ComplianceFramework;

  @IsString({ message: 'Reference code must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Reference code must not exceed 50 characters' })
  referenceCode?: string;

  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @IsString({ message: 'Priority must be a string' })
  @IsOptional()
  @MaxLength(20, { message: 'Priority must not exceed 20 characters' })
  priority?: string;

  @IsString({ message: 'Status must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Status must not exceed 50 characters' })
  status?: string;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string;

  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @IsOptional()
  dueDate?: Date;

  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
