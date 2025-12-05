import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDate,
  IsUUID,
  IsArray,
  IsObject,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RiskSeverity, RiskLikelihood, RiskStatus } from '../enums';

/**
 * Update Risk DTO
 *
 * Validates payload for updating an existing risk.
 * All fields are optional for PATCH semantics.
 */
export class UpdateRiskDto {
  @ApiPropertyOptional({
    description: 'Title of the risk',
    example: 'Updated Risk Title',
    minLength: 3,
    maxLength: 255,
  })
  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the risk',
    example: 'Updated risk description with more details',
  })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Category or domain of the risk',
    example: 'Operational',
    maxLength: 100,
  })
  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Severity level of the risk',
    enum: RiskSeverity,
    example: RiskSeverity.MEDIUM,
  })
  @IsEnum(RiskSeverity, {
    message: `Invalid severity value. Must be one of: ${Object.values(RiskSeverity).join(', ')}`,
  })
  @IsOptional()
  severity?: RiskSeverity;

  @ApiPropertyOptional({
    description: 'Likelihood of the risk occurring',
    enum: RiskLikelihood,
    example: RiskLikelihood.UNLIKELY,
  })
  @IsEnum(RiskLikelihood, {
    message: `Invalid likelihood value. Must be one of: ${Object.values(RiskLikelihood).join(', ')}`,
  })
  @IsOptional()
  likelihood?: RiskLikelihood;

  @ApiPropertyOptional({
    description: 'Impact level if the risk materializes',
    enum: RiskSeverity,
    example: RiskSeverity.MEDIUM,
  })
  @IsEnum(RiskSeverity, {
    message: `Invalid impact value. Must be one of: ${Object.values(RiskSeverity).join(', ')}`,
  })
  @IsOptional()
  impact?: RiskSeverity;

  @ApiPropertyOptional({
    description: 'Risk score (1-100)',
    minimum: 1,
    maximum: 100,
    example: 45,
  })
  @IsInt({ message: 'Score must be an integer' })
  @Min(1, { message: 'Score must be at least 1' })
  @Max(100, { message: 'Score must not exceed 100' })
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({
    description: 'Current status of the risk',
    enum: RiskStatus,
    example: RiskStatus.MITIGATING,
  })
  @IsEnum(RiskStatus, {
    message: `Invalid status value. Must be one of: ${Object.values(RiskStatus).join(', ')}`,
  })
  @IsOptional()
  status?: RiskStatus;

  @ApiPropertyOptional({
    description: 'UUID of the user responsible for managing this risk',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'Owner user ID must be a valid UUID v4' })
  @IsOptional()
  ownerUserId?: string;

  @ApiPropertyOptional({
    description: 'Target date for risk mitigation completion',
    example: '2025-12-31',
    format: 'date',
  })
  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @ValidateIf((o) => o.dueDate !== undefined && o.dueDate !== null)
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({
    description: 'Detailed plan for mitigating the risk',
    example: 'Updated mitigation plan with new controls',
  })
  @IsString({ message: 'Mitigation plan must be a string' })
  @IsOptional()
  mitigationPlan?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization and filtering',
    example: ['updated', 'reviewed'],
    type: [String],
  })
  @IsArray({ message: 'Tags must be an array' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  @ArrayMaxSize(20, { message: 'Maximum 20 tags allowed' })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Additional metadata as key-value pairs',
    example: { lastReviewedBy: 'admin', reviewDate: '2025-01-15' },
  })
  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Array of control IDs to link to this risk',
    example: ['550e8400-e29b-41d4-a716-446655440001'],
    type: [String],
  })
  @IsArray({ message: 'Control IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each control ID must be a valid UUID v4' })
  @IsOptional()
  controlIds?: string[];
}
