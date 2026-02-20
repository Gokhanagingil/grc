import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export const OFFERING_SORTABLE_FIELDS = [
  'name',
  'status',
  'createdAt',
  'updatedAt',
];

export class OfferingFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsUUID('4')
  @IsOptional()
  serviceId?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
