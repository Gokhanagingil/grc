import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ViolationSeverity, ViolationStatus } from '../enums';

/**
 * Update ProcessViolation DTO
 *
 * Validates payload for updating a process violation.
 * All fields are optional.
 * Note: controlId and controlResultId cannot be changed after creation.
 */
export class UpdateProcessViolationDto {
  @IsEnum(ViolationSeverity, { message: 'Invalid severity value' })
  @IsOptional()
  severity?: ViolationSeverity;

  @IsEnum(ViolationStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: ViolationStatus;

  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string;

  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @IsOptional()
  dueDate?: Date;

  @IsString({ message: 'Resolution notes must be a string' })
  @IsOptional()
  resolutionNotes?: string;
}

/**
 * Link Risk DTO
 *
 * Used for linking a violation to a GrcRisk.
 */
export class LinkRiskDto {
  @IsUUID('4', { message: 'Risk ID must be a valid UUID' })
  riskId: string;
}
