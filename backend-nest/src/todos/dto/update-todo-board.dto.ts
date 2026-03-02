import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateTodoBoardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['PRIVATE', 'TEAM', 'TENANT'])
  visibility?: string;
}
