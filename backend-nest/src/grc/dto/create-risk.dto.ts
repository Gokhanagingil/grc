import {
  IsString,
  IsNotEmpty,
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
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RiskSeverity,
  RiskLikelihood,
  RiskStatus,
  RiskType,
  RiskAppetite,
  TreatmentStrategy,
} from '../enums';

/**
 * Create Risk DTO
 *
 * Validates payload for creating a new risk.
 * Required fields: title
 * Optional fields: all others with sensible defaults in entity
 */
export class CreateRiskDto {
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @IsUUID('4', { message: 'Risk category ID must be a valid UUID' })
  @IsOptional()
  riskCategoryId?: string;

  @IsEnum(RiskType, { message: 'Invalid risk type value' })
  @IsOptional()
  riskType?: RiskType;

  @IsEnum(RiskSeverity, { message: 'Invalid severity value' })
  @IsOptional()
  severity?: RiskSeverity;

  @IsEnum(RiskLikelihood, { message: 'Invalid likelihood value' })
  @IsOptional()
  likelihood?: RiskLikelihood;

  @IsEnum(RiskSeverity, { message: 'Invalid impact value' })
  @IsOptional()
  impact?: RiskSeverity;

  @IsInt({ message: 'Score must be an integer' })
  @Min(1, { message: 'Score must be at least 1' })
  @Max(100, { message: 'Score must not exceed 100' })
  @IsOptional()
  score?: number;

  @IsInt({ message: 'Inherent likelihood must be an integer' })
  @Min(1, { message: 'Inherent likelihood must be at least 1' })
  @Max(5, { message: 'Inherent likelihood must not exceed 5' })
  @IsOptional()
  inherentLikelihood?: number;

  @IsInt({ message: 'Inherent impact must be an integer' })
  @Min(1, { message: 'Inherent impact must be at least 1' })
  @Max(5, { message: 'Inherent impact must not exceed 5' })
  @IsOptional()
  inherentImpact?: number;

  @IsInt({ message: 'Residual likelihood must be an integer' })
  @Min(1, { message: 'Residual likelihood must be at least 1' })
  @Max(5, { message: 'Residual likelihood must not exceed 5' })
  @IsOptional()
  residualLikelihood?: number;

  @IsInt({ message: 'Residual impact must be an integer' })
  @Min(1, { message: 'Residual impact must be at least 1' })
  @Max(5, { message: 'Residual impact must not exceed 5' })
  @IsOptional()
  residualImpact?: number;

  @IsEnum(RiskAppetite, { message: 'Invalid risk appetite value' })
  @IsOptional()
  riskAppetite?: RiskAppetite;

  @IsEnum(TreatmentStrategy, { message: 'Invalid treatment strategy value' })
  @IsOptional()
  treatmentStrategy?: TreatmentStrategy;

  @IsString({ message: 'Treatment plan must be a string' })
  @IsOptional()
  treatmentPlan?: string;

  @IsEnum(RiskStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: RiskStatus;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string;

  @IsString({ message: 'Owner display name must be a string' })
  @IsOptional()
  @MaxLength(255, {
    message: 'Owner display name must not exceed 255 characters',
  })
  ownerDisplayName?: string;

  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @IsOptional()
  dueDate?: Date;

  @Type(() => Date)
  @IsDate({ message: 'Target date must be a valid date' })
  @IsOptional()
  targetDate?: Date;

  @Type(() => Date)
  @IsDate({ message: 'Next review at must be a valid date' })
  @IsOptional()
  nextReviewAt?: Date;

  @IsInt({ message: 'Review interval days must be an integer' })
  @Min(1, { message: 'Review interval days must be at least 1' })
  @Max(365, { message: 'Review interval days must not exceed 365' })
  @IsOptional()
  reviewIntervalDays?: number;

  @IsString({ message: 'Acceptance reason must be a string' })
  @IsOptional()
  acceptanceReason?: string;

  @IsString({ message: 'Mitigation plan must be a string' })
  @IsOptional()
  mitigationPlan?: string;

  @IsArray({ message: 'Tags must be an array' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  @IsOptional()
  tags?: string[];

  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
