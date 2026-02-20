import { IsString, IsOptional, IsUUID, IsDateString, MaxLength, IsBoolean } from 'class-validator';

export class CreateFreezeWindowDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

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
