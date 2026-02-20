import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateCiClassDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  icon?: string;

  @IsUUID('4')
  @IsOptional()
  parentClassId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
