import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, Length } from 'class-validator';

export class CreateClauseDto {
  @ApiProperty({
    example: 'CUST-001',
    description: 'Clause code (unique per standard+tenant)',
  })
  @IsString()
  @Length(1, 100)
  clause_code!: string;

  @ApiProperty({
    example: 'Customer Requirements',
    description: 'Clause title',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: 'Clause description text',
    description: 'Clause content text',
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    example: '8.4',
    description: 'Parent clause code (for hierarchy)',
  })
  @IsOptional()
  @IsString()
  parent_clause_code?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Mark as synthetic/placeholder',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  synthetic?: boolean;
}
