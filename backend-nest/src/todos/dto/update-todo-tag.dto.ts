import { IsString, IsOptional, Matches } from 'class-validator';

export class UpdateTodoTagDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color (e.g. #FF5733)' })
  color?: string | null;
}
