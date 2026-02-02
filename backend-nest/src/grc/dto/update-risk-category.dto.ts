import { IsString, IsOptional, IsInt, MaxLength, Min } from 'class-validator';

/**
 * Update Risk Category DTO
 *
 * Validates payload for updating an existing risk category.
 * All fields are optional for PATCH semantics.
 */
export class UpdateRiskCategoryDto {
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string | null;

  @IsString({ message: 'Color must be a string' })
  @IsOptional()
  @MaxLength(7, { message: 'Color must not exceed 7 characters (hex format)' })
  color?: string | null;

  @IsInt({ message: 'Sort order must be an integer' })
  @Min(0, { message: 'Sort order must be at least 0' })
  @IsOptional()
  sortOrder?: number;
}
