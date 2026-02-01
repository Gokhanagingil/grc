import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsDate,
  IsUUID,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssessmentType } from '../enums';

/**
 * Create Risk Assessment DTO
 *
 * Validates payload for creating a new risk assessment.
 * Required fields: likelihood, impact, assessmentType
 * Optional fields: rationale, assessedAt, assessedByUserId, metadata
 */
export class CreateRiskAssessmentDto {
  @IsEnum(AssessmentType, { message: 'Invalid assessment type value' })
  @IsNotEmpty({ message: 'Assessment type is required' })
  assessmentType: AssessmentType;

  @IsInt({ message: 'Likelihood must be an integer' })
  @Min(1, { message: 'Likelihood must be at least 1' })
  @Max(5, { message: 'Likelihood must not exceed 5' })
  likelihood: number;

  @IsInt({ message: 'Impact must be an integer' })
  @Min(1, { message: 'Impact must be at least 1' })
  @Max(5, { message: 'Impact must not exceed 5' })
  impact: number;

  @IsString({ message: 'Rationale must be a string' })
  @IsOptional()
  rationale?: string;

  @Type(() => Date)
  @IsDate({ message: 'Assessed at must be a valid date' })
  @IsOptional()
  assessedAt?: Date;

  @IsUUID('4', { message: 'Assessed by user ID must be a valid UUID' })
  @IsOptional()
  assessedByUserId?: string;

  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
