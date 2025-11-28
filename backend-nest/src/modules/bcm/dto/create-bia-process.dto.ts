import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  Min,
  Length,
} from 'class-validator';

/**
 * Note: Empty string normalization is now handled globally by NormalizationPipe.
 * No need for manual @Transform() decorators.
 */

export class CreateBIAProcessDto {
  @ApiProperty({
    example: 'PROC-PAYROLL',
    description: 'BIA Process code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({ example: 'Payroll Processing', description: 'Process name' })
  @IsString()
  @Length(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'Monthly payroll processing workflow',
    description: 'Process description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-user',
    description: 'Owner user ID',
  })
  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Criticality level (1-5)',
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  criticality?: number;

  @ApiPropertyOptional({ example: 8, description: 'RTO in hours', default: 24 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rto_hours?: number;

  @ApiPropertyOptional({ example: 4, description: 'RPO in hours', default: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rpo_hours?: number;

  @ApiPropertyOptional({
    example: 48,
    description: 'MTPD in hours',
    default: 48,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  mtpd_hours?: number;
}
