import { IsOptional, IsEnum, IsUUID, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../grc/dto/pagination.dto';
import { KnownErrorState, KnownErrorFixStatus } from '../../enums';

/**
 * DTO for filtering/listing Known Errors with pagination
 */
export class KnownErrorFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(KnownErrorState)
  state?: KnownErrorState;

  @IsOptional()
  @IsEnum(KnownErrorFixStatus)
  permanentFixStatus?: KnownErrorFixStatus;

  @IsOptional()
  @IsUUID()
  problemId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
