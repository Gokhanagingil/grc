import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import {
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../change.entity';
import { PaginationQueryDto } from '../../../grc/dto/pagination.dto';

export class ChangeFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChangeState)
  state?: ChangeState;

  @IsOptional()
  @IsEnum(ChangeType)
  type?: ChangeType;

  @IsOptional()
  @IsEnum(ChangeRisk)
  risk?: ChangeRisk;

  @IsOptional()
  @IsEnum(ChangeApprovalStatus)
  approvalStatus?: ChangeApprovalStatus;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @IsUUID()
  customerCompanyId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export const CHANGE_SORTABLE_FIELDS = [
  'createdAt',
  'updatedAt',
  'number',
  'title',
  'state',
  'type',
  'risk',
  'approvalStatus',
  'plannedStartAt',
];
