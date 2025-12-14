import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Create Standard DTO
 *
 * Validates payload for creating a new standard.
 * Required fields: code, name
 * Optional fields: version, domain, description, publisher, publishedDate
 */
export class CreateStandardDto {
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @MaxLength(100, { message: 'Code must not exceed 100 characters' })
  code: string;

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string;

  @IsString({ message: 'Version must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Version must not exceed 50 characters' })
  version?: string | null;

  @IsString({ message: 'Domain must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Domain must not exceed 100 characters' })
  domain?: string | null;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string | null;

  @IsString({ message: 'Publisher must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Publisher must not exceed 255 characters' })
  publisher?: string | null;

  @Type(() => Date)
  @IsDate({ message: 'Published date must be a valid date' })
  @IsOptional()
  publishedDate?: Date | string | null;
}
