import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  ValidateNested,
  IsArray,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChangeTaskType, ChangeTaskStatus, ChangeTaskPriority } from '../../task/change-task.entity';

export class TemplateTaskDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  taskKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ChangeTaskType)
  @IsOptional()
  taskType?: ChangeTaskType;

  @IsUUID('4')
  @IsOptional()
  defaultAssignmentGroupId?: string;

  @IsUUID('4')
  @IsOptional()
  defaultAssigneeId?: string;

  @IsEnum(ChangeTaskStatus)
  @IsOptional()
  defaultStatus?: ChangeTaskStatus;

  @IsEnum(ChangeTaskPriority)
  @IsOptional()
  defaultPriority?: ChangeTaskPriority;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedDurationMinutes?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  sequenceOrder?: number;

  @IsBoolean()
  @IsOptional()
  isBlocking?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  stageLabel?: string;
}

export class TemplateDependencyDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  predecessorTaskKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  successorTaskKey: string;
}

export class CreateChangeTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTaskDefinitionDto)
  @IsOptional()
  tasks?: TemplateTaskDefinitionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateDependencyDefinitionDto)
  @IsOptional()
  dependencies?: TemplateDependencyDefinitionDto[];
}
