import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { KnownErrorState, KnownErrorFixStatus } from '../../enums';

/**
 * DTO for updating a Known Error
 */
export class UpdateKnownErrorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

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

  @IsOptional()
  @IsBoolean()
  knowledgeCandidate?: boolean;

  @IsOptional()
  @IsObject()
  knowledgeCandidatePayload?: Record<string, unknown>;
}
