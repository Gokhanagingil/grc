import { IsString, IsOptional, IsEnum } from 'class-validator';
import {
  MajorIncidentUpdateType,
  MajorIncidentUpdateVisibility,
} from '../major-incident.enums';

/**
 * DTO for posting a timeline update to a Major Incident
 */
export class CreateMajorIncidentUpdateDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsEnum(MajorIncidentUpdateType)
  updateType?: MajorIncidentUpdateType;

  @IsOptional()
  @IsEnum(MajorIncidentUpdateVisibility)
  visibility?: MajorIncidentUpdateVisibility;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
