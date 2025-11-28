import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';

export class CreateEntityTypeDto {
  @ApiProperty({
    example: 'Application',
    description: 'Entity type code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({ example: 'Application', description: 'Entity type name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    example: 'Software applications and systems',
    description: 'Description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
