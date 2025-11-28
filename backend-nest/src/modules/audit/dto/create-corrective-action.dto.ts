import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  IsDateString,
  IsOptional,
  Length,
} from 'class-validator';
import { CorrectiveActionStatus } from '../../../entities/app/corrective-action.entity';

export class CreateCorrectiveActionDto {
  @ApiProperty({ example: 'uuid-of-finding', description: 'Finding ID' })
  @IsUUID()
  finding_id!: string;

  @ApiProperty({
    example: 'CAP-MFA-001',
    description: 'Corrective action code (unique per tenant)',
  })
  @IsString()
  @Length(2, 100)
  code!: string;

  @ApiProperty({
    example: 'Enable MFA on APP-FIN & SVC-LOGIN',
    description: 'CAP title',
  })
  @IsString()
  @Length(2)
  title!: string;

  @ApiPropertyOptional({
    example: 'Implement MFA controls',
    description: 'CAP description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-user',
    description: 'Assignee user ID',
  })
  @IsOptional()
  @IsUUID()
  assignee_user_id?: string;

  @ApiPropertyOptional({
    example: '2025-02-15',
    description: 'Due date (ISO date)',
  })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional({
    example: 'open',
    enum: CorrectiveActionStatus,
    default: 'open',
  })
  @IsOptional()
  @IsEnum(CorrectiveActionStatus)
  status?: CorrectiveActionStatus;

  @ApiPropertyOptional({
    example: '2025-02-15',
    description: 'Completed date (ISO date)',
  })
  @IsOptional()
  @IsDateString()
  completed_date?: string;
}
