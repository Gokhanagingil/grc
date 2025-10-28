import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PolicyStatus } from '../policy-status.enum';

export class UpdatePolicyDto {
  @ApiPropertyOptional({ example: 'InfoSec Policy v2' })
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: PolicyStatus })
  @IsOptional() @IsEnum(PolicyStatus)
  status?: PolicyStatus;
}