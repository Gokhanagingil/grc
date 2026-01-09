import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CapaStatus, IssueStatus } from '../enums';

/**
 * DTO for updating CAPA status
 */
export class UpdateCapaStatusDto {
  @ApiProperty({
    enum: CapaStatus,
    description: 'Target status for the CAPA',
    example: 'in_progress',
  })
  @IsEnum(CapaStatus)
  status: CapaStatus;

  @ApiPropertyOptional({
    description: 'Optional comment explaining the status change',
    example: 'Moving to in_progress after initial review',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

/**
 * DTO for updating Issue status
 */
export class UpdateIssueStatusDto {
  @ApiProperty({
    enum: IssueStatus,
    description: 'Target status for the Issue',
    example: 'in_progress',
  })
  @IsEnum(IssueStatus)
  status: IssueStatus;

  @ApiPropertyOptional({
    description: 'Optional comment explaining the status change',
    example: 'Starting investigation',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
