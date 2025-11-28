import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryControlDto {
  @ApiPropertyOptional({
    example: 'Access Control',
    description: 'Control family filter',
  })
  @IsOptional()
  @IsString()
  family?: string;

  @ApiPropertyOptional({
    example: 'AC-3',
    description: 'Search by control code or name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
