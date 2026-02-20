import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import {
  AuditStatus,
  AuditType,
  AuditRiskLevel,
} from '../entities/grc-audit.entity';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Audit Filter DTO
 *
 * Extends pagination with audit-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class AuditFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @IsOptional()
  @IsEnum(AuditType)
  auditType?: AuditType;

  @IsOptional()
  @IsEnum(AuditRiskLevel)
  riskLevel?: AuditRiskLevel;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  leadAuditorId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  plannedStartFrom?: string;

  @IsOptional()
  @IsDateString()
  plannedStartTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Allowed sort fields for audits
 */
export const AUDIT_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'status',
  'auditType',
  'riskLevel',
  'department',
  'plannedStartDate',
  'plannedEndDate',
];
