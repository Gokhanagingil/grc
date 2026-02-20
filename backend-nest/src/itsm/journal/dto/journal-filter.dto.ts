import { IsOptional, IsEnum, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { JournalType } from '../journal.entity';

export class JournalFilterDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsEnum(JournalType)
  type?: JournalType;

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
