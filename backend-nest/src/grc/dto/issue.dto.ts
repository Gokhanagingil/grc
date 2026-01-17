import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsObject,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IssueType, IssueStatus, IssueSeverity, IssueSource } from '../enums';

/**
 * DTO for creating a new Issue record
 */
export class CreateIssueDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @IsOptional()
  @IsEnum(IssueSource)
  source?: IssueSource;

  @IsOptional()
  @IsUUID()
  riskId?: string;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsUUID()
  auditId?: string;

  @IsOptional()
  @IsUUID()
  testResultId?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  discoveredDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing Issue record
 */
export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @IsOptional()
  @IsUUID()
  riskId?: string;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsUUID()
  auditId?: string;

  @IsOptional()
  @IsUUID()
  testResultId?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  discoveredDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  resolvedDate?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  closureNotes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for filtering Issue list queries
 */
export class IssueFilterDto {
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @IsOptional()
  @IsEnum(IssueSource)
  source?: IssueSource;

  @IsOptional()
  @IsUUID()
  controlId?: string;

  @IsOptional()
  @IsUUID()
  auditId?: string;

  @IsOptional()
  @IsUUID()
  testResultId?: string;

  @IsOptional()
  @IsUUID()
  riskId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(ASC|DESC|asc|desc)$/, {
    message: 'sort must be in format "field:ASC" or "field:DESC"',
  })
  sort?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * DTO for linking Issue to Control
 */
export class LinkIssueControlDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for linking Issue to TestResult
 */
export class LinkIssueTestResultDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for creating an Issue from a Test Result
 * Used by POST /grc/test-results/:testResultId/issues
 *
 * This endpoint auto-generates title if not provided,
 * links the issue to the test result's control,
 * and optionally links evidences from the test result.
 */
export class CreateIssueFromTestResultDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssueSeverity)
  severity?: IssueSeverity;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
