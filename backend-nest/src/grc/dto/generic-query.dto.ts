import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  IsNotEmpty,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LogicalOperator } from '../enums';

export enum GenericFilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  IN = 'in',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  IS_EMPTY = 'is_empty',
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  AFTER = 'after',
  BEFORE = 'before',
}

export class FilterConditionDto {
  @IsString()
  @IsNotEmpty()
  field: string;

  @IsEnum(GenericFilterOperator)
  operator: GenericFilterOperator;

  @IsOptional()
  value?: unknown;
}

export class FilterGroupDto {
  @IsEnum(LogicalOperator)
  @IsOptional()
  logic?: LogicalOperator;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterConditionDto)
  @IsOptional()
  conditions?: FilterConditionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterGroupDto)
  @IsOptional()
  groups?: FilterGroupDto[];
}

export class GenericQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  filter?: string;
}

export interface GenericQueryResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
