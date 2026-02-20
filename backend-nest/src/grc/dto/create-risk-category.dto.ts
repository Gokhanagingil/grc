import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Create Risk Category DTO
 *
 * Validates payload for creating a new risk category.
 * Required fields: name
 * Optional fields: description, color, sortOrder
 */
export class CreateRiskCategoryDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'Color must be a string' })
  @IsOptional()
  @MaxLength(7, { message: 'Color must not exceed 7 characters (hex format)' })
  color?: string;

  @IsInt({ message: 'Sort order must be an integer' })
  @Min(0, { message: 'Sort order must be at least 0' })
  @IsOptional()
  sortOrder?: number;
}
