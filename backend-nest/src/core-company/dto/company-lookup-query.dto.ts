import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyType } from '../core-company.enum';

/**
 * Query DTO for GET /grc/companies/lookup
 * Tenant-scoped company lookup for ITSM selectors (type, search, limit).
 */
export class CompanyLookupQueryDto {
  @IsOptional()
  @IsEnum(CompanyType, { message: 'Invalid company type' })
  type?: CompanyType;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
