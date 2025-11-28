import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional, Length, MaxLength } from 'class-validator';

// Renamed to avoid conflict with PolicyModule's CreatePolicyDto
export class CreateGovernancePolicyDto {
  @ApiProperty({
    example: 'POL-001',
    description: 'Policy code (unique per tenant)',
  })
  @IsString()
  @Length(2, 64)
  code!: string;

  @ApiProperty({
    example: 'Information Security Policy',
    description: 'Policy title',
  })
  @IsString()
  @MaxLength(500)
  title!: string;

  // TODO: Create centralized status dictionary/enum generator for Policy/Requirement/BCM modules
  // TODO: Consider implementing UI policy engine for status transitions (e.g., draft -> approved requires review workflow)
  @ApiPropertyOptional({
    example: 'draft',
    enum: ['draft', 'approved', 'retired'],
    description: 'Policy status',
    default: 'draft',
  })
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'approved', 'retired'])
  status?: 'draft' | 'approved' | 'retired';

  @ApiPropertyOptional({ example: 'John', description: 'Owner first name' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  owner_first_name?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Owner last name' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  owner_last_name?: string;

  @ApiPropertyOptional({
    example: '01/01/2024',
    description: 'Effective date (dd/MM/yyyy format)',
  })
  @IsOptional()
  @IsString()
  effective_date?: string;

  @ApiPropertyOptional({
    example: '01/01/2025',
    description: 'Review date (dd/MM/yyyy format)',
  })
  @IsOptional()
  @IsString()
  review_date?: string;

  @ApiPropertyOptional({
    example: '<p>Policy content in HTML</p>',
    description: 'Policy content as HTML (rich text)',
  })
  @IsOptional()
  @IsString()
  content?: string;
}
