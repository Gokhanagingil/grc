import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsNumberString,
  IsUUID,
  IsArray,
} from 'class-validator';

export class CreateRequirementDto {
  @ApiProperty() @IsString() @Length(1, 160) title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
  // Regulation reference (optional UUID - for future reference field support)
  @ApiPropertyOptional({
    description: 'Regulation ID (UUID reference to regulations table)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  regulation_id?: string;
  
  // Regulation string field (for backward compatibility)
  // TODO: Migrate to regulation_id reference in future
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  regulation?: string;
  
  // Category: JSON array for multi-select support (e.g., ['IT', 'Security'])
  // TODO: Migrate from string to array in future
  @ApiPropertyOptional({
    description: 'Categories as array (multi-select support)',
    example: ['IT', 'Security'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
  
  // Legacy category string field (for backward compatibility)
  // Note: Frontend can send either 'category' (string) or 'categories' (array)
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
  // TODO: Create centralized status dictionary/enum generator for Policy/Requirement/BCM modules
  // TODO: Add status enum validation (e.g., 'pending', 'in-progress', 'completed', 'overdue')
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  evidence?: string;
}

export class UpdateRequirementDto extends PartialType(CreateRequirementDto) {}

export class QueryRequirementDto {
  @ApiPropertyOptional({ example: 'ISO' })
  @IsOptional()
  @IsString()
  search?: string;
  @ApiPropertyOptional({ example: 'completed' })
  @IsOptional()
  @IsString()
  status?: string;
  @ApiPropertyOptional({ example: 'GDPR' })
  @IsOptional()
  @IsString()
  regulation?: string;
  @ApiPropertyOptional({ example: 'IT' })
  @IsOptional()
  @IsString()
  category?: string;
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;
  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ example: '20', description: 'Items per page (alias for limit)' })
  @IsOptional()
  @IsNumberString()
  pageSize?: string;

  @ApiPropertyOptional({ example: 'GDPR', description: 'Text search (alias for search)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'created_at:desc', description: 'Sort: "column:direction"' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ example: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';
}
