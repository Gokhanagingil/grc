import {
  IsString,
  IsOptional,
  IsUUID,
  IsEmail,
  MaxLength,
} from 'class-validator';

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  type?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  status?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  tier?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  criticality?: string;

  @IsUUID('4')
  @IsOptional()
  ownerUserId?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  ownerEmail?: string;
}
