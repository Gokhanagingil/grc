import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, IsEnum } from 'class-validator';

export enum FindingSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class CreateFindingDto {
  @ApiProperty({
    example: 'Insufficient Access Controls',
    description: 'Finding title',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: 'Access controls do not meet ISO27001 requirements',
    description: 'Finding description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['ISO20000:8.4', 'ISO22301:8.4'],
    description: 'Related clause codes',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  relatedClauseCodes!: string[];

  @ApiProperty({
    enum: FindingSeverity,
    example: FindingSeverity.HIGH,
    description: 'Finding severity',
  })
  @IsEnum(FindingSeverity)
  severity!: FindingSeverity;
}
