import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsObject,
  MaxLength,
  IsArray,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  BcmServiceStatus,
  BcmCriticalityTier,
  BcmBiaStatus,
  BcmPlanType,
  BcmPlanStatus,
  BcmPlanStepStatus,
  BcmExerciseType,
  BcmExerciseStatus,
  BcmExerciseOutcome,
} from '../enums';

/**
 * Transform to normalize enum values to uppercase.
 */
const UppercaseEnumTransform = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

// ============================================================================
// BCM Service DTOs
// ============================================================================

/**
 * DTO for creating a new BCM Service
 */
export class CreateBcmServiceDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmServiceStatus)
  status?: BcmServiceStatus;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmCriticalityTier)
  criticalityTier?: BcmCriticalityTier;

  @IsOptional()
  @IsUUID()
  businessOwnerUserId?: string;

  @IsOptional()
  @IsUUID()
  itOwnerUserId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a BCM Service
 */
export class UpdateBcmServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmServiceStatus)
  status?: BcmServiceStatus;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmCriticalityTier)
  criticalityTier?: BcmCriticalityTier;

  @IsOptional()
  @IsUUID()
  businessOwnerUserId?: string;

  @IsOptional()
  @IsUUID()
  itOwnerUserId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering BCM Service list queries
 */
export class BcmServiceFilterDto {
  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmServiceStatus)
  status?: BcmServiceStatus;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmCriticalityTier)
  criticalityTier?: BcmCriticalityTier;

  @IsOptional()
  @IsUUID()
  businessOwnerUserId?: string;

  @IsOptional()
  @IsUUID()
  itOwnerUserId?: string;

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
// BCM BIA DTOs
// ============================================================================

/**
 * DTO for creating a new BCM BIA
 */
export class CreateBcmBiaDto {
  @IsUUID()
  serviceId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rtoMinutes: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rpoMinutes: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mtpdMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactOperational?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactFinancial?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactRegulatory?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactReputational?: number;

  @IsOptional()
  @IsString()
  assumptions?: string;

  @IsOptional()
  @IsString()
  dependencies?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmBiaStatus)
  status?: BcmBiaStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a BCM BIA
 */
export class UpdateBcmBiaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rtoMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rpoMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mtpdMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactOperational?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactFinancial?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactRegulatory?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  impactReputational?: number;

  @IsOptional()
  @IsString()
  assumptions?: string;

  @IsOptional()
  @IsString()
  dependencies?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmBiaStatus)
  status?: BcmBiaStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering BCM BIA list queries
 */
export class BcmBiaFilterDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmBiaStatus)
  status?: BcmBiaStatus;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmCriticalityTier)
  criticalityTier?: BcmCriticalityTier;

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
// BCM Plan DTOs
// ============================================================================

/**
 * DTO for creating a new BCM Plan
 */
export class CreateBcmPlanDto {
  @IsUUID()
  serviceId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanType)
  planType?: BcmPlanType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanStatus)
  status?: BcmPlanStatus;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  triggers?: string;

  @IsOptional()
  @IsString()
  recoverySteps?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a BCM Plan
 */
export class UpdateBcmPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanType)
  planType?: BcmPlanType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanStatus)
  status?: BcmPlanStatus;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  approverUserId?: string;

  @IsOptional()
  @IsDateString()
  approvedAt?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  triggers?: string;

  @IsOptional()
  @IsString()
  recoverySteps?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering BCM Plan list queries
 */
export class BcmPlanFilterDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanType)
  planType?: BcmPlanType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanStatus)
  status?: BcmPlanStatus;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

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
// BCM Plan Step DTOs
// ============================================================================

/**
 * DTO for creating a new BCM Plan Step
 */
export class CreateBcmPlanStepDto {
  @IsUUID()
  planId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  order: number;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  roleResponsible?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMinutes?: number;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanStepStatus)
  status?: BcmPlanStepStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a BCM Plan Step
 */
export class UpdateBcmPlanStepDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  roleResponsible?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedMinutes?: number;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanStepStatus)
  status?: BcmPlanStepStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering BCM Plan Step list queries
 */
export class BcmPlanStepFilterDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmPlanStepStatus)
  status?: BcmPlanStepStatus;

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
// BCM Exercise DTOs
// ============================================================================

/**
 * DTO for creating a new BCM Exercise
 */
export class CreateBcmExerciseDto {
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseType)
  exerciseType?: BcmExerciseType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseStatus)
  status?: BcmExerciseStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a BCM Exercise
 */
export class UpdateBcmExerciseDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseType)
  exerciseType?: BcmExerciseType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseStatus)
  status?: BcmExerciseStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseOutcome)
  outcome?: BcmExerciseOutcome;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  lessonsLearned?: string;

  @IsOptional()
  @IsUUID()
  linkedIssueId?: string;

  @IsOptional()
  @IsUUID()
  linkedCapaId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering BCM Exercise list queries
 */
export class BcmExerciseFilterDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseType)
  exerciseType?: BcmExerciseType;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseStatus)
  status?: BcmExerciseStatus;

  @IsOptional()
  @UppercaseEnumTransform()
  @IsEnum(BcmExerciseOutcome)
  outcome?: BcmExerciseOutcome;

  @IsOptional()
  @IsDateString()
  scheduledFrom?: string;

  @IsOptional()
  @IsDateString()
  scheduledTo?: string;

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
