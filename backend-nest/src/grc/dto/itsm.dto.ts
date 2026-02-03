import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsObject,
  MaxLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ItsmIncidentState,
  ItsmIncidentImpact,
  ItsmIncidentUrgency,
  ItsmIncidentPriority,
  ItsmChangeType,
  ItsmChangeState,
  ItsmChangeRisk,
  ItsmApprovalStatus,
  ItsmServiceCriticality,
  ItsmServiceStatus,
} from '../enums';

// ============================================================================
// ITSM Service DTOs
// ============================================================================

/**
 * DTO for creating a new ITSM Service
 */
export class CreateItsmServiceDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ItsmServiceCriticality)
  criticality?: ItsmServiceCriticality;

  @IsOptional()
  @IsEnum(ItsmServiceStatus)
  status?: ItsmServiceStatus;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing ITSM Service
 */
export class UpdateItsmServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ItsmServiceCriticality)
  criticality?: ItsmServiceCriticality;

  @IsOptional()
  @IsEnum(ItsmServiceStatus)
  status?: ItsmServiceStatus;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering ITSM Service list queries
 */
export class ItsmServiceFilterDto {
  @IsOptional()
  @IsEnum(ItsmServiceCriticality)
  criticality?: ItsmServiceCriticality;

  @IsOptional()
  @IsEnum(ItsmServiceStatus)
  status?: ItsmServiceStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;
}

// ============================================================================
// ITSM Incident DTOs
// ============================================================================

/**
 * DTO for creating a new ITSM Incident
 */
export class CreateItsmIncidentDto {
  @IsString()
  @MaxLength(255)
  shortDescription: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ItsmIncidentState)
  state?: ItsmIncidentState;

  @IsOptional()
  @IsEnum(ItsmIncidentImpact)
  impact?: ItsmIncidentImpact;

  @IsOptional()
  @IsEnum(ItsmIncidentUrgency)
  urgency?: ItsmIncidentUrgency;

  @IsOptional()
  @IsEnum(ItsmIncidentPriority)
  priority?: ItsmIncidentPriority;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  assignmentGroupId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing ITSM Incident
 */
export class UpdateItsmIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ItsmIncidentState)
  state?: ItsmIncidentState;

  @IsOptional()
  @IsEnum(ItsmIncidentImpact)
  impact?: ItsmIncidentImpact;

  @IsOptional()
  @IsEnum(ItsmIncidentUrgency)
  urgency?: ItsmIncidentUrgency;

  @IsOptional()
  @IsEnum(ItsmIncidentPriority)
  priority?: ItsmIncidentPriority;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  assignmentGroupId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @IsOptional()
  @IsDateString()
  resolvedAt?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsBoolean()
  riskReviewRequired?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering ITSM Incident list queries
 */
export class ItsmIncidentFilterDto {
  @IsOptional()
  @IsEnum(ItsmIncidentState)
  state?: ItsmIncidentState;

  @IsOptional()
  @IsEnum(ItsmIncidentPriority)
  priority?: ItsmIncidentPriority;

  @IsOptional()
  @IsEnum(ItsmIncidentImpact)
  impact?: ItsmIncidentImpact;

  @IsOptional()
  @IsEnum(ItsmIncidentUrgency)
  urgency?: ItsmIncidentUrgency;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  riskReviewRequired?: boolean;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  filter?: string;
}

// ============================================================================
// ITSM Change DTOs
// ============================================================================

/**
 * DTO for creating a new ITSM Change
 */
export class CreateItsmChangeDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ItsmChangeType)
  type?: ItsmChangeType;

  @IsOptional()
  @IsEnum(ItsmChangeState)
  state?: ItsmChangeState;

  @IsOptional()
  @IsEnum(ItsmChangeRisk)
  risk?: ItsmChangeRisk;

  @IsOptional()
  @IsEnum(ItsmApprovalStatus)
  approvalStatus?: ItsmApprovalStatus;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsDateString()
  plannedStartAt?: string;

  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  @IsOptional()
  @IsString()
  implementationPlan?: string;

  @IsOptional()
  @IsString()
  backoutPlan?: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing ITSM Change
 */
export class UpdateItsmChangeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ItsmChangeType)
  type?: ItsmChangeType;

  @IsOptional()
  @IsEnum(ItsmChangeState)
  state?: ItsmChangeState;

  @IsOptional()
  @IsEnum(ItsmChangeRisk)
  risk?: ItsmChangeRisk;

  @IsOptional()
  @IsEnum(ItsmApprovalStatus)
  approvalStatus?: ItsmApprovalStatus;

  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsDateString()
  plannedStartAt?: string;

  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  @IsOptional()
  @IsDateString()
  actualStartAt?: string;

  @IsOptional()
  @IsDateString()
  actualEndAt?: string;

  @IsOptional()
  @IsString()
  implementationPlan?: string;

  @IsOptional()
  @IsString()
  backoutPlan?: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering ITSM Change list queries
 */
export class ItsmChangeFilterDto {
  @IsOptional()
  @IsEnum(ItsmChangeState)
  state?: ItsmChangeState;

  @IsOptional()
  @IsEnum(ItsmChangeType)
  type?: ItsmChangeType;

  @IsOptional()
  @IsEnum(ItsmChangeRisk)
  risk?: ItsmChangeRisk;

  @IsOptional()
  @IsEnum(ItsmApprovalStatus)
  approvalStatus?: ItsmApprovalStatus;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  filter?: string;
}

// ============================================================================
// GRC Bridge DTOs
// ============================================================================

/**
 * DTO for linking an ITSM record to a GRC Risk or Control
 */
export class LinkItsmGrcDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
