import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { EntityType, RiskStatus } from '../../../entities/app/risk-instance.entity';

export class CreateRiskInstanceDto {
  @ApiProperty({
    example: 'risk-catalog-uuid',
    description: 'Risk catalog ID (required)',
  })
  @IsUUID()
  catalog_id!: string;

  @ApiProperty({
    example: 'entity-uuid',
    description: 'Entity ID from entity registry (required)',
  })
  @IsUUID()
  entity_id!: string;

  @ApiPropertyOptional({
    example: 'Application',
    enum: EntityType,
    description: 'Entity type (optional, can be inferred from entity_id)',
  })
  @IsOptional()
  @IsEnum(EntityType)
  entity_type?: EntityType;

  @ApiPropertyOptional({
    example: 'Specific risk description for this instance',
    description: 'Instance-specific description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  // Inherent Risk Scoring
  @ApiPropertyOptional({
    example: 3,
    description: 'Inherent likelihood (1-5). Defaults to catalog default if not provided.',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  inherent_likelihood?: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Inherent impact (1-5). Defaults to catalog default if not provided.',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  inherent_impact?: number;

  // Residual Risk Scoring
  @ApiPropertyOptional({
    example: 2,
    description: 'Residual likelihood after controls (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  residual_likelihood?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Residual impact after controls (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  residual_impact?: number;

  // Treatment Plan
  @ApiPropertyOptional({
    example: 'Implement additional access controls and encryption',
    description: 'Treatment action plan',
  })
  @IsOptional()
  @IsString()
  treatment_action?: string;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'Treatment owner user ID',
  })
  @IsOptional()
  @IsUUID()
  treatment_owner_id?: string;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'Treatment due date',
  })
  @IsOptional()
  @IsDateString()
  treatment_due_date?: string;

  @ApiPropertyOptional({
    example: 'Expected reduction: Likelihood 3→2, Impact 4→2',
    description: 'Expected risk reduction description',
  })
  @IsOptional()
  @IsString()
  expected_reduction?: string;

  // Lifecycle Status
  @ApiPropertyOptional({
    example: 'draft',
    enum: RiskStatus,
    description: 'Risk status (draft, open, in_progress, mitigated, accepted, transferred, closed)',
    default: 'draft',
  })
  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'Owner user ID',
  })
  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'Assigned user ID',
  })
  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @ApiPropertyOptional({
    example: 'Additional notes about this risk instance',
    description: 'Notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  // Backward compatibility fields
  @ApiPropertyOptional({
    description: 'Legacy likelihood field (deprecated, use inherent_likelihood)',
  })
  @IsOptional()
  @IsNumber()
  likelihood?: number;

  @ApiPropertyOptional({
    description: 'Legacy impact field (deprecated, use inherent_impact)',
  })
  @IsOptional()
  @IsNumber()
  impact?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Linked control IDs (legacy field, stored as simple-array)',
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  controls_linked?: string[];
}

export class UpdateRiskInstanceDto {
  @ApiPropertyOptional({ description: 'Entity ID' })
  @IsOptional()
  @IsUUID()
  entity_id?: string;

  @ApiPropertyOptional({ description: 'Entity type' })
  @IsOptional()
  @IsEnum(EntityType)
  entity_type?: EntityType;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Inherent likelihood (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  inherent_likelihood?: number;

  @ApiPropertyOptional({ description: 'Inherent impact (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  inherent_impact?: number;

  @ApiPropertyOptional({ description: 'Residual likelihood (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  residual_likelihood?: number;

  @ApiPropertyOptional({ description: 'Residual impact (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  residual_impact?: number;

  @ApiPropertyOptional({ description: 'Treatment action' })
  @IsOptional()
  @IsString()
  treatment_action?: string;

  @ApiPropertyOptional({ description: 'Treatment owner ID' })
  @IsOptional()
  @IsUUID()
  treatment_owner_id?: string;

  @ApiPropertyOptional({ description: 'Treatment due date' })
  @IsOptional()
  @IsDateString()
  treatment_due_date?: string;

  @ApiPropertyOptional({ description: 'Expected reduction' })
  @IsOptional()
  @IsString()
  expected_reduction?: string;

  @ApiPropertyOptional({ description: 'Status', enum: RiskStatus })
  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;

  @ApiPropertyOptional({ description: 'Owner ID' })
  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @ApiPropertyOptional({ description: 'Assigned to ID' })
  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Linked control IDs (legacy field, stored as simple-array). Use linkControl/unlinkControl methods for granular updates.',
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  controls_linked?: string[];
}

