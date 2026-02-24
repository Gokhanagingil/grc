import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ChangeTaskStatus, ChangeTaskType, ChangeTaskPriority } from '../change-task.entity';

export class CreateChangeTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Task title is required' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ChangeTaskStatus)
  @IsOptional()
  status?: ChangeTaskStatus;

  @IsEnum(ChangeTaskType)
  @IsOptional()
  taskType?: ChangeTaskType;

  @IsUUID('4')
  @IsOptional()
  assignmentGroupId?: string;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsEnum(ChangeTaskPriority)
  @IsOptional()
  priority?: ChangeTaskPriority;

  @IsDateString()
  @IsOptional()
  plannedStartAt?: string;

  @IsDateString()
  @IsOptional()
  plannedEndAt?: string;

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

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedDurationMinutes?: number;
}
