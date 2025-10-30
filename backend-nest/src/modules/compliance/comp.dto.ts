import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, Length, MaxLength, IsNumberString } from 'class-validator';

export class CreateRequirementDto {
  @ApiProperty() @IsString() @Length(1, 160) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) regulation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) evidence?: string;
}

export class UpdateRequirementDto extends PartialType(CreateRequirementDto) {}

export class QueryRequirementDto {
  @ApiPropertyOptional({ example: 'ISO' }) @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ example: 'completed' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'GDPR' }) @IsOptional() @IsString() regulation?: string;
  @ApiPropertyOptional({ example: 'IT' }) @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ example: '1' }) @IsOptional() @IsNumberString() page?: string;
  @ApiPropertyOptional({ example: '20' }) @IsOptional() @IsNumberString() limit?: string;
  @ApiPropertyOptional({ example: 'created_at' }) @IsOptional() @IsString() sort?: string;
  @ApiPropertyOptional({ example: 'DESC', enum: ['ASC','DESC'] }) @IsOptional() @IsIn(['ASC','DESC']) order?: 'ASC'|'DESC';
}


