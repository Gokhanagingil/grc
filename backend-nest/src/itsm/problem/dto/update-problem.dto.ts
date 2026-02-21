import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ProblemCategory,
  ProblemImpact,
  ProblemUrgency,
  ProblemState,
  ProblemSource,
} from '../../enums';
import { RcaEntryDto } from './create-problem.dto';

/**
 * Update Problem DTO
 *
 * Validates payload for updating an existing problem.
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateProblemDto {
  @IsString({ message: 'Short description must be a string' })
  @IsOptional()
  @MaxLength(255, {
    message: 'Short description must not exceed 255 characters',
  })
  shortDescription?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsEnum(ProblemCategory, { message: 'Invalid category value' })
  @IsOptional()
  category?: ProblemCategory;

  @IsString({ message: 'Subcategory must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Subcategory must not exceed 100 characters' })
  subcategory?: string;

  @IsEnum(ProblemState, { message: 'Invalid state value' })
  @IsOptional()
  state?: ProblemState;

  @IsEnum(ProblemImpact, { message: 'Invalid impact value' })
  @IsOptional()
  impact?: ProblemImpact;

  @IsEnum(ProblemUrgency, { message: 'Invalid urgency value' })
  @IsOptional()
  urgency?: ProblemUrgency;

  @IsEnum(ProblemSource, { message: 'Invalid source value' })
  @IsOptional()
  source?: ProblemSource;

  @IsString({ message: 'Symptom summary must be a string' })
  @IsOptional()
  symptomSummary?: string;

  @IsString({ message: 'Workaround summary must be a string' })
  @IsOptional()
  workaroundSummary?: string;

  @IsString({ message: 'Root cause summary must be a string' })
  @IsOptional()
  rootCauseSummary?: string;

  @IsBoolean({ message: 'Known error must be a boolean' })
  @IsOptional()
  knownError?: boolean;

  @IsString({ message: 'Error condition must be a string' })
  @IsOptional()
  errorCondition?: string;

  @IsString({ message: 'Assignment group must be a string' })
  @IsOptional()
  @MaxLength(100, {
    message: 'Assignment group must not exceed 100 characters',
  })
  assignmentGroup?: string;

  @IsUUID('4', { message: 'Assigned to must be a valid UUID' })
  @IsOptional()
  assignedTo?: string;

  @IsUUID('4', { message: 'Service ID must be a valid UUID' })
  @IsOptional()
  serviceId?: string;

  @IsUUID('4', { message: 'Offering ID must be a valid UUID' })
  @IsOptional()
  offeringId?: string;

  @IsDateString({}, { message: 'Detected at must be a valid ISO date string' })
  @IsOptional()
  detectedAt?: string;

  @IsDateString({}, { message: 'Opened at must be a valid ISO date string' })
  @IsOptional()
  openedAt?: string;

  @IsDateString({}, { message: 'Resolved at must be a valid ISO date string' })
  @IsOptional()
  resolvedAt?: string;

  @IsDateString({}, { message: 'Closed at must be a valid ISO date string' })
  @IsOptional()
  closedAt?: string;

  @IsArray({ message: 'RCA entries must be an array' })
  @ValidateNested({ each: true })
  @Type(() => RcaEntryDto)
  @IsOptional()
  rcaEntries?: RcaEntryDto[];

  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
