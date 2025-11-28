import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsNumber,
  IsObject,
  IsOptional,
  Length,
  Min,
  Max,
} from 'class-validator';

export class CreateEntityDto {
  @ApiProperty({
    example: 'APP-HR',
    description: 'Entity code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({ example: 'HR Management System', description: 'Entity name' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'uuid-of-entity-type',
    description: 'Entity type ID',
  })
  @IsUUID()
  entity_type_id!: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Criticality level (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  criticality?: number;

  @ApiPropertyOptional({
    example: 'uuid-of-user',
    description: 'Owner user ID',
  })
  @IsOptional()
  @IsUUID()
  owner_user_id?: string;

  @ApiPropertyOptional({
    example: { tier: 'L1', repo: 'git://...' },
    description: 'Flexible attributes (JSON)',
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
