import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ProblemState,
  ProblemPriority,
  ProblemCategory,
  ProblemImpact,
  ProblemUrgency,
  ProblemSource,
  ProblemRiskLevel,
} from '../../enums';
import { PaginationQueryDto } from '../../../grc/dto/pagination.dto';

/**
 * Problem Filter DTO
 *
 * Extends pagination with problem-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class ProblemFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProblemState)
  state?: ProblemState;

  @IsOptional()
  @IsEnum(ProblemPriority)
  priority?: ProblemPriority;

  @IsOptional()
  @IsEnum(ProblemCategory)
  category?: ProblemCategory;

  @IsOptional()
  @IsEnum(ProblemImpact)
  impact?: ProblemImpact;

  @IsOptional()
  @IsEnum(ProblemUrgency)
  urgency?: ProblemUrgency;

  @IsOptional()
  @IsEnum(ProblemSource)
  source?: ProblemSource;

  @IsOptional()
  @Transform(({ value }): boolean | string => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as string;
  })
  @IsBoolean()
  knownError?: boolean;

  @IsOptional()
  @IsEnum(ProblemRiskLevel)
  riskLevel?: ProblemRiskLevel;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

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
 * Allowed sort fields for problems
 */
export const PROBLEM_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'number',
  'shortDescription',
  'state',
  'priority',
  'category',
  'impact',
  'urgency',
  'knownError',
  'problemOperationalRiskScore',
  'detectedAt',
  'resolvedAt',
  'closedAt',
];
