import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../grc/dto/pagination.dto';
import { SlaMetric, SlaSchedule } from '../sla-definition.entity';
import { SlaInstanceStatus } from '../sla-instance.entity';

export class SlaDefinitionFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SlaMetric)
  metric?: SlaMetric;

  @IsOptional()
  @IsEnum(SlaSchedule)
  schedule?: SlaSchedule;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export const SLA_DEFINITION_SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'metric',
  'targetSeconds',
  'order',
];

export class SlaInstanceFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  recordId?: string;

  @IsOptional()
  @IsString()
  recordType?: string;

  @IsOptional()
  @IsUUID()
  definitionId?: string;

  @IsOptional()
  @IsEnum(SlaInstanceStatus)
  status?: SlaInstanceStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  breached?: boolean;
}

export const SLA_INSTANCE_SORTABLE_FIELDS = [
  'createdAt',
  'startAt',
  'dueAt',
  'status',
  'breached',
];
