import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateCiRelDto {
  @IsUUID('4')
  @IsNotEmpty()
  sourceCiId: string;

  @IsUUID('4')
  @IsNotEmpty()
  targetCiId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
