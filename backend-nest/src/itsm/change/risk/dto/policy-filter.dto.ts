import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PolicyFilterDto {
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
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export const POLICY_SORTABLE_FIELDS = [
  'name',
  'priority',
  'isActive',
  'createdAt',
  'updatedAt',
];
