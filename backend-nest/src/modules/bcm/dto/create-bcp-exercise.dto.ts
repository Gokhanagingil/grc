import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  Length,
} from 'class-validator';

export class CreateBCPExerciseDto {
  @ApiProperty({ example: 'uuid-of-plan', description: 'BCP Plan ID' })
  @IsUUID()
  plan_id!: string;

  @ApiProperty({
    example: 'EX-DR-LOGIN-APR',
    description: 'Exercise code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({
    example: 'Login Service DR Exercise - April',
    description: 'Exercise name',
  })
  @IsString()
  @Length(2)
  name!: string;

  @ApiProperty({
    example: '2025-04-15',
    description: 'Exercise date (ISO date)',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    example: 'Simulated login service outage',
    description: 'Exercise scenario',
  })
  @IsOptional()
  @IsString()
  scenario?: string;

  @ApiPropertyOptional({
    example: 'Exercise completed with 2 findings',
    description: 'Exercise result summary',
  })
  @IsOptional()
  @IsString()
  result?: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Number of findings discovered',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  findings_count?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Number of CAPs created',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  caps_count?: number;
}
