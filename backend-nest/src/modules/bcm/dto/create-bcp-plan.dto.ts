import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsArray,
  Length,
} from 'class-validator';
import { BCPPlanStatus } from '../../../entities/app/bcp-plan.entity';

/**
 * Note: Empty string normalization is now handled globally by NormalizationPipe.
 * No need for manual @Transform() decorators.
 */

export class BCPPlanStep {
  @ApiProperty({ example: 1, description: 'Step number' })
  step!: number;

  @ApiProperty({ example: 'Notify stakeholders', description: 'Step title' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Send notification to all stakeholders',
    description: 'Step description',
  })
  description?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-user',
    description: 'Step owner user ID',
  })
  owner?: string;
}

export class CreateBCPPlanDto {
  @ApiProperty({
    example: 'BCP-PAYROLL-001',
    description: 'BCP Plan code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({ example: 'Payroll BCP Plan', description: 'Plan name' })
  @IsString()
  @Length(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'uuid-of-process',
    description: 'BIA Process ID (if scope is process)',
  })
  @IsOptional()
  @IsUUID()
  process_id?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-entity',
    description: 'Scope Entity ID (if scope is entity-based)',
  })
  @IsOptional()
  @IsUUID()
  scope_entity_id?: string;

  @ApiPropertyOptional({
    example: '1.0',
    description: 'Plan version',
    default: '1.0',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    example: 'draft',
    enum: BCPPlanStatus,
    default: 'draft',
    description: 'Plan status',
  })
  @IsOptional()
  @IsEnum(BCPPlanStatus)
  status?: BCPPlanStatus;

  @ApiPropertyOptional({
    example: [
      {
        step: 1,
        title: 'Notify stakeholders',
        description: 'Send notification',
      },
    ],
    description: 'Plan steps (array)',
    type: [BCPPlanStep],
  })
  @IsOptional()
  @IsArray()
  steps?: BCPPlanStep[];
}
