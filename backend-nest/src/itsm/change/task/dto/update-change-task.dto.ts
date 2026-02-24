import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ChangeTaskStatus,
  ChangeTaskType,
  ChangeTaskPriority,
} from '../change-task.entity';

export class UpdateChangeTaskDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

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
  assignmentGroupId?: string | null;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string | null;

  @IsEnum(ChangeTaskPriority)
  @IsOptional()
  priority?: ChangeTaskPriority;

  @IsDateString()
  @IsOptional()
  plannedStartAt?: string | null;

  @IsDateString()
  @IsOptional()
  plannedEndAt?: string | null;

  @IsDateString()
  @IsOptional()
  actualStartAt?: string | null;

  @IsDateString()
  @IsOptional()
  actualEndAt?: string | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  sequenceOrder?: number | null;

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
  stageLabel?: string | null;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedDurationMinutes?: number | null;
}
