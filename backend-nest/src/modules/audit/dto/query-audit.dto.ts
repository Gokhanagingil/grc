import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/search/pagination.dto';
import { AuditPlanStatus } from '../../../entities/app/audit-plan.entity';
import { AuditEngagementStatus } from '../../../entities/app/audit-engagement.entity';
import { AuditTestStatus } from '../../../entities/app/audit-test.entity';
import {
  AuditFindingSeverity,
  AuditFindingStatus,
} from '../../../entities/app/audit-finding.entity';
import { CorrectiveActionStatus } from '../../../entities/app/corrective-action.entity';

export class QueryAuditPlanDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'AP-2025',
    description: 'Search by code/name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'in_progress', enum: AuditPlanStatus })
  @IsOptional()
  @IsEnum(AuditPlanStatus)
  status?: AuditPlanStatus;
}

export class QueryAuditEngagementDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-plan',
    description: 'Filter by plan ID',
  })
  @IsOptional()
  @IsString()
  plan_id?: string;

  @ApiPropertyOptional({ example: 'planned', enum: AuditEngagementStatus })
  @IsOptional()
  @IsEnum(AuditEngagementStatus)
  status?: AuditEngagementStatus;

  @ApiPropertyOptional({
    example: 'AE-LOGIN',
    description: 'Search by code/name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryAuditTestDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-engagement',
    description: 'Filter by engagement ID',
  })
  @IsOptional()
  @IsString()
  engagement_id?: string;

  @ApiPropertyOptional({ example: 'passed', enum: AuditTestStatus })
  @IsOptional()
  @IsEnum(AuditTestStatus)
  status?: AuditTestStatus;
}

export class QueryAuditFindingDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-engagement',
    description: 'Filter by engagement ID',
  })
  @IsOptional()
  @IsString()
  engagement_id?: string;

  @ApiPropertyOptional({ example: 'high', enum: AuditFindingSeverity })
  @IsOptional()
  @IsEnum(AuditFindingSeverity)
  severity?: AuditFindingSeverity;

  @ApiPropertyOptional({ example: 'open', enum: AuditFindingStatus })
  @IsOptional()
  @IsEnum(AuditFindingStatus)
  status?: AuditFindingStatus;

  @ApiPropertyOptional({
    example: '2025-02-15',
    description: 'Due date filter (>=)',
  })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({
    example: 'MFA',
    description: 'Search by title/details',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryCorrectiveActionDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-finding',
    description: 'Filter by finding ID',
  })
  @IsOptional()
  @IsString()
  finding_id?: string;

  @ApiPropertyOptional({ example: 'open', enum: CorrectiveActionStatus })
  @IsOptional()
  @IsEnum(CorrectiveActionStatus)
  status?: CorrectiveActionStatus;
}
