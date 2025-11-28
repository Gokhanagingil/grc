import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumberString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/search/pagination.dto';

export class QueryRiskCatalogDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'Operations',
    description: 'Risk category filter (code)',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: 'RISK-001',
    description: 'Search by code (contains)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    example: 'Data Breach',
    description: 'Search by name (contains)',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'security,data',
    description: 'Tags (comma-separated)',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    example: '>=',
    enum: ['=', '>', '>=', '<', '<='],
    description: 'Likelihood operator',
  })
  @IsOptional()
  @IsIn(['=', '>', '>=', '<', '<='])
  likelihoodOp?: string;

  @ApiPropertyOptional({ example: '4', description: 'Likelihood value (1-5)' })
  @IsOptional()
  @IsNumberString()
  likelihoodVal?: string;

  @ApiPropertyOptional({
    example: '>=',
    enum: ['=', '>', '>=', '<', '<='],
    description: 'Impact operator',
  })
  @IsOptional()
  @IsIn(['=', '>', '>=', '<', '<='])
  impactOp?: string;

  @ApiPropertyOptional({ example: '3', description: 'Impact value (1-5)' })
  @IsOptional()
  @IsNumberString()
  impactVal?: string;

  @ApiPropertyOptional({
    example: 'RISK-001',
    description: 'Search by code or name (legacy)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'name contains test AND category = Vendor AND likelihood > 4',
    description: 'KQL-light query string',
  })
  @IsOptional()
  @IsString()
  q?: string;

  // Pagination fields are inherited from PaginationDto, all optional
}
