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
 * Update Risk DTO
 *
 * Validates payload for updating an existing risk.
 * All fields are optional for PATCH semantics.
 */
export class UpdateRiskDto {
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

  @IsUUID('4', { message: 'Risk category ID must be a valid UUID' })
  @IsOptional()
  riskCategoryId?: string | null;

  @IsEnum(RiskType, { message: 'Invalid risk type value' })
  @IsOptional()
  riskType?: RiskType | null;

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
  inherentLikelihood?: number | null;

  @IsInt({ message: 'Inherent impact must be an integer' })
  @Min(1, { message: 'Inherent impact must be at least 1' })
  @Max(5, { message: 'Inherent impact must not exceed 5' })
  @IsOptional()
  inherentImpact?: number | null;

  @IsInt({ message: 'Residual likelihood must be an integer' })
  @Min(1, { message: 'Residual likelihood must be at least 1' })
  @Max(5, { message: 'Residual likelihood must not exceed 5' })
  @IsOptional()
  residualLikelihood?: number | null;

  @IsInt({ message: 'Residual impact must be an integer' })
  @Min(1, { message: 'Residual impact must be at least 1' })
  @Max(5, { message: 'Residual impact must not exceed 5' })
  @IsOptional()
  residualImpact?: number | null;

  @IsEnum(RiskAppetite, { message: 'Invalid risk appetite value' })
  @IsOptional()
  riskAppetite?: RiskAppetite | null;

  @IsEnum(TreatmentStrategy, { message: 'Invalid treatment strategy value' })
  @IsOptional()
  treatmentStrategy?: TreatmentStrategy | null;

  @IsString({ message: 'Treatment plan must be a string' })
  @IsOptional()
  treatmentPlan?: string | null;

  @IsEnum(RiskStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: RiskStatus;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string | null;

  @IsString({ message: 'Owner display name must be a string' })
  @IsOptional()
  @MaxLength(255, {
    message: 'Owner display name must not exceed 255 characters',
  })
  ownerDisplayName?: string | null;

  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @IsOptional()
  dueDate?: Date | null;

  @Type(() => Date)
  @IsDate({ message: 'Target date must be a valid date' })
  @IsOptional()
  targetDate?: Date | null;

  @Type(() => Date)
  @IsDate({ message: 'Last reviewed at must be a valid date' })
  @IsOptional()
  lastReviewedAt?: Date | null;

  @Type(() => Date)
  @IsDate({ message: 'Next review at must be a valid date' })
  @IsOptional()
  nextReviewAt?: Date | null;

  @IsInt({ message: 'Review interval days must be an integer' })
  @Min(1, { message: 'Review interval days must be at least 1' })
  @Max(365, { message: 'Review interval days must not exceed 365' })
  @IsOptional()
  reviewIntervalDays?: number | null;

  @IsString({ message: 'Acceptance reason must be a string' })
  @IsOptional()
  acceptanceReason?: string | null;

  @IsUUID('4', { message: 'Accepted by user ID must be a valid UUID' })
  @IsOptional()
  acceptedByUserId?: string | null;

  @Type(() => Date)
  @IsDate({ message: 'Accepted at must be a valid date' })
  @IsOptional()
  acceptedAt?: Date | null;

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
