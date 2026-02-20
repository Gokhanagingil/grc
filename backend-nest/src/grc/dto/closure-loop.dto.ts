import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
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
    description: 'Optional reason explaining the status change',
    example: 'Moving to in_progress after initial review',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/**
 * DTO for updating Issue status
 *
 * Closure Loop Rules:
 * - When closing an Issue, all linked CAPAs must be CLOSED
 * - OR provide an overrideReason to close with open CAPAs (audit trail)
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
    description: 'Optional reason explaining the status change',
    example: 'Starting investigation',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Override reason to close Issue even if linked CAPAs are not closed. ' +
      'Required when closing an Issue with open CAPAs. Recorded in audit trail.',
    example: 'CAPAs transferred to different tracking system',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  overrideReason?: string;
}
