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
import { RiskSeverity, RiskLikelihood, RiskStatus } from '../enums';

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

  @IsEnum(RiskStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: RiskStatus;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string;

  @Type(() => Date)
  @IsDate({ message: 'Due date must be a valid date' })
  @IsOptional()
  dueDate?: Date;

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
