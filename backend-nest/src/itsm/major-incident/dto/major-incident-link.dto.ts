import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MajorIncidentLinkType } from '../major-incident.enums';

/**
 * DTO for linking a record to a Major Incident
 */
export class CreateMajorIncidentLinkDto {
  @IsEnum(MajorIncidentLinkType)
  linkType: MajorIncidentLinkType;

  @IsUUID()
  linkedRecordId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  linkedRecordLabel?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
