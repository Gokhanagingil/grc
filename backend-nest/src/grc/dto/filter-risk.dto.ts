import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RiskStatus, RiskSeverity, RiskLikelihood } from '../enums';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Risk Filter DTO
 *
 * Extends pagination with risk-specific filter fields.
 * All filters are optional and combined with AND logic.
 */
export class RiskFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;

  @IsOptional()
  @IsEnum(RiskSeverity)
  severity?: RiskSeverity;

  @IsOptional()
  @IsEnum(RiskLikelihood)
  likelihood?: RiskLikelihood;

  @IsOptional()
  @IsEnum(RiskSeverity)
  impact?: RiskSeverity;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Inherent likelihood must be an integer' })
  @Min(1, { message: 'Inherent likelihood must be at least 1' })
  @Max(5, { message: 'Inherent likelihood must not exceed 5' })
  inherentLikelihood?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Inherent impact must be an integer' })
  @Min(1, { message: 'Inherent impact must be at least 1' })
  @Max(5, { message: 'Inherent impact must not exceed 5' })
  inherentImpact?: number;
}

/**
 * Allowed sort fields for risks
 */
export const RISK_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
  'severity',
  'likelihood',
  'impact',
  'dueDate',
  'score',
];
