import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryStandardDto {
  @ApiPropertyOptional({
    example: 'ISO27001',
    description: 'Standard code filter',
  })
  @IsOptional()
  @IsString()
  code?: string;
}
