import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateChoiceDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  parentValue?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
