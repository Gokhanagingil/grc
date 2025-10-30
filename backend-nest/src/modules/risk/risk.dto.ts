import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Length, MaxLength, IsNumberString } from 'class-validator';

export class CreateRiskDto {
  @ApiProperty() @IsString() @Length(1, 160) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) likelihood?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) impact?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() riskScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) mitigationPlan?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdateRiskDto extends PartialType(CreateRiskDto) {}

export class QueryRiskDto {
  @ApiPropertyOptional({ example: 'db outage' }) @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ example: 'High' }) @IsOptional() @IsString() severity?: string;
  @ApiPropertyOptional({ example: 'open' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'IT' }) @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ example: '1' }) @IsOptional() @IsNumberString() page?: string;
  @ApiPropertyOptional({ example: '20' }) @IsOptional() @IsNumberString() limit?: string;
  @ApiPropertyOptional({ example: 'created_at' }) @IsOptional() @IsString() sort?: string;
  @ApiPropertyOptional({ example: 'DESC', enum: ['ASC','DESC'] }) @IsOptional() @IsIn(['ASC','DESC']) order?: 'ASC'|'DESC';
}


