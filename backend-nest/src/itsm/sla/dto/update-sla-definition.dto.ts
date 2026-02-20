import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { SlaMetric, SlaSchedule } from '../sla-definition.entity';

export class UpdateSlaDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SlaMetric)
  metric?: SlaMetric;

  @IsOptional()
  @IsInt()
  @Min(60)
  targetSeconds?: number;

  @IsOptional()
  @IsEnum(SlaSchedule)
  schedule?: SlaSchedule;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  businessStartHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  businessEndHour?: number;

  @IsOptional()
  @IsArray()
  businessDays?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  priorityFilter?: string[];

  @IsOptional()
  @IsUUID()
  serviceIdFilter?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stopOnStates?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pauseOnStates?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}
