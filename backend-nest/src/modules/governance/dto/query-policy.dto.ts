import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class QueryPolicyDto {
  @ApiPropertyOptional({
    example: 'security',
    description: 'Search in title and code',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'approved',
    enum: ['draft', 'approved', 'retired'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'approved', 'retired'])
  status?: string;

  @ApiPropertyOptional({
    example: '01/01/2024',
    description: 'Filter by effective date from (dd/MM/yyyy)',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    example: '31/12/2024',
    description: 'Filter by effective date to (dd/MM/yyyy)',
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ example: '1', description: 'Page number' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ example: '20', description: 'Items per page' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ example: '20', description: 'Items per page (alias for limit)' })
  @IsOptional()
  @IsString()
  pageSize?: string;

  @ApiPropertyOptional({ example: 'security', description: 'Text search (alias for search)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'created_at:desc', description: 'Sort: "column:direction"' })
  @IsOptional()
  @IsString()
  sort?: string;
}
