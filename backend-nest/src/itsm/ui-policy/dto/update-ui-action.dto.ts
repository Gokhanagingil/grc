import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateUiActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tableName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  workflowTransition?: string;

  @IsOptional()
  @IsArray()
  requiredRoles?: string[];

  @IsOptional()
  @IsArray()
  showConditions?: Array<{
    field: string;
    operator: string;
    value?: string | string[];
  }>;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  style?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
