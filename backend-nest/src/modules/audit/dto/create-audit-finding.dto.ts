import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  IsDateString,
  IsOptional,
  Length,
} from 'class-validator';
import {
  AuditFindingSeverity,
  AuditFindingStatus,
} from '../../../entities/app/audit-finding.entity';

export class CreateAuditFindingDto {
  @ApiProperty({ example: 'uuid-of-engagement', description: 'Engagement ID' })
  @IsUUID()
  engagement_id!: string;

  @ApiPropertyOptional({
    example: 'uuid-of-test',
    description: 'Test ID (optional)',
  })
  @IsOptional()
  @IsUUID()
  test_id?: string;

  @ApiProperty({
    example: 'high',
    enum: AuditFindingSeverity,
    default: 'medium',
  })
  @IsEnum(AuditFindingSeverity)
  severity!: AuditFindingSeverity;

  @ApiProperty({
    example: 'MFA Gap in Critical Services',
    description: 'Finding title',
  })
  @IsString()
  @Length(2)
  title!: string;

  @ApiPropertyOptional({
    example: 'MFA not enabled on APP-FIN and SVC-LOGIN',
    description: 'Finding description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'MFA not enabled on APP-FIN and SVC-LOGIN',
    description: 'Finding details (alias for description)',
  })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({
    example: 'Missing security controls',
    description: 'Root cause analysis',
  })
  @IsOptional()
  @IsString()
  root_cause?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-risk-catalog',
    description: 'Risk catalog entry ID (optional)',
  })
  @IsOptional()
  @IsUUID()
  risk_catalog_entry_id?: string;

  @ApiPropertyOptional({
    example: 'open',
    enum: AuditFindingStatus,
    default: 'open',
  })
  @IsOptional()
  @IsEnum(AuditFindingStatus)
  status?: AuditFindingStatus;

  @ApiPropertyOptional({
    example: '2025-02-15',
    description: 'Due date (ISO date)',
  })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  // GRC Links (optional)
  @ApiPropertyOptional({ example: 'uuid-of-policy', description: 'Policy ID' })
  @IsOptional()
  @IsUUID()
  policy_id?: string;

  @ApiPropertyOptional({ example: 'uuid-of-clause', description: 'Clause ID' })
  @IsOptional()
  @IsUUID()
  clause_id?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-control',
    description: 'Control ID',
  })
  @IsOptional()
  @IsUUID()
  control_id?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-risk-instance',
    description: 'Risk Instance ID',
  })
  @IsOptional()
  @IsUUID()
  risk_instance_id?: string;
}
