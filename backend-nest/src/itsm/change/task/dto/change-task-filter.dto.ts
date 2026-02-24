import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';
import { ChangeTaskStatus, ChangeTaskType } from '../change-task.entity';

export class ChangeTaskFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChangeTaskStatus)
  status?: ChangeTaskStatus;

  @IsOptional()
  @IsEnum(ChangeTaskType)
  taskType?: ChangeTaskType;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  assignmentGroupId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export const CHANGE_TASK_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'number',
  'title',
  'status',
  'taskType',
  'priority',
  'sortOrder',
  'sequenceOrder',
  'plannedStartAt',
];
