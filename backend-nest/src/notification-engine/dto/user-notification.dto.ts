import {
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UserNotificationFilterDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  /** Filter by source module: TODO, GRC, ITSM, SYSTEM */
  @IsString()
  @IsOptional()
  module?: string;

  /** Filter by notification type: ASSIGNMENT, DUE_DATE, STATUS_CHANGE, etc. */
  @IsString()
  @IsOptional()
  type?: string;

  /** Filter by severity: INFO, WARNING, CRITICAL */
  @IsString()
  @IsOptional()
  severity?: string;

  /** Tab filter: 'all' | 'assignments' | 'due_soon' */
  @IsString()
  @IsOptional()
  tab?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class ExecuteActionDto {
  /** Optional payload overrides (e.g., new due date) */
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  @IsOptional()
  notifyOnAssignment?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnDueDate?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnGroupAssignment?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOnSystem?: boolean;
}
