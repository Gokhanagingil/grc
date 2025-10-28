import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PolicyStatus } from '../policy-status.enum';

export class CreatePolicyDto {
  @ApiProperty({ example: 'Information Security Policy' })
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: PolicyStatus, required: false, default: PolicyStatus.DRAFT })
  @IsOptional() @IsEnum(PolicyStatus)
  status?: PolicyStatus;
}