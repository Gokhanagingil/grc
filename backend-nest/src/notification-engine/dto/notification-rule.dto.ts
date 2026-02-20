import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationChannel,
  RecipientConfig,
} from '../entities/sys-notification-rule.entity';

export class CreateNotificationRuleDto {
  @IsString()
  name: string;

  @IsString()
  eventName: string;

  @IsObject()
  @IsOptional()
  condition?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  channels?: NotificationChannel[];

  @IsArray()
  @IsOptional()
  recipients?: RecipientConfig[];

  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  @Type(() => Number)
  rateLimitPerHour?: number;

  @IsString()
  @IsOptional()
  tableName?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateNotificationRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  eventName?: string;

  @IsObject()
  @IsOptional()
  condition?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  channels?: NotificationChannel[];

  @IsArray()
  @IsOptional()
  recipients?: RecipientConfig[];

  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  @Type(() => Number)
  rateLimitPerHour?: number;

  @IsString()
  @IsOptional()
  tableName?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class NotificationRuleFilterDto {
  @IsString()
  @IsOptional()
  eventName?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

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
