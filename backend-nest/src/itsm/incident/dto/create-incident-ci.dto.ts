import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateIncidentCiDto {
  @IsNotEmpty()
  @IsUUID()
  ciId: string;

  @IsNotEmpty()
  @IsString()
  relationshipType: string;

  @IsOptional()
  @IsString()
  impactScope?: string;
}
