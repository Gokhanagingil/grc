import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/search/pagination.dto';
import { BCPPlanStatus } from '../../../entities/app/bcp-plan.entity';

export class QueryBIAProcessDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'Payroll',
    description: 'Search by name or code',
  })
  @IsOptional()
  @IsString()
  search?: string;

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
  @IsString()
  criticalityOp?: string;

  @ApiPropertyOptional({ example: 4, description: 'Criticality value (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  criticalityVal?: number;
}

export class QueryBIADependencyDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-process',
    description: 'Filter by process ID',
  })
  @IsOptional()
  @IsUUID()
  process_id?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-entity',
    description: 'Filter by entity ID',
  })
  @IsOptional()
  @IsUUID()
  entity_id?: string;
}

export class QueryBCPPlanDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'Payroll',
    description: 'Search by name or code',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-process',
    description: 'Filter by process ID',
  })
  @IsOptional()
  @IsUUID()
  process_id?: string;

  @ApiPropertyOptional({
    example: 'approved',
    enum: BCPPlanStatus,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsEnum(BCPPlanStatus)
  status?: BCPPlanStatus;
}

export class QueryBCPExerciseDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-plan',
    description: 'Filter by plan ID',
  })
  @IsOptional()
  @IsUUID()
  plan_id?: string;

  @ApiPropertyOptional({
    example: 'April',
    description: 'Search by name or code',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
