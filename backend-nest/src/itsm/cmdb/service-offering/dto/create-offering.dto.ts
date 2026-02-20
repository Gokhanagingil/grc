import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateOfferingDto {
  @IsUUID('4')
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

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
