import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsObject,
  IsArray,
  MaxLength,
} from 'class-validator';
import type { CiClassFieldDefinition } from '../ci-class.entity';

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
  parentClassId?: string | null;

  @IsBoolean()
  @IsOptional()
  isAbstract?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @IsOptional()
  fieldsSchema?: CiClassFieldDefinition[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
