import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { KnownErrorState, KnownErrorFixStatus } from '../../enums';

/**
 * DTO for creating a Known Error
 */
export class CreateKnownErrorDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  symptoms?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  workaround?: string;

  @IsOptional()
  @IsEnum(KnownErrorFixStatus)
  permanentFixStatus?: KnownErrorFixStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  articleRef?: string;

  @IsOptional()
  @IsEnum(KnownErrorState)
  state?: KnownErrorState;

  @IsOptional()
  @IsUUID()
  problemId?: string;
}
