import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateChoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Table name is required' })
  @MaxLength(100)
  tableName: string;

  @IsString()
  @IsNotEmpty({ message: 'Field name is required' })
  @MaxLength(100)
  fieldName: string;

  @IsString()
  @IsNotEmpty({ message: 'Value is required' })
  @MaxLength(100)
  value: string;

  @IsString()
  @IsNotEmpty({ message: 'Label is required' })
  @MaxLength(255)
  label: string;

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
