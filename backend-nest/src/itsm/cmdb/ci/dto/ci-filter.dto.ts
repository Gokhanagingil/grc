import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export const CI_SORTABLE_FIELDS = [
  'name',
  'lifecycle',
  'environment',
  'createdAt',
  'updatedAt',
];

export class CiFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsUUID('4')
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  lifecycle?: string;

  @IsString()
  @IsOptional()
  environment?: string;
}
