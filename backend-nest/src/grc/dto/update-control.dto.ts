import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ControlStatus, ControlType, ControlFrequency } from '../enums';

/**
 * Update Control DTO
 *
 * Validates payload for updating a control.
 * All fields are optional for PATCH semantics.
 */
export class UpdateControlDto {
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsEnum(ControlStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: ControlStatus;

  @IsEnum(ControlType, { message: 'Invalid type value' })
  @IsOptional()
  type?: ControlType;

  @IsEnum(ControlFrequency, { message: 'Invalid frequency value' })
  @IsOptional()
  frequency?: ControlFrequency;

  @IsUUID('4', { message: 'Owner ID must be a valid UUID' })
  @IsOptional()
  ownerId?: string;

  @IsString({ message: 'Owner display name must be a string' })
  @IsOptional()
  ownerDisplayName?: string;

  @IsDateString({}, { message: 'Last tested date must be a valid date string' })
  @IsOptional()
  lastTestedDate?: string;

  @IsDateString({}, { message: 'Next test date must be a valid date string' })
  @IsOptional()
  nextTestDate?: string;

  @IsString({ message: 'Implementation details must be a string' })
  @IsOptional()
  implementationDetails?: string;

  @IsString({ message: 'Testing procedure must be a string' })
  @IsOptional()
  testingProcedure?: string;

  /**
   * Global effectiveness percentage for this control (0-100).
   * Used as default when calculating residual risk reduction.
   * Can be overridden per-risk via GrcRiskControl.overrideEffectivenessPercent.
   */
  @IsInt({ message: 'Effectiveness percent must be an integer' })
  @Min(0, { message: 'Effectiveness percent must be at least 0' })
  @Max(100, { message: 'Effectiveness percent must be at most 100' })
  @IsOptional()
  effectivenessPercent?: number;
}
