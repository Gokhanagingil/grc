import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  IsObject,
} from 'class-validator';
import { ConnectorType } from '../connector/connector.types';
import { TransformDef, FieldMappingEntry } from '../engine/safe-transforms';

export class CreateImportMappingDto {
  @IsUUID()
  sourceId: string;

  @IsUUID()
  @IsOptional()
  targetClassId?: string;

  @IsEnum(ConnectorType)
  @IsOptional()
  connectorType?: ConnectorType;

  @IsArray()
  @IsOptional()
  fieldMap?: FieldMappingEntry[];

  @IsArray()
  @IsOptional()
  keyFields?: string[];

  @IsArray()
  @IsOptional()
  transforms?: TransformDef[];

  @IsObject()
  @IsOptional()
  connectorConfig?: Record<string, unknown>;
}

export class UpdateImportMappingDto {
  @IsUUID()
  @IsOptional()
  targetClassId?: string;

  @IsEnum(ConnectorType)
  @IsOptional()
  connectorType?: ConnectorType;

  @IsArray()
  @IsOptional()
  fieldMap?: FieldMappingEntry[];

  @IsArray()
  @IsOptional()
  keyFields?: string[];

  @IsArray()
  @IsOptional()
  transforms?: TransformDef[];

  @IsObject()
  @IsOptional()
  connectorConfig?: Record<string, unknown>;
}

export class ImportMappingFilterDto {
  @IsString()
  @IsOptional()
  sourceId?: string;
}
