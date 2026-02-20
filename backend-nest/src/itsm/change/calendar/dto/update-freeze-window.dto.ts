import { IsString, IsOptional, IsUUID, IsDateString, MaxLength, IsBoolean } from 'class-validator';

export class UpdateFreezeWindowDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsString()
  @IsOptional()
  scope?: string;

  @IsUUID()
  @IsOptional()
  scopeRefId?: string;

  @IsString()
  @IsOptional()
  recurrence?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
