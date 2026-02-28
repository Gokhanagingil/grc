import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../grc/dto/pagination.dto';
import { CompanyType, CompanyStatus } from '../core-company.enum';

/**
 * Company Filter DTO
 *
 * Extends PaginationQueryDto with company-specific filters.
 * Supports search, type, and status filtering.
 */
export class CompanyFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CompanyType, { message: 'Invalid company type filter' })
  type?: CompanyType;

  @IsOptional()
  @IsEnum(CompanyStatus, { message: 'Invalid company status filter' })
  status?: CompanyStatus;
}

export const COMPANY_SORTABLE_FIELDS = [
  'name',
  'code',
  'type',
  'status',
  'country',
  'createdAt',
  'updatedAt',
];
