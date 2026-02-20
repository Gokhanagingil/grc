import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class UpdateOfferingDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  supportHours?: string;

  @IsUUID('4')
  @IsOptional()
  defaultSlaProfileId?: string;
}
