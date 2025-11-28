import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  Length,
  IsArray,
} from 'class-validator';

export class AdminCreatePermissionDto {
  @ApiProperty({ example: 'policy.create', description: 'Permission code (unique)' })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiPropertyOptional({ example: 'Create policies', description: 'Permission description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AdminUpdatePermissionDto {
  @ApiPropertyOptional({ example: 'policy.create', description: 'Permission code' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  code?: string;

  @ApiPropertyOptional({ example: 'Create policies', description: 'Permission description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AdminAssignPermissionsDto {
  @ApiProperty({ example: ['policy.create', 'policy.read'], description: 'Array of permission codes' })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

