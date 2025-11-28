import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  Length,
} from 'class-validator';
import { AuditPlanStatus } from '../../../entities/app/audit-plan.entity';

export class CreateAuditPlanDto {
  @ApiProperty({
    example: 'AP-2025-H2',
    description: 'Audit plan code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({ example: '2025 H2 Audit Plan', description: 'Plan name' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: '2025-07-01',
    description: 'Period start date (ISO format)',
  })
  @IsDateString()
  period_start!: string;

  @ApiProperty({
    example: '2025-12-31',
    description: 'Period end date (ISO format)',
  })
  @IsDateString()
  period_end!: string;

  @ApiPropertyOptional({
    example: 'Core services & critical apps',
    description: 'Scope description',
  })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({
    example: 'planned',
    enum: AuditPlanStatus,
    default: 'planned',
  })
  @IsOptional()
  @IsEnum(AuditPlanStatus)
  status?: AuditPlanStatus;
}
