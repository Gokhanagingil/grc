import {
  IsString,
  IsNotEmpty,
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplianceFramework } from '../enums';

/**
 * Valid priority values for requirements
 */
export const REQUIREMENT_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

/**
 * Valid status values for requirements
 */
export const REQUIREMENT_STATUSES = [
  'Not Started',
  'In Progress',
  'Compliant',
  'Partially Compliant',
  'Non-Compliant',
  'Not Applicable',
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

/**
 * Create Requirement DTO
 *
 * Validates payload for creating a new compliance requirement.
 * Required fields: framework, referenceCode, title
 * Optional fields: all others with sensible defaults in entity
 */
export class CreateRequirementDto {
  @ApiProperty({
    description: 'Compliance framework this requirement belongs to',
    enum: ComplianceFramework,
    example: ComplianceFramework.ISO27001,
  })
  @IsEnum(ComplianceFramework, {
    message: `Invalid framework value. Must be one of: ${Object.values(ComplianceFramework).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Framework is required' })
  framework: ComplianceFramework;

  @ApiProperty({
    description: 'Reference code from the compliance framework',
    example: 'A.5.1.1',
    maxLength: 50,
  })
  @IsString({ message: 'Reference code must be a string' })
  @IsNotEmpty({ message: 'Reference code is required' })
  @MinLength(1, { message: 'Reference code cannot be empty' })
  @MaxLength(50, { message: 'Reference code must not exceed 50 characters' })
  @Matches(/^[A-Za-z0-9.-]+$/, {
    message: 'Reference code must contain only letters, numbers, dots, and hyphens',
  })
  referenceCode: string;

  @ApiProperty({
    description: 'Title of the requirement',
    example: 'Policies for information security',
    minLength: 3,
    maxLength: 255,
  })
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title is required' })
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the requirement',
    example:
      'A set of policies for information security shall be defined, approved by management, published and communicated to employees',
  })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Category or domain of the requirement',
    example: 'Access Control',
    maxLength: 100,
  })
  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Priority level of the requirement',
    enum: REQUIREMENT_PRIORITIES,
    example: 'High',
  })
  @IsIn(REQUIREMENT_PRIORITIES, {
    message: `Priority must be one of: ${REQUIREMENT_PRIORITIES.join(', ')}`,
  })
  @IsOptional()
  priority?: RequirementPriority;

  @ApiPropertyOptional({
    description: 'Compliance status of the requirement',
    enum: REQUIREMENT_STATUSES,
    example: 'In Progress',
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
    example: '2025-12-31',
    format: 'date',
  })
  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @ValidateIf((o) => o.dueDate !== undefined && o.dueDate !== null)
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({
    description: 'Additional metadata as key-value pairs',
    example: { auditYear: '2025', assessor: 'external-auditor' },
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
