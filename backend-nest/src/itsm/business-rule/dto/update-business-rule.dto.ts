import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { BusinessRuleTrigger } from '../business-rule.entity';

export class UpdateBusinessRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tableName?: string;

  @IsOptional()
  @IsEnum(BusinessRuleTrigger)
  trigger?: BusinessRuleTrigger;

  @IsOptional()
  @IsArray()
  conditions?: Array<{
    field: string;
    operator: string;
    value?: string | string[];
  }>;

  @IsOptional()
  @IsArray()
  actions?: Array<{
    type: string;
    field?: string;
    value?: string;
    message?: string;
  }>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  stopProcessing?: boolean;
}
