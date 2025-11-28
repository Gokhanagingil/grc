import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsObject,
  Length,
  Min,
} from 'class-validator';

export class AdminListDictionariesDto {
  @ApiPropertyOptional({
    example: 'POLICY_STATUS',
    description: 'Filter by domain',
  })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({
    example: '217492b2-f814-4ba0-ae50-4e4f8ecf6216',
    description: 'Filter by tenant ID (admin only)',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminCreateDictionaryDto {
  @ApiProperty({
    example: 'POLICY_STATUS',
    description: 'Domain name (e.g., POLICY_STATUS, REQUIREMENT_CATEGORY)',
  })
  @IsString()
  @Length(1, 100)
  domain!: string;

  @ApiProperty({
    example: 'draft',
    description: 'Machine-friendly code (unique per tenant + domain)',
  })
  @IsString()
  @Length(1, 100)
  code!: string;

  @ApiProperty({
    example: 'Draft',
    description: 'Human-readable label',
  })
  @IsString()
  @Length(1)
  label!: string;

  @ApiPropertyOptional({
    example: 'Policy is in draft status',
    description: 'Optional description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order (lower numbers appear first)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this entry is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: { color: '#ff0000', icon: 'edit' },
    description: 'Optional metadata (JSON object)',
  })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class AdminUpdateDictionaryDto {
  @ApiPropertyOptional({
    example: 'Draft',
    description: 'Human-readable label',
  })
  @IsOptional()
  @IsString()
  @Length(1)
  label?: string;

  @ApiPropertyOptional({
    example: 'Policy is in draft status',
    description: 'Optional description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order (lower numbers appear first)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this entry is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: { color: '#ff0000', icon: 'edit' },
    description: 'Optional metadata (JSON object)',
  })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

