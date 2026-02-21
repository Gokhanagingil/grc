import { IsString, IsOptional, IsEnum, IsUUID, MaxLength, IsDateString } from 'class-validator';
import { MajorIncidentStatus, MajorIncidentSeverity } from '../major-incident.enums';

/**
 * DTO for updating a Major Incident
 */
export class UpdateMajorIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MajorIncidentStatus)
  status?: MajorIncidentStatus;

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
  @IsDateString()
  bridgeEndedAt?: string;

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
  @IsString()
  resolutionSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resolutionCode?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
