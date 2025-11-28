import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  IsNumberString,
} from 'class-validator';

export class CreateGovPolicyDto {
  @ApiProperty() @IsString() @Length(1, 160) title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() reviewDate?: string;
}

export class UpdateGovPolicyDto extends PartialType(CreateGovPolicyDto) {}

export class QueryGovDto {
  @ApiPropertyOptional({ example: 'policy' })
  @IsOptional()
  @IsString()
  search?: string;
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;
  @ApiPropertyOptional({ example: 'IT' })
  @IsOptional()
  @IsString()
  category?: string;
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;
  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
  @ApiPropertyOptional({ example: 'created_at' })
  @IsOptional()
  @IsString()
  sort?: string;
  @ApiPropertyOptional({ example: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC';
}
