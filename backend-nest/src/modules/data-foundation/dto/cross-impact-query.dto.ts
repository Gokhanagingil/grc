import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CrossImpactQueryDto {
  @ApiProperty({
    example: 'ISO20000:8.4',
    description:
      'Clause code to find cross-impact for (format: STD:code or STD:code:subcode)',
  })
  @IsString()
  @IsOptional()
  clause!: string;
}
