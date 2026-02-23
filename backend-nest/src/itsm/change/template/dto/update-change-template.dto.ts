import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  ValidateNested,
  IsArray,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TemplateTaskDefinitionDto, TemplateDependencyDefinitionDto } from './create-change-template.dto';

export class UpdateChangeTemplateDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTaskDefinitionDto)
  @IsOptional()
  tasks?: TemplateTaskDefinitionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateDependencyDefinitionDto)
  @IsOptional()
  dependencies?: TemplateDependencyDefinitionDto[];
}
