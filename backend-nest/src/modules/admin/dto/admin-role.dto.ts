import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  Length,
  IsArray,
} from 'class-validator';

export class AdminCreateRoleDto {
  @ApiProperty({ example: 'auditor', description: 'Role name (unique per tenant)' })
  @IsString()
  @Length(2, 50)
  name!: string;

  @ApiPropertyOptional({ example: 'Internal Auditor role', description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether this is a system role (cannot be deleted)' })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class AdminUpdateRoleDto {
  @ApiPropertyOptional({ example: 'auditor', description: 'Role name' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @ApiPropertyOptional({ example: 'Internal Auditor role', description: 'Role description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AdminAssignRolesDto {
  @ApiProperty({ example: ['admin', 'user'], description: 'Array of role names to assign to user' })
  @IsArray()
  @IsString({ each: true })
  roles!: string[];
}

export class AdminListRolesDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Page size' })
  @IsOptional()
  pageSize?: number;

  @ApiPropertyOptional({ example: 'audit', description: 'Search by role name' })
  @IsOptional()
  @IsString()
  search?: string;
}

