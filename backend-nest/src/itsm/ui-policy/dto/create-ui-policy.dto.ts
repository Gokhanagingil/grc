import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateUiPolicyDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsString()
  @MaxLength(100)
  tableName: string;

  @IsOptional()
  @IsArray()
  conditions?: Array<{
    field: string;
    operator: string;
    value?: string | string[];
  }>;

  @IsArray()
  fieldEffects: Array<{
    field: string;
    visible?: boolean;
    mandatory?: boolean;
    readOnly?: boolean;
  }>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
