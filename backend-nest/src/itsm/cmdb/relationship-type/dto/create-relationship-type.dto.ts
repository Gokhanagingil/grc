import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsInt,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import {
  RelationshipDirectionality,
  RiskPropagationHint,
} from '../relationship-type.entity';

export class CreateRelationshipTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RelationshipDirectionality)
  @IsOptional()
  directionality?: RelationshipDirectionality;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  inverseLabel?: string;

  @IsEnum(RiskPropagationHint)
  @IsOptional()
  riskPropagation?: RiskPropagationHint;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedSourceClasses?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedTargetClasses?: string[];

  @IsBoolean()
  @IsOptional()
  allowSelfLoop?: boolean;

  @IsBoolean()
  @IsOptional()
  allowCycles?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
