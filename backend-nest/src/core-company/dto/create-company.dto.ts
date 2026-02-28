import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { CompanyType, CompanyStatus } from '../core-company.enum';

/**
 * Create Company DTO
 *
 * Validates payload for creating a new company.
 * Required fields: name
 * Optional fields: type, code, status, domain, country, notes
 */
export class CreateCompanyDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string;

  @IsEnum(CompanyType, { message: 'Invalid company type' })
  @IsOptional()
  type?: CompanyType;

  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Code must not exceed 50 characters' })
  code?: string;

  @IsEnum(CompanyStatus, { message: 'Invalid company status' })
  @IsOptional()
  status?: CompanyStatus;

  @IsString({ message: 'Domain must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Domain must not exceed 255 characters' })
  domain?: string;

  @IsString({ message: 'Country must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Country must not exceed 100 characters' })
  country?: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}
