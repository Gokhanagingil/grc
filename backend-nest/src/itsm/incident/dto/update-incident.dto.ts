import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IncidentCategory,
  IncidentImpact,
  IncidentUrgency,
  IncidentStatus,
  IncidentSource,
} from '../../enums';

/**
 * Update Incident DTO
 *
 * Validates payload for updating an existing incident.
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateIncidentDto {
  @IsString({ message: 'Short description must be a string' })
  @IsOptional()
  @MaxLength(255, {
    message: 'Short description must not exceed 255 characters',
  })
  shortDescription?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsEnum(IncidentCategory, { message: 'Invalid category value' })
  @IsOptional()
  category?: IncidentCategory;

  @IsEnum(IncidentImpact, { message: 'Invalid impact value' })
  @IsOptional()
  impact?: IncidentImpact;

  @IsEnum(IncidentUrgency, { message: 'Invalid urgency value' })
  @IsOptional()
  urgency?: IncidentUrgency;

  @IsEnum(IncidentStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: IncidentStatus;

  @IsEnum(IncidentSource, { message: 'Invalid source value' })
  @IsOptional()
  source?: IncidentSource;

  @IsString({ message: 'Assignment group must be a string' })
  @IsOptional()
  @MaxLength(100, {
    message: 'Assignment group must not exceed 100 characters',
  })
  assignmentGroup?: string;

  @IsUUID('4', { message: 'Assigned to must be a valid UUID' })
  @IsOptional()
  assignedTo?: string;

  @IsString({ message: 'Related service must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Related service must not exceed 100 characters' })
  relatedService?: string;

  @IsUUID('4', { message: 'Service ID must be a valid UUID' })
  @IsOptional()
  serviceId?: string;

  @IsUUID('4', { message: 'Offering ID must be a valid UUID' })
  @IsOptional()
  offeringId?: string;

  @IsUUID('4', { message: 'Related risk ID must be a valid UUID' })
  @IsOptional()
  relatedRiskId?: string;

  @IsUUID('4', { message: 'Related policy ID must be a valid UUID' })
  @IsOptional()
  relatedPolicyId?: string;

  @Type(() => Date)
  @IsDate({ message: 'First response at must be a valid date' })
  @IsOptional()
  firstResponseAt?: Date;

  @IsString({ message: 'Resolution notes must be a string' })
  @IsOptional()
  resolutionNotes?: string;

  @IsUUID('4', { message: 'Customer company ID must be a valid UUID' })
  @IsOptional()
  customerCompanyId?: string;

  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
