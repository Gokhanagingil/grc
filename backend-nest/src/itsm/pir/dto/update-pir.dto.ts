import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { PirStatus } from '../pir.enums';

/**
 * DTO for updating a Post-Incident Review
 */
export class UpdatePirDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsEnum(PirStatus)
  status?: PirStatus;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  whatHappened?: string;

  @IsOptional()
  @IsString()
  timelineHighlights?: string;

  @IsOptional()
  @IsString()
  rootCauses?: string;

  @IsOptional()
  @IsString()
  whatWorkedWell?: string;

  @IsOptional()
  @IsString()
  whatDidNotWork?: string;

  @IsOptional()
  @IsString()
  customerImpact?: string;

  @IsOptional()
  @IsString()
  detectionEffectiveness?: string;

  @IsOptional()
  @IsString()
  responseEffectiveness?: string;

  @IsOptional()
  @IsString()
  preventiveActions?: string;

  @IsOptional()
  @IsString()
  correctiveActions?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
