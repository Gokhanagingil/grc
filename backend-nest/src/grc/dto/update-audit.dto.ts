import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsObject,
  MaxLength,
} from 'class-validator';
import {
  AuditStatus,
  AuditType,
  AuditRiskLevel,
} from '../entities/grc-audit.entity';

/**
 * Update Audit DTO
 *
 * Validates payload for updating an existing audit.
 * All fields are optional.
 */
export class UpdateAuditDto {
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsEnum(AuditType, { message: 'Invalid audit type value' })
  @IsOptional()
  auditType?: AuditType;

  @IsEnum(AuditStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: AuditStatus;

  @IsEnum(AuditRiskLevel, { message: 'Invalid risk level value' })
  @IsOptional()
  riskLevel?: AuditRiskLevel;

  @IsString({ message: 'Department must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Department must not exceed 255 characters' })
  department?: string;

  @IsUUID('4', { message: 'Lead auditor ID must be a valid UUID' })
  @IsOptional()
  leadAuditorId?: string;

  @IsDateString({}, { message: 'Planned start date must be a valid date string' })
  @IsOptional()
  plannedStartDate?: string;

  @IsDateString({}, { message: 'Planned end date must be a valid date string' })
  @IsOptional()
  plannedEndDate?: string;

  @IsDateString({}, { message: 'Actual start date must be a valid date string' })
  @IsOptional()
  actualStartDate?: string;

  @IsDateString({}, { message: 'Actual end date must be a valid date string' })
  @IsOptional()
  actualEndDate?: string;

  @IsString({ message: 'Scope must be a string' })
  @IsOptional()
  scope?: string;

  @IsString({ message: 'Objectives must be a string' })
  @IsOptional()
  objectives?: string;

  @IsString({ message: 'Methodology must be a string' })
  @IsOptional()
  methodology?: string;

  @IsString({ message: 'Findings summary must be a string' })
  @IsOptional()
  findingsSummary?: string;

  @IsString({ message: 'Recommendations must be a string' })
  @IsOptional()
  recommendations?: string;

  @IsString({ message: 'Conclusion must be a string' })
  @IsOptional()
  conclusion?: string;

  @IsObject({ message: 'Metadata must be an object' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
