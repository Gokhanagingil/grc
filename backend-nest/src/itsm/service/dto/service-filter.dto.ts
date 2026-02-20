import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { ServiceCriticality, ServiceStatus } from '../service.entity';
import { PaginationQueryDto } from '../../../grc/dto/pagination.dto';

export class ServiceFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @IsOptional()
  @IsEnum(ServiceCriticality)
  criticality?: ServiceCriticality;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export const SERVICE_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'status',
  'criticality',
];
