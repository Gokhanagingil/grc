import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateCiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID('4')
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lifecycle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  environment?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  assetTag?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  serialNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(45)
  ipAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  dnsName?: string;

  @IsUUID('4')
  @IsOptional()
  managedBy?: string;

  @IsUUID('4')
  @IsOptional()
  ownedBy?: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
