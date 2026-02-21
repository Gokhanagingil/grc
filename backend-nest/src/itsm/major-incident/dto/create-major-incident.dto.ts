import { IsString, IsOptional, IsEnum, IsUUID, MaxLength, IsDateString } from 'class-validator';
import { MajorIncidentSeverity } from '../major-incident.enums';

/**
 * DTO for creating a new Major Incident
 */
export class CreateMajorIncidentDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MajorIncidentSeverity)
  severity?: MajorIncidentSeverity;

  @IsOptional()
  @IsUUID()
  commanderId?: string;

  @IsOptional()
  @IsUUID()
  communicationsLeadId?: string;

  @IsOptional()
  @IsUUID()
  techLeadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bridgeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bridgeChannel?: string;

  @IsOptional()
  @IsDateString()
  bridgeStartedAt?: string;

  @IsOptional()
  @IsString()
  customerImpactSummary?: string;

  @IsOptional()
  @IsString()
  businessImpactSummary?: string;

  @IsOptional()
  @IsUUID()
  primaryServiceId?: string;

  @IsOptional()
  @IsUUID()
  primaryOfferingId?: string;

  @IsOptional()
  @IsUUID()
  sourceIncidentId?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
