import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateProcessDto {
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name?: string;

  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  @MaxLength(50, { message: 'Code must not exceed 50 characters' })
  code?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsUUID('4', { message: 'Owner user ID must be a valid UUID' })
  @IsOptional()
  ownerUserId?: string;

  @IsString({ message: 'Category must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Category must not exceed 100 characters' })
  category?: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}
