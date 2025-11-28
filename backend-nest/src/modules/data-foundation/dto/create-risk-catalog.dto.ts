import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  Length,
  Min,
  Max,
} from 'class-validator';
import { EntityType } from '../../../entities/app/risk-instance.entity';
import { ImpactArea } from '../../../entities/app/risk-catalog.entity';

export class CreateRiskCatalogDto {
  @ApiProperty({
    example: 'RISK-001',
    description: 'Risk code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({ 
    example: 'Data Breach Risk', 
    description: 'Risk title (preferred over name)' 
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ 
    example: 'Data Breach Risk', 
    description: 'Risk name (deprecated, use title)' 
  })
  @IsOptional()
  @IsString()
  name?: string; // Backward compatibility

  @ApiPropertyOptional({
    example: 'Unauthorized access to sensitive customer data',
    description: 'Risk statement describing the risk event',
  })
  @IsOptional()
  @IsString()
  risk_statement?: string;

  @ApiPropertyOptional({
    example: 'Insufficient access controls and lack of encryption',
    description: 'Root cause analysis of the risk',
  })
  @IsOptional()
  @IsString()
  root_cause?: string;

  @ApiPropertyOptional({
    example: 'Operations',
    description: 'Risk category code (must be from choice list)',
  })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({
    example: 'Risk description',
    description: 'Detailed risk description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: ['Confidentiality', 'Integrity', 'Finance'],
    enum: ImpactArea,
    isArray: true,
    description: 'Impact areas affected by this risk',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ImpactArea, { each: true })
  impact_areas?: ImpactArea[];

  @ApiPropertyOptional({
    example: 3,
    description: 'Default inherent likelihood (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  default_inherent_likelihood?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Default inherent impact (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  default_inherent_impact?: number;

  // Backward compatibility fields
  @ApiPropertyOptional({
    example: 3,
    description: 'Default likelihood (1-5) - deprecated, use default_inherent_likelihood',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  default_likelihood?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Default impact (1-5) - deprecated, use default_inherent_impact',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  default_impact?: number;

  @ApiPropertyOptional({
    example: ['security', 'data'],
    description: 'Tags array',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: ['control-id-1', 'control-id-2'],
    description: 'Related control IDs (deprecated, use related_controls via API)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  control_refs?: string[];

  @ApiPropertyOptional({
    example: 'Risk Owner',
    description: 'Default owner role for risk instances',
  })
  @IsOptional()
  @IsString()
  owner_role?: string;

  // Phase 12: Auto-generation fields
  @ApiPropertyOptional({
    example: 'Application',
    enum: EntityType,
    description:
      'Entity type for auto-generation (Application, Database, Process, etc.)',
  })
  @IsOptional()
  @IsEnum(EntityType)
  entity_type?: EntityType;

  @ApiPropertyOptional({
    example: 'criticality>4',
    description:
      'Boolean query filter for entities (e.g., criticality>4, status=Active)',
  })
  @IsOptional()
  @IsString()
  entity_filter?: string;
}

export class UpdateRiskCatalogDto {
  @ApiPropertyOptional({ description: 'Risk code' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  code?: string;

  @ApiPropertyOptional({ description: 'Risk title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Risk name (backward compatibility)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Risk statement' })
  @IsOptional()
  @IsString()
  risk_statement?: string;

  @ApiPropertyOptional({ description: 'Root cause' })
  @IsOptional()
  @IsString()
  root_cause?: string;

  @ApiPropertyOptional({ description: 'Category code' })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Impact areas',
    enum: ImpactArea,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ImpactArea, { each: true })
  impact_areas?: ImpactArea[];

  @ApiPropertyOptional({ description: 'Default inherent likelihood (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  default_inherent_likelihood?: number;

  @ApiPropertyOptional({ description: 'Default inherent impact (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  default_inherent_impact?: number;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Owner role' })
  @IsOptional()
  @IsString()
  owner_role?: string;

  @ApiPropertyOptional({ description: 'Entity type' })
  @IsOptional()
  @IsEnum(EntityType)
  entity_type?: EntityType;

  @ApiPropertyOptional({ description: 'Entity filter' })
  @IsOptional()
  @IsString()
  entity_filter?: string;
}
