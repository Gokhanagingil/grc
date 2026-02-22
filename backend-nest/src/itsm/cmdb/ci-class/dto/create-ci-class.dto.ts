import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  IsObject,
  IsArray,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { CiClassFieldDefinition } from '../ci-class.entity';

export class CreateCiClassDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;

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
