import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  IsDateString,
  MaxLength,
} from 'class-validator';
import {
  ChangeType,
  ChangeState,
  ChangeRisk,
  ChangeApprovalStatus,
} from '../change.entity';

export class UpdateChangeDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ChangeType)
  @IsOptional()
  type?: ChangeType;

  @IsEnum(ChangeState)
  @IsOptional()
  state?: ChangeState;

  @IsEnum(ChangeRisk)
  @IsOptional()
  risk?: ChangeRisk;

  @IsEnum(ChangeApprovalStatus)
  @IsOptional()
  approvalStatus?: ChangeApprovalStatus;

  @IsUUID('4')
  @IsOptional()
  requesterId?: string;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsUUID('4')
  @IsOptional()
  serviceId?: string;

  @IsUUID('4')
  @IsOptional()
  offeringId?: string;

  @IsDateString()
  @IsOptional()
  plannedStartAt?: string;

  @IsDateString()
  @IsOptional()
  plannedEndAt?: string;

  @IsDateString()
  @IsOptional()
  actualStartAt?: string;

  @IsDateString()
  @IsOptional()
  actualEndAt?: string;

  @IsString()
  @IsOptional()
  implementationPlan?: string;

  @IsString()
  @IsOptional()
  backoutPlan?: string;

  @IsString()
  @IsOptional()
  justification?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
