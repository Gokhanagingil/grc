import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export const CI_REL_SORTABLE_FIELDS = ['type', 'createdAt', 'updatedAt'];

export class CiRelFilterDto extends PaginationQueryDto {
  @IsUUID('4')
  @IsOptional()
  sourceCiId?: string;

  @IsUUID('4')
  @IsOptional()
  targetCiId?: string;

  @IsUUID('4')
  @IsOptional()
  ciId?: string;

  @IsString()
  @IsOptional()
  type?: string;
}
