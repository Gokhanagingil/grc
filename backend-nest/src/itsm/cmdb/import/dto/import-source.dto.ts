import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ImportSourceType } from '../cmdb-import-source.entity';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export class CreateImportSourceDto {
  @IsString()
  name: string;

  @IsEnum(ImportSourceType)
  @IsOptional()
  type?: ImportSourceType;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateImportSourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ImportSourceType)
  @IsOptional()
  type?: ImportSourceType;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class ImportSourceFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;
}
