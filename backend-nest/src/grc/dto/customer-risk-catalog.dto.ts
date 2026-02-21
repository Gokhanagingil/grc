import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  IsUUID,
  IsIn,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from './pagination.dto';

export const CUSTOMER_RISK_CATEGORIES = [
  'OS_LIFECYCLE',
  'PATCHING',
  'BACKUP',
  'AVAILABILITY',
  'SECURITY_HARDENING',
  'OPERATIONS_HYGIENE',
  'MONITORING',
  'CERTIFICATE_MANAGEMENT',
  'DATABASE_LIFECYCLE',
  'VULNERABILITY_MANAGEMENT',
  'GOVERNANCE',
  'SERVICE_MAPPING',
  'CHANGE_MANAGEMENT',
  'SLA_COMPLIANCE',
] as const;

export const CUSTOMER_RISK_SIGNAL_TYPES = [
  'STATIC_FLAG',
  'CMDB_HEALTH_RULE',
  'ATTRIBUTE_MATCH',
  'AGE_THRESHOLD',
  'EXTERNAL_FEED_FLAG',
] as const;

export const CUSTOMER_RISK_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export const CUSTOMER_RISK_SCORE_MODELS = [
  'FLAT_POINTS',
  'WEIGHTED_FACTOR',
  'MULTIPLIER',
] as const;

export const CUSTOMER_RISK_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'DRAFT',
] as const;

export const CUSTOMER_RISK_SOURCES = [
  'MANUAL',
  'IMPORTED',
  'SYSTEM',
] as const;

export const CUSTOMER_RISK_BINDING_TARGET_TYPES = [
  'CI',
  'CI_CLASS',
  'CMDB_SERVICE',
  'CMDB_OFFERING',
  'ITSM_SERVICE',
] as const;

export const CUSTOMER_RISK_BINDING_SCOPE_MODES = [
  'DIRECT',
  'INHERITED',
] as const;

export const CUSTOMER_RISK_OBSERVATION_STATUSES = [
  'OPEN',
  'ACKNOWLEDGED',
  'WAIVED',
  'RESOLVED',
  'EXPIRED',
] as const;

export const CUSTOMER_RISK_OBSERVATION_EVIDENCE_TYPES = [
  'MANUAL',
  'IMPORT',
  'HEALTH_RULE',
  'CONNECTOR',
  'SYSTEM',
] as const;

export class CreateCustomerRiskCatalogDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn([...CUSTOMER_RISK_CATEGORIES])
  category: string;

  @IsString()
  @IsIn([...CUSTOMER_RISK_SIGNAL_TYPES])
  signalType: string;

  @IsString()
  @IsIn([...CUSTOMER_RISK_SEVERITIES])
  severity: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  likelihoodWeight?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  impactWeight?: number;

  @IsString()
  @IsIn([...CUSTOMER_RISK_SCORE_MODELS])
  @IsOptional()
  scoreContributionModel?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  scoreValue?: number;

  @IsString()
  @IsIn([...CUSTOMER_RISK_STATUSES])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  ownerGroup?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  owner?: string;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validTo?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsIn([...CUSTOMER_RISK_SOURCES])
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  sourceRef?: string;

  @IsString()
  @IsOptional()
  rationale?: string;

  @IsString()
  @IsOptional()
  remediationGuidance?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateCustomerRiskCatalogDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn([...CUSTOMER_RISK_CATEGORIES])
  @IsOptional()
  category?: string;

  @IsString()
  @IsIn([...CUSTOMER_RISK_SIGNAL_TYPES])
  @IsOptional()
  signalType?: string;

  @IsString()
  @IsIn([...CUSTOMER_RISK_SEVERITIES])
  @IsOptional()
  severity?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  likelihoodWeight?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  impactWeight?: number;

  @IsString()
  @IsIn([...CUSTOMER_RISK_SCORE_MODELS])
  @IsOptional()
  scoreContributionModel?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  scoreValue?: number;

  @IsString()
  @IsIn([...CUSTOMER_RISK_STATUSES])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  ownerGroup?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  owner?: string;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validTo?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsIn([...CUSTOMER_RISK_SOURCES])
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  sourceRef?: string;

  @IsString()
  @IsOptional()
  rationale?: string;

  @IsString()
  @IsOptional()
  remediationGuidance?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CustomerRiskCatalogFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...CUSTOMER_RISK_STATUSES])
  status?: string;

  @IsOptional()
  @IsIn([...CUSTOMER_RISK_CATEGORIES])
  category?: string;

  @IsOptional()
  @IsIn([...CUSTOMER_RISK_SEVERITIES])
  severity?: string;

  @IsOptional()
  @IsIn([...CUSTOMER_RISK_SIGNAL_TYPES])
  signalType?: string;

  @IsOptional()
  @IsIn([...CUSTOMER_RISK_SOURCES])
  source?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export const CUSTOMER_RISK_CATALOG_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
  'category',
  'severity',
  'signalType',
  'scoreValue',
  'code',
];

export class CreateCustomerRiskBindingDto {
  @IsString()
  @IsIn([...CUSTOMER_RISK_BINDING_TARGET_TYPES])
  targetType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  targetId: string;

  @IsString()
  @IsIn([...CUSTOMER_RISK_BINDING_SCOPE_MODES])
  @IsOptional()
  scopeMode?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CustomerRiskBindingFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...CUSTOMER_RISK_BINDING_TARGET_TYPES])
  targetType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enabled?: boolean;
}

export class CustomerRiskObservationFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  catalogRiskId?: string;

  @IsOptional()
  @IsIn([...CUSTOMER_RISK_OBSERVATION_STATUSES])
  status?: string;

  @IsOptional()
  @IsIn([...CUSTOMER_RISK_BINDING_TARGET_TYPES])
  targetType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsIn([...CUSTOMER_RISK_OBSERVATION_EVIDENCE_TYPES])
  evidenceType?: string;
}
