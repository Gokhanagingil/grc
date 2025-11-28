import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Display name' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: ['admin', 'user'], description: 'User roles (array of role names)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ example: '217492b2-f814-4ba0-ae50-4e4f8ecf6216', description: 'Tenant ID' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ example: true, description: 'Is user active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Reset failed attempts and unlock account' })
  @IsOptional()
  @IsBoolean()
  unlock?: boolean;
}

