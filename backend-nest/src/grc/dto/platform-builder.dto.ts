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
import { PlatformBuilderFieldType } from '../enums';
import { SysRelationshipType } from '../entities/sys-relationship.entity';
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

  @IsString({ message: 'extends must be a string' })
  @IsOptional()
  @MaxLength(100)
  extends?: string;

  @IsString({ message: 'displayField must be a string' })
  @IsOptional()
  @MaxLength(100)
  displayField?: string;

  @IsString({ message: 'numberPrefix must be a string' })
  @IsOptional()
  @MaxLength(20)
  numberPrefix?: string;
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

  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayField?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  numberPrefix?: string;
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

  @IsEnum(PlatformBuilderFieldType, { message: 'Invalid field type' })
  @IsOptional()
  type?: PlatformBuilderFieldType;

  @IsBoolean({ message: 'isRequired must be a boolean' })
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean({ message: 'isUnique must be a boolean' })
  @IsOptional()
  isUnique?: boolean;

  @IsBoolean({ message: 'readOnly must be a boolean' })
  @IsOptional()
  readOnly?: boolean;

  @IsString({ message: 'Reference table must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Reference table must not exceed 100 characters' })
  referenceTable?: string;

  @IsArray({ message: 'Choice options must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ChoiceOptionDto)
  @IsOptional()
  choiceOptions?: ChoiceOptionDto[];

  @IsString({ message: 'choiceTable must be a string' })
  @IsOptional()
  @MaxLength(100)
  choiceTable?: string;

  @IsString({ message: 'Default value must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Default value must not exceed 500 characters' })
  defaultValue?: string;

  @IsInt({ message: 'maxLength must be an integer' })
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxLength?: number;

  @IsInt({ message: 'Field order must be an integer' })
  @Min(0, { message: 'Field order must be at least 0' })
  @IsOptional()
  @Type(() => Number)
  fieldOrder?: number;

  @IsBoolean({ message: 'indexed must be a boolean' })
  @IsOptional()
  indexed?: boolean;

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

  @IsEnum(PlatformBuilderFieldType, { message: 'Invalid field type' })
  @IsOptional()
  type?: PlatformBuilderFieldType;

  @IsBoolean({ message: 'isRequired must be a boolean' })
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean({ message: 'isUnique must be a boolean' })
  @IsOptional()
  isUnique?: boolean;

  @IsBoolean({ message: 'readOnly must be a boolean' })
  @IsOptional()
  readOnly?: boolean;

  @IsString({ message: 'Reference table must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Reference table must not exceed 100 characters' })
  referenceTable?: string;

  @IsArray({ message: 'Choice options must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ChoiceOptionDto)
  @IsOptional()
  choiceOptions?: ChoiceOptionDto[];

  @IsString({ message: 'choiceTable must be a string' })
  @IsOptional()
  @MaxLength(100)
  choiceTable?: string;

  @IsString({ message: 'Default value must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Default value must not exceed 500 characters' })
  defaultValue?: string;

  @IsInt({ message: 'maxLength must be an integer' })
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxLength?: number;

  @IsInt({ message: 'Field order must be an integer' })
  @Min(0, { message: 'Field order must be at least 0' })
  @IsOptional()
  @Type(() => Number)
  fieldOrder?: number;

  @IsBoolean({ message: 'indexed must be a boolean' })
  @IsOptional()
  indexed?: boolean;

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
  @IsEnum(PlatformBuilderFieldType)
  type?: PlatformBuilderFieldType;
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
  isCore: boolean;
  extends: string | null;
  displayField: string | null;
  numberPrefix: string | null;
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
  type: PlatformBuilderFieldType;
  isRequired: boolean;
  isUnique: boolean;
  readOnly: boolean;
  referenceTable: string | null;
  choiceOptions: { label: string; value: string }[] | null;
  choiceTable: string | null;
  defaultValue: string | null;
  maxLength: number | null;
  fieldOrder: number;
  indexed: boolean;
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

// ============================================================================
// Relationship (SysRelationship) DTOs
// ============================================================================

export class CreateRelationshipDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fromTable: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  toTable: string;

  @IsEnum(SysRelationshipType)
  @IsOptional()
  type?: SysRelationshipType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  fkColumn?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  m2mTable?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class RelationshipFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  fromTable?: string;

  @IsOptional()
  @IsString()
  toTable?: string;
}

export interface RelationshipResponse {
  id: string;
  name: string;
  fromTable: string;
  toTable: string;
  type: SysRelationshipType;
  fkColumn: string | null;
  m2mTable: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
