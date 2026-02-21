import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { MitigationActionType } from '../mitigation-action.entity';

export class CreateMitigationActionDto {
  @IsEnum(MitigationActionType)
  @IsNotEmpty()
  actionType: MitigationActionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUUID()
  catalogRiskId?: string;

  @IsOptional()
  @IsUUID()
  bindingId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
