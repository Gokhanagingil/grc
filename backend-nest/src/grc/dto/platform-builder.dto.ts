import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DictionaryFieldType } from '../enums';
import { PaginationQueryDto } from './pagination.dto';

// ============================================================================
// Table (SysDbObject) DTOs
// ============================================================================

/**
 * Create Table DTO
 * Validates payload for creating a new dynamic table definition.
 */
export class CreateTableDto {
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @Matches(/^u_[a-z0-9_]+$/, {
    message: 'Table name must match pattern: u_[a-z0-9_]+',
  })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @IsString({ message: 'Label must be a string' })
  @IsNotEmpty({ message: 'Label is required' })
  @MaxLength(255, { message: 'Label must not exceed 255 characters' })
  label: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}

/**
 * Update Table DTO
 * Validates payload for updating an existing dynamic table definition.
 */
export class UpdateTableDto {
  @IsString({ message: 'Label must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Label must not exceed 255 characters' })
  label?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}

/**
 * Table Filter DTO
 * Query parameters for filtering table list.
 */
export class TableFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

// ============================================================================
// Field (SysDictionary) DTOs
// ============================================================================

/**
 * Choice Option DTO
 * Represents a single option for choice-type fields.
 */
export class ChoiceOptionDto {
  @IsString({ message: 'Label must be a string' })
  @IsNotEmpty({ message: 'Label is required' })
  label: string;

  @IsString({ message: 'Value must be a string' })
  @IsNotEmpty({ message: 'Value is required' })
  value: string;
}

/**
 * Create Field DTO
 * Validates payload for creating a new field definition.
 */
export class CreateFieldDto {
  @IsString({ message: 'Field name must be a string' })
  @IsNotEmpty({ message: 'Field name is required' })
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Field name must match pattern: [a-z][a-z0-9_]*',
  })
  @MaxLength(100, { message: 'Field name must not exceed 100 characters' })
  fieldName: string;

  @IsString({ message: 'Label must be a string' })
  @IsNotEmpty({ message: 'Label is required' })
  @MaxLength(255, { message: 'Label must not exceed 255 characters' })
  label: string;

  @IsEnum(DictionaryFieldType, { message: 'Invalid field type' })
  @IsOptional()
  type?: DictionaryFieldType;

  @IsBoolean({ message: 'isRequired must be a boolean' })
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean({ message: 'isUnique must be a boolean' })
  @IsOptional()
  isUnique?: boolean;

  @IsString({ message: 'Reference table must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Reference table must not exceed 100 characters' })
  referenceTable?: string;

  @IsArray({ message: 'Choice options must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ChoiceOptionDto)
  @IsOptional()
  choiceOptions?: ChoiceOptionDto[];

  @IsString({ message: 'Default value must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Default value must not exceed 500 characters' })
  defaultValue?: string;

  @IsInt({ message: 'Field order must be an integer' })
  @Min(0, { message: 'Field order must be at least 0' })
  @IsOptional()
  @Type(() => Number)
  fieldOrder?: number;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}

/**
 * Update Field DTO
 * Validates payload for updating an existing field definition.
 */
export class UpdateFieldDto {
  @IsString({ message: 'Label must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Label must not exceed 255 characters' })
  label?: string;

  @IsEnum(DictionaryFieldType, { message: 'Invalid field type' })
  @IsOptional()
  type?: DictionaryFieldType;

  @IsBoolean({ message: 'isRequired must be a boolean' })
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean({ message: 'isUnique must be a boolean' })
  @IsOptional()
  isUnique?: boolean;

  @IsString({ message: 'Reference table must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Reference table must not exceed 100 characters' })
  referenceTable?: string;

  @IsArray({ message: 'Choice options must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ChoiceOptionDto)
  @IsOptional()
  choiceOptions?: ChoiceOptionDto[];

  @IsString({ message: 'Default value must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Default value must not exceed 500 characters' })
  defaultValue?: string;

  @IsInt({ message: 'Field order must be an integer' })
  @Min(0, { message: 'Field order must be at least 0' })
  @IsOptional()
  @Type(() => Number)
  fieldOrder?: number;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;
}

/**
 * Field Filter DTO
 * Query parameters for filtering field list.
 */
export class FieldFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsEnum(DictionaryFieldType)
  type?: DictionaryFieldType;
}

// ============================================================================
// Dynamic Record DTOs
// ============================================================================

/**
 * Create Record DTO
 * Validates payload for creating a new dynamic record.
 * The data field contains the actual record data as key-value pairs.
 */
export class CreateRecordDto {
  @IsNotEmpty({ message: 'Data is required' })
  data: Record<string, unknown>;
}

/**
 * Update Record DTO
 * Validates payload for updating an existing dynamic record.
 */
export class UpdateRecordDto {
  @IsNotEmpty({ message: 'Data is required' })
  data: Record<string, unknown>;
}

/**
 * Record Filter DTO
 * Query parameters for filtering dynamic records.
 */
export class RecordFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  filter?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Table Response - Shape of table data in API responses
 */
export interface TableResponse {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  fieldCount?: number;
  recordCount?: number;
}

/**
 * Field Response - Shape of field data in API responses
 */
export interface FieldResponse {
  id: string;
  tableName: string;
  fieldName: string;
  label: string;
  type: DictionaryFieldType;
  isRequired: boolean;
  isUnique: boolean;
  referenceTable: string | null;
  choiceOptions: { label: string; value: string }[] | null;
  defaultValue: string | null;
  fieldOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Record Response - Shape of dynamic record data in API responses
 */
export interface RecordResponse {
  id: string;
  recordId: string;
  tableName: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}
