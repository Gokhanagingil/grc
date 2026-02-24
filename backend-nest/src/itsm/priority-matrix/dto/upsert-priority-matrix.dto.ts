import { IsArray, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class PriorityMatrixEntryDto {
  @IsString()
  impact: string;

  @IsString()
  urgency: string;

  @IsString()
  priority: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class UpsertPriorityMatrixDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriorityMatrixEntryDto)
  entries: PriorityMatrixEntryDto[];
}
