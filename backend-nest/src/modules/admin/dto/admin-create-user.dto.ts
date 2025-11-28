import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsArray, IsOptional, IsUUID, MinLength, IsBoolean } from 'class-validator';

export class AdminCreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email (unique)' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe', description: 'Display name' })
  @IsString()
  displayName!: string;

  @ApiPropertyOptional({ example: 'securePassword123', description: 'Initial password (if not provided, random password will be generated)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: ['admin', 'user'], description: 'User roles (array of role names)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ example: '217492b2-f814-4ba0-ae50-4e4f8ecf6216', description: 'Tenant ID' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ example: true, description: 'Is user active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

