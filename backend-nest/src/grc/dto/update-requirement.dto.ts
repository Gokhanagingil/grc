import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsUUID,
  IsObject,
  IsArray,
  IsIn,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComplianceFramework } from '../enums';
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  RequirementPriority,
  RequirementStatus,
} from './create-requirement.dto';

/**
 * Update Requirement DTO
 *
 * Validates payload for updating an existing compliance requirement.
 * All fields are optional for PATCH semantics.
 */
export class UpdateRequirementDto {
  @ApiPropertyOptional({
    description: 'Compliance framework this requirement belongs to',
    enum: ComplianceFramework,
    example: ComplianceFramework.SOC2,
  })
  @IsEnum(ComplianceFramework, {
    message: `Invalid framework value. Must be one of: ${Object.values(ComplianceFramework).join(', ')}`,
  })
  @IsOptional()
  framework?: ComplianceFramework;

  @ApiPropertyOptional({
    description: 'Reference code from the compliance framework',
    example: 'CC6.1',
    maxLength: 50,
  })
  @IsString({ message: 'Reference code must be a string' })
  @IsOptional()
  @MinLength(1, { message: 'Reference code cannot be empty' })
  @MaxLength(50, { message: 'Reference code must not exceed 50 characters' })
  @Matches(/^[A-Za-z0-9.-]+$/, {
    message: 'Reference code must contain only letters, numbers, dots, and hyphens',
  })
  referenceCode?: string;

  @ApiPropertyOptional({
    description: 'Title of the requirement',
    example: 'Updated requirement title',
    minLength: 3,
    maxLength: 255,
  })
  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the requirement',
    example: 'Updated description with additional compliance details',
  })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Category or domain of the requirement',
    example: 'Data Protection',
    maxLength: 100,
  })
  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Priority level of the requirement',
    enum: REQUIREMENT_PRIORITIES,
    example: 'Critical',
  })
  @IsIn(REQUIREMENT_PRIORITIES, {
    message: `Priority must be one of: ${REQUIREMENT_PRIORITIES.join(', ')}`,
  })
  @IsOptional()
  priority?: RequirementPriority;

  @ApiPropertyOptional({
    description: 'Compliance status of the requirement',
    enum: REQUIREMENT_STATUSES,
    example: 'Compliant',
  })
  @IsIn(REQUIREMENT_STATUSES, {
    message: `Status must be one of: ${REQUIREMENT_STATUSES.join(', ')}`,
  })
  @IsOptional()
  status?: RequirementStatus;

  @ApiPropertyOptional({
    description: 'UUID of the user responsible for this requirement',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'Owner user ID must be a valid UUID v4' })
  @IsOptional()
  ownerUserId?: string;

  @ApiPropertyOptional({
    description: 'Target date for achieving compliance',
    example: '2026-06-30',
    format: 'date',
  })
  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @ValidateIf((o) => o.dueDate !== undefined && o.dueDate !== null)
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata as key-value pairs',
    example: { lastAssessment: '2025-01-15', assessmentResult: 'passed' },
  })
  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Array of control IDs to link to this requirement',
    example: ['550e8400-e29b-41d4-a716-446655440001'],
    type: [String],
  })
  @IsArray({ message: 'Control IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each control ID must be a valid UUID v4' })
  @IsOptional()
  controlIds?: string[];
}
