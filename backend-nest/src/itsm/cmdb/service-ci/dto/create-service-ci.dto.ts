import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateServiceCiDto {
  @IsString()
  @IsNotEmpty()
  relationshipType: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
