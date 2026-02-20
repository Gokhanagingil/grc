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
import { PolicyStatus } from '../enums';

/**
 * Update Policy DTO
 *
 * Validates payload for updating an existing policy.
 * All fields are optional for PATCH semantics.
 */
export class UpdatePolicyDto {
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name?: string;

  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Code must not exceed 50 characters' })
  code?: string;

  @IsString({ message: 'Version must be a string' })
  @IsOptional()
  @MaxLength(20, { message: 'Version must not exceed 20 characters' })
  version?: string;

  @IsEnum(PolicyStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: PolicyStatus;

  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @IsString({ message: 'Summary must be a string' })
  @IsOptional()
  summary?: string;

  @IsString({ message: 'Content must be a string' })
  @IsOptional()
  content?: string;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string;

  @Type(() => Date)
  @IsDate({ message: 'Effective date must be a valid date' })
  @IsOptional()
  effectiveDate?: Date;

  @Type(() => Date)
  @IsDate({ message: 'Review date must be a valid date' })
  @IsOptional()
  reviewDate?: Date;

  @IsUUID('4', { message: 'Approved by user ID must be a valid UUID' })
  @IsOptional()
  approvedByUserId?: string;

  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
