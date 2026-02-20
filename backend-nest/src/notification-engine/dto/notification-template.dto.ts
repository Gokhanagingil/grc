import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationTemplateDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  body: string;

  @IsArray()
  @IsOptional()
  allowedVariables?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateNotificationTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsArray()
  @IsOptional()
  allowedVariables?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PreviewTemplateDto {
  @IsString()
  template: string;

  @IsOptional()
  sampleData?: Record<string, unknown>;
}

export class TemplateFilterDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
