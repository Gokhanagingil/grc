import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsUUID,
  IsObject,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PolicyStatus } from '../enums';

/**
 * Custom validator to ensure reviewDate is after effectiveDate
 */
@ValidatorConstraint({ name: 'isAfterEffectiveDateUpdate', async: false })
export class IsAfterEffectiveDateUpdateConstraint
  implements ValidatorConstraintInterface
{
  validate(reviewDate: Date, args: ValidationArguments) {
    const obj = args.object as UpdatePolicyDto;
    if (!obj.effectiveDate || !reviewDate) return true;
    return reviewDate > obj.effectiveDate;
  }

  defaultMessage() {
    return 'Review date must be after effective date';
  }
}

/**
 * Update Policy DTO
 *
 * Validates payload for updating an existing policy.
 * All fields are optional for PATCH semantics.
 */
export class UpdatePolicyDto {
  @ApiPropertyOptional({
    description: 'Name of the policy',
    example: 'Updated Security Policy',
    minLength: 3,
    maxLength: 255,
  })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Unique policy code/identifier',
    example: 'POL-SEC-002',
    maxLength: 50,
  })
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Code must not exceed 50 characters' })
  @Matches(/^[A-Z0-9-]*$/, {
    message: 'Code must contain only uppercase letters, numbers, and hyphens',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'Version number of the policy',
    example: '2.0',
    maxLength: 20,
  })
  @IsString({ message: 'Version must be a string' })
  @IsOptional()
  @MaxLength(20, { message: 'Version must not exceed 20 characters' })
  @Matches(/^[0-9]+(\.[0-9]+)*$/, {
    message: 'Version must be in format like 1.0 or 1.0.1',
  })
  version?: string;

  @ApiPropertyOptional({
    description: 'Current status of the policy',
    enum: PolicyStatus,
    example: PolicyStatus.APPROVED,
  })
  @IsEnum(PolicyStatus, {
    message: `Invalid status value. Must be one of: ${Object.values(PolicyStatus).join(', ')}`,
  })
  @IsOptional()
  status?: PolicyStatus;

  @ApiPropertyOptional({
    description: 'Category or domain of the policy',
    example: 'Compliance',
    maxLength: 100,
  })
  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Brief summary of the policy',
    example: 'Updated policy summary with new requirements',
  })
  @IsString({ message: 'Summary must be a string' })
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({
    description: 'Full content/body of the policy',
    example: 'Section 1: Updated Purpose\n\nThis policy now defines...',
  })
  @IsString({ message: 'Content must be a string' })
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    description: 'UUID of the user responsible for this policy',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'Owner user ID must be a valid UUID v4' })
  @IsOptional()
  ownerUserId?: string;

  @ApiPropertyOptional({
    description: 'Date when the policy becomes effective',
    example: '2025-02-01',
    format: 'date',
  })
  @Type(() => Date)
  @IsDate({ message: 'Effective date must be a valid date' })
  @ValidateIf((o) => o.effectiveDate !== undefined && o.effectiveDate !== null)
  @IsOptional()
  effectiveDate?: Date;

  @ApiPropertyOptional({
    description: 'Date when the policy should be reviewed (must be after effective date)',
    example: '2026-02-01',
    format: 'date',
  })
  @Type(() => Date)
  @IsDate({ message: 'Review date must be a valid date' })
  @ValidateIf((o) => o.reviewDate !== undefined && o.reviewDate !== null)
  @Validate(IsAfterEffectiveDateUpdateConstraint)
  @IsOptional()
  reviewDate?: Date;

  @ApiPropertyOptional({
    description: 'UUID of the user who approved this policy',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'Approved by user ID must be a valid UUID v4' })
  @IsOptional()
  approvedByUserId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata as key-value pairs',
    example: { approvalDate: '2025-01-15', reviewedBy: 'compliance-team' },
  })
  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Array of control IDs to link to this policy',
    example: ['550e8400-e29b-41d4-a716-446655440001'],
    type: [String],
  })
  @IsArray({ message: 'Control IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each control ID must be a valid UUID v4' })
  @IsOptional()
  controlIds?: string[];
}
