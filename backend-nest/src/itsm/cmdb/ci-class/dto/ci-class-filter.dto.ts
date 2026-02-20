import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export const CI_CLASS_SORTABLE_FIELDS = [
  'name',
  'label',
  'sortOrder',
  'createdAt',
  'updatedAt',
];

export class CiClassFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
