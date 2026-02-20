import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';
import { HealthRuleSeverity, HealthRuleType } from '../cmdb-health-rule.entity';

export class CreateHealthRuleDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HealthRuleSeverity)
  severity?: HealthRuleSeverity;

  @IsObject()
  condition: { type: HealthRuleType; params?: Record<string, unknown> };

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateHealthRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HealthRuleSeverity)
  severity?: HealthRuleSeverity;

  @IsOptional()
  @IsObject()
  condition?: { type: HealthRuleType; params?: Record<string, unknown> };

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class HealthRuleFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(HealthRuleSeverity)
  severity?: HealthRuleSeverity;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}
