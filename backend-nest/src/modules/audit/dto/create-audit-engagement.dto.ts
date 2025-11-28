import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsOptional, Length } from 'class-validator';
import { AuditEngagementStatus } from '../../../entities/app/audit-engagement.entity';

export class CreateAuditEngagementDto {
  @ApiProperty({
    example: 'AE-LOGIN-001',
    description: 'Engagement code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({
    example: 'Auth & Login Service Audit',
    description: 'Engagement name',
  })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'uuid-of-plan', description: 'Audit plan ID' })
  @IsUUID()
  plan_id!: string;

  @ApiPropertyOptional({
    example: 'Auth & Login Service',
    description: 'Auditee name',
  })
  @IsOptional()
  @IsString()
  auditee?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-user',
    description: 'Lead auditor user ID',
  })
  @IsOptional()
  @IsUUID()
  lead_auditor_id?: string;

  @ApiPropertyOptional({
    example: 'planned',
    enum: AuditEngagementStatus,
    default: 'planned',
  })
  @IsOptional()
  @IsEnum(AuditEngagementStatus)
  status?: AuditEngagementStatus;
}
