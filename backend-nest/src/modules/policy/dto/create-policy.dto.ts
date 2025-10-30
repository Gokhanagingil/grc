import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PolicyStatus } from '../policy-status.enum';

export class CreatePolicyDto {
  @ApiProperty({ example: 'Information Security Policy' })
  @IsString()
  @Length(3, 160)
  name!: string;

  @ApiProperty({ example: 'ISP-001' })
  @IsString()
  @Length(2, 64)
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({
    enum: PolicyStatus,
    required: false,
    default: PolicyStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;

  @ApiProperty({ required: false, example: 'GRC Team' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  owner?: string;

  @ApiProperty({ required: false, example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;

  @ApiProperty({ required: false, example: '2025-11-01' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiProperty({ required: false, example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  reviewDate?: string;

  @ApiProperty({ required: false, example: ['iso27001', 'infosec'] })
  @IsOptional()
  tags?: string[];
}
