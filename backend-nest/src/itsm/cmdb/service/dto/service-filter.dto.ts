import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../grc/dto/pagination.dto';

export const SERVICE_SORTABLE_FIELDS = [
  'name',
  'type',
  'status',
  'tier',
  'criticality',
  'createdAt',
  'updatedAt',
];

export class ServiceFilterDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  tier?: string;

  @IsString()
  @IsOptional()
  criticality?: string;
}
