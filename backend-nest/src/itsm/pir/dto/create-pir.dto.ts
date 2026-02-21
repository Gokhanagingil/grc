import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

/**
 * DTO for creating a new Post-Incident Review
 */
export class CreatePirDto {
  @IsUUID()
  majorIncidentId: string;

  @IsString()
  @MaxLength(255)
  title: string;

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
