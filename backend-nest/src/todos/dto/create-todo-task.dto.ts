import { IsString, IsOptional, IsIn, IsDateString, IsUUID, IsArray, IsNumber, ArrayNotEmpty } from 'class-validator';

export class CreateTodoTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['todo', 'doing', 'done', 'pending', 'in_progress', 'completed'])
  status?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsUUID()
  ownerGroupId?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  boardId?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
