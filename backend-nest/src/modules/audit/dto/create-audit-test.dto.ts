import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsOptional, Length } from 'class-validator';
import { AuditTestStatus } from '../../../entities/app/audit-test.entity';

export class CreateAuditTestDto {
  @ApiProperty({
    example: 'AT-CTRL-MFA-EXISTENCE',
    description: 'Test code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({
    example: 'MFA Control Existence Test',
    description: 'Test name',
  })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'uuid-of-engagement', description: 'Engagement ID' })
  @IsUUID()
  engagement_id!: string;

  @ApiPropertyOptional({
    example: 'Verify MFA control is implemented',
    description: 'Test objective',
  })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({
    example: 'All login endpoints',
    description: 'Population reference',
  })
  @IsOptional()
  @IsString()
  population_ref?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-clause',
    description: 'Standard clause ID (optional)',
  })
  @IsOptional()
  @IsUUID()
  clause_id?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-control',
    description: 'Process control ID (optional)',
  })
  @IsOptional()
  @IsUUID()
  control_id?: string;

  @ApiPropertyOptional({
    example: 'planned',
    enum: AuditTestStatus,
    default: 'planned',
  })
  @IsOptional()
  @IsEnum(AuditTestStatus)
  status?: AuditTestStatus;
}
