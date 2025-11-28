import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddPolicyStandardDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Standard ID to map to policy',
  })
  @IsUUID()
  standardId!: string;
}

