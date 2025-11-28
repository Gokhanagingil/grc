import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumberString,
  IsIn,
} from 'class-validator';
import { PaginationDto } from '../../../common/search/pagination.dto';

export class QueryEntityDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-entity-type',
    description: 'Filter by entity type ID',
  })
  @IsOptional()
  @IsUUID()
  entity_type_id?: string;

  @ApiPropertyOptional({
    example: 'Application',
    description: 'Filter by entity type code',
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ example: 'APP-HR', description: 'Search by code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'HR System', description: 'Search by name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-user',
    description: 'Filter by owner user ID',
  })
  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @ApiPropertyOptional({
    example: '>=',
    enum: ['=', '>', '>=', '<', '<='],
    description: 'Criticality operator',
  })
  @IsOptional()
  @IsIn(['=', '>', '>=', '<', '<='])
  criticalityOp?: string;

  @ApiPropertyOptional({ example: '4', description: 'Criticality value (1-5)' })
  @IsOptional()
  @IsNumberString()
  criticalityVal?: string;

  @ApiPropertyOptional({
    example: 'HR',
    description: 'Search term (code or name)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'name contains test AND criticality > 3',
    description: 'KQL-light query string',
  })
  @IsOptional()
  @IsString()
  q?: string;
}
