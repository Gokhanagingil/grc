import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import {
  IncidentCategory,
  IncidentImpact,
  IncidentUrgency,
  IncidentPriority,
  IncidentStatus,
  IncidentSource,
} from '../../enums';
import { PaginationQueryDto } from '../../../grc/dto/pagination.dto';

/**
 * Incident Filter DTO
 *
 * Extends pagination with incident-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class IncidentFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @IsOptional()
  @IsEnum(IncidentCategory)
  category?: IncidentCategory;

  @IsOptional()
  @IsEnum(IncidentImpact)
  impact?: IncidentImpact;

  @IsOptional()
  @IsEnum(IncidentUrgency)
  urgency?: IncidentUrgency;

  @IsOptional()
  @IsEnum(IncidentSource)
  source?: IncidentSource;

  @IsOptional()
  @IsString()
  assignmentGroup?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Allowed sort fields for incidents
 */
export const INCIDENT_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'number',
  'shortDescription',
  'status',
  'priority',
  'category',
  'impact',
  'urgency',
  'assignmentGroup',
  'resolvedAt',
];
