import { IsString, IsOptional, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BoardColumnDto {
  @IsString()
  key: string;

  @IsString()
  title: string;

  @IsOptional()
  wipLimit?: number | null;

  @IsOptional()
  isDoneColumn?: boolean;
}

export class CreateTodoBoardDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['PRIVATE', 'TEAM', 'TENANT'])
  visibility?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardColumnDto)
  columns?: BoardColumnDto[];
}
