import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateWorkflowDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tableName?: string;

  @IsOptional()
  @IsArray()
  states?: Array<{
    name: string;
    label: string;
    isInitial?: boolean;
    isFinal?: boolean;
  }>;

  @IsOptional()
  @IsArray()
  transitions?: Array<{
    name: string;
    label: string;
    from: string;
    to: string;
    requiredPermissions?: string[];
    requiredRoles?: string[];
    conditions?: Array<{
      field: string;
      operator: string;
      value?: string | string[];
    }>;
    actions?: Array<{
      type: string;
      field?: string;
      value?: string;
    }>;
  }>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
